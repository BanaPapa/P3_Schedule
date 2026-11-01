import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { SCHOOL_KINDS, type SchoolKind } from "@/features/school/format";
import { MAX_SUPPLIES } from "@/features/school/schemas";

/**
 * Claude 가 돌려주는 모양(structured output). 사람이 검토하기 전의 "제안"일 뿐이며
 * 그대로 저장하지 않는다. 문자열 길이 같은 세부 규칙은 normalizeExtraction 이 다시 확인한다.
 */
export const extractionSchema = z.object({
  items: z.array(
    z.object({
      category: z.enum(["school", "academy", "other"]),
      schoolKind: z.enum(SCHOOL_KINDS).nullable(),
      childName: z.string().nullable(),
      date: z.string().nullable(),
      endDate: z.string().nullable(),
      time: z.string().nullable(),
      title: z.string(),
      subject: z.string().nullable(),
      supplies: z.array(z.string()),
      note: z.string().nullable(),
    }),
  ),
  unresolved: z.array(z.string()),
});

export type Extraction = z.infer<typeof extractionSchema>;

/** 학교 일정으로 등록할 수 있는 제안 (부모가 고르고 고친 뒤에만 저장한다) */
export interface SchoolSuggestion {
  childId: string | null;
  kind: SchoolKind;
  eventDate: string;
  endDate: string | null;
  title: string;
  subject: string | null;
  supplies: string[];
  note: string | null;
}

/** 학원 변경·날짜 없는 일처럼 부모가 직접 처리할 것 */
export interface ReviewItem {
  title: string;
  date: string | null;
  note: string | null;
}

export interface NormalizedExtraction {
  schoolItems: SchoolSuggestion[];
  reviewItems: ReviewItem[];
}

interface ChildRef {
  id: string;
  name: string;
}

const clip = (value: string | null, max: number): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed.slice(0, max);
};

/** AI 결과를 앱 규칙에 맞게 다듬고, 학교 일정 후보와 직접 확인할 항목으로 나눈다 */
export function normalizeExtraction(extraction: Extraction, children: readonly ChildRef[]): NormalizedExtraction {
  const schoolItems: SchoolSuggestion[] = [];
  const reviewItems: ReviewItem[] = [];

  for (const item of extraction.items) {
    const title = clip(item.title, 80) ?? "제목 없음";
    const date = item.date && isIsoDate(item.date) ? item.date : null;
    const note = clip(item.note, 500);

    if (item.category !== "school" || !item.schoolKind || !date) {
      reviewItems.push({ title, date, note });
      continue;
    }
    const endDate = item.endDate && isIsoDate(item.endDate) && item.endDate > date ? item.endDate : null;
    schoolItems.push({
      childId: children.find((child) => child.name === item.childName?.trim())?.id ?? null,
      kind: item.schoolKind,
      eventDate: date,
      endDate,
      title,
      subject: clip(item.subject, 30),
      supplies: item.supplies
        .map((supply) => supply.trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, MAX_SUPPLIES),
      note,
    });
  }

  for (const text of extraction.unresolved) {
    const title = clip(text, 80);
    if (title) reviewItems.push({ title, date: null, note: null });
  }
  return { schoolItems, reviewItems };
}

/**
 * 테스트 전용 가짜 추출기(FAMILY_HUB_FAKE_AI=1). API 를 부르지 않고 글 속 YYYY-MM-DD 마다 행사 하나를 만든다.
 * 운영 환경에서는 이 환경 변수를 설정하지 않는다.
 */
export function fakeExtraction(text: string): Extraction {
  const items = [...text.matchAll(/(\d{4}-\d{2}-\d{2})\s*([^\n]*)/g)].map((match) => ({
    category: "school" as const,
    schoolKind: "event" as const,
    childName: null,
    date: match[1],
    endDate: null,
    time: null,
    title: match[2].trim() || "학교 일정",
    subject: null,
    supplies: [],
    note: null,
  }));
  return { items, unresolved: [] };
}
