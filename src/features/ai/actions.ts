"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addMonths, formatMonthParam, isIsoDate, monthBounds, monthOf, todayInSeoul } from "@/lib/dates";
import { dbErrorMessage } from "@/lib/errors";
import { failure, success, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireFamily } from "@/features/family/queries";
import { SCHOOL_KINDS } from "@/features/school/format";
import { MAX_SUPPLIES } from "@/features/school/schemas";
import { getTripSpendingInMonth } from "@/features/travel/queries";
import { summarizeMonth } from "@/features/tuition/calc";
import { getTuitionMonth } from "@/features/tuition/queries";
import { AI_MESSAGES, aiMode, askForStructured } from "./claude";
import {
  COST_ANALYSIS_SYSTEM,
  costAnalysisPrompt,
  extractionSystemPrompt,
  extractionUserContent,
  type ImageInput,
  type MonthCost,
} from "./prompts";
import { detectImageType } from "./image";
import { extractionSchema, fakeExtraction, normalizeExtraction, type ReviewItem, type SchoolSuggestion } from "./suggestions";

const MAX_TEXT = 5000;
/** Claude 이미지 한도(5MB) 안에서 base64 로 늘어나는 것을 감안한다 */
const MAX_IMAGE_BYTES = 3_500_000;

const ANALYSIS_MONTHS = 6;
const MAX_REGISTER = 30;

export type ExtractState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; schoolItems: SchoolSuggestion[]; reviewItems: ReviewItem[]; remaining: number | null };

export type AnalysisState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; summary: string; highlights: string[]; suggestions: string[] };

/** 하루 사용량을 하나 쓰고 남은 횟수를 돌려준다 */
async function consumeQuota(kind: "extract" | "analyze"): Promise<{ ok: true; remaining: number } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_ai_request", { p_kind: kind });
  if (error) {
    if (error.code !== "P0001") logger.error("record_ai_request failed", { code: error.code });
    return { ok: false, message: dbErrorMessage(error) };
  }
  return { ok: true, remaining: data };
}

async function readImage(file: FormDataEntryValue | null): Promise<ImageInput | null | "invalid"> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) return "invalid";
  const bytes = new Uint8Array(await file.arrayBuffer());
  // 브라우저가 알려 준 형식이 아니라 실제 파일 내용으로 판단한다
  const mediaType = detectImageType(bytes);
  if (!mediaType) return "invalid";
  return { mediaType, base64: Buffer.from(bytes).toString("base64") };
}

/** 가정통신문·학원 공지에서 일정 후보를 뽑는다. 저장하지 않고 화면에 돌려준다. */
export async function extractScheduleAction(_prev: ExtractState, formData: FormData): Promise<ExtractState> {
  const mode = aiMode();
  if (mode === "disabled") return { status: "error", message: AI_MESSAGES.disabled };
  // 파일을 읽기 전에 로그인·가족부터 확인한다
  const { children } = await requireFamily();

  const rawText = formData.get("text");
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (text.length > MAX_TEXT) return { status: "error", message: `글은 ${MAX_TEXT}자까지 넣을 수 있습니다.` };
  const image = await readImage(formData.get("image"));
  if (image === "invalid") {
    return { status: "error", message: "사진은 3.5MB 이하의 JPG·PNG·WEBP·GIF 로 올려 주세요." };
  }
  if (!text && !image) return { status: "error", message: "안내문 글을 붙여 넣거나 사진을 올려 주세요." };

  const quota = await consumeQuota("extract");
  if (!quota.ok) return { status: "error", message: quota.message };

  const result =
    mode === "fake"
      ? { ok: true as const, data: fakeExtraction(text) }
      : await askForStructured({
          schema: extractionSchema,
          system: extractionSystemPrompt(todayInSeoul(), children.map((child) => child.name)),
          content: extractionUserContent(text, image),
          effort: "low",
          purpose: "extract_schedule",
        });
  if (!result.ok) return { status: "error", message: result.error };

  const normalized = normalizeExtraction(result.data, children);
  return { status: "done", ...normalized, remaining: quota.remaining };
}

/** 부모가 고르고 고친 제안만 다시 검증해 학교 일정으로 저장한다 */
const registerItemSchema = z
  .object({
    childId: z.uuid(),
    kind: z.enum(SCHOOL_KINDS),
    eventDate: z.string().refine(isIsoDate),
    endDate: z.string().refine(isIsoDate).nullable(),
    title: z.string().trim().min(1).max(80),
    subject: z.string().trim().max(30).nullable(),
    supplies: z.array(z.string().trim().min(1).max(50)).max(MAX_SUPPLIES),
    note: z.string().trim().max(500).nullable(),
  })
  .refine((item) => item.endDate === null || item.endDate >= item.eventDate);

export async function registerSuggestionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formData.getAll("item").filter((value): value is string => typeof value === "string");
  if (raw.length === 0) return failure("등록할 항목을 골라 주세요.");
  if (raw.length > MAX_REGISTER) return failure(`한 번에 ${MAX_REGISTER}개까지 등록할 수 있습니다.`);

  const items = [];
  for (const value of raw) {
    let json: unknown;
    try {
      json = JSON.parse(value);
    } catch {
      return failure("항목을 읽지 못했습니다. 다시 시도해 주세요.");
    }
    const parsed = registerItemSchema.safeParse(json);
    if (!parsed.success) return failure("자녀·날짜·제목을 모두 확인해 주세요.");
    items.push(parsed.data);
  }

  await requireFamily();
  const supabase = await createClient();
  // 한 트랜잭션으로 저장해 중간에 실패해도 일부만 남지 않게 한다
  const { error } = await supabase.rpc("create_school_events", {
    p_items: items.map((item) => ({
      child_id: item.childId,
      kind: item.kind,
      event_date: item.eventDate,
      end_date: item.endDate,
      title: item.title,
      subject: item.subject,
      memo: item.note,
      supplies: item.supplies,
    })),
  });
  if (error) {
    if (error.code !== "P0001") logger.error("register_suggestions failed", { code: error.code });
    return failure(dbErrorMessage(error));
  }

  revalidatePath(ROUTES.school);
  revalidatePath(ROUTES.calendar);
  revalidatePath(ROUTES.home);
  return success(`학교 일정 ${items.length}개를 등록했습니다.`);
}

const costAnalysisSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
});

/** 최근 6개월 교육비·여행비 집계. 월별 금액과 "자녀 이름 과목" 표시만 보낸다(주소·연락처 등은 보내지 않는다). */
async function recentCosts(): Promise<MonthCost[]> {
  const thisMonth = monthOf(todayInSeoul());
  const months = Array.from({ length: ANALYSIS_MONTHS }, (_, index) => addMonths(thisMonth, index - ANALYSIS_MONTHS + 1));
  return Promise.all(
    months.map(async (month) => {
      const { first, last } = monthBounds(month);
      const [rows, trips] = await Promise.all([getTuitionMonth(first), getTripSpendingInMonth(first, last)]);
      const tuition = summarizeMonth(rows.map((row) => ({ estimatedAmount: row.estimate.estimatedAmount, invoice: row.invoice })));
      return {
        month: formatMonthParam(month),
        tuition: tuition.expected,
        travel: trips.reduce((sum, trip) => sum + trip.amount, 0),
        subjects: rows.map((row) => ({
          label: `${row.enrollment.child.name} ${row.enrollment.academy.name}`,
          amount: row.invoice?.totalAmount ?? row.estimate.estimatedAmount ?? 0,
        })),
      };
    }),
  );
}

export async function analyzeCostsAction(): Promise<AnalysisState> {
  const mode = aiMode();
  if (mode === "disabled") return { status: "error", message: AI_MESSAGES.disabled };

  const months = await recentCosts();
  if (months.every((month) => month.tuition === 0 && month.travel === 0)) {
    return { status: "error", message: "분석할 지출이 아직 없습니다. 교육비나 여행 지출을 먼저 기록해 주세요." };
  }
  const quota = await consumeQuota("analyze");
  if (!quota.ok) return { status: "error", message: quota.message };

  if (mode === "fake") {
    const latest = months.at(-1);
    return {
      status: "done",
      summary: `이번 달 교육비는 ${latest?.tuition ?? 0}원입니다.`,
      highlights: ["(테스트) 가짜 분석 결과"],
      suggestions: ["(테스트) 실제 분석은 API 키가 있을 때 동작합니다."],
    };
  }
  const result = await askForStructured({
    schema: costAnalysisSchema,
    system: COST_ANALYSIS_SYSTEM,
    content: [{ type: "text", text: costAnalysisPrompt(months) }],
    effort: "medium",
    purpose: "analyze_costs",
  });
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "done", ...result.data };
}
