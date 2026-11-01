import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { SCHOOL_KINDS } from "./format";

/** 한 번에 넣는 준비물 수 */
export const MAX_SUPPLIES = 20;

const isoDate = z.string().refine(isIsoDate, { error: "날짜를 올바르게 입력해 주세요." });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max}자 이하로 입력해 주세요.` })
    .transform((value) => (value === "" ? null : value));

const eventSchema = z
  .object({
    childId: z.uuid({ error: "자녀를 골라 주세요." }),
    kind: z.enum(SCHOOL_KINDS, { error: "종류를 골라 주세요." }),
    eventDate: isoDate,
    endDate: z
      .string()
      .transform((value) => (value === "" ? null : value))
      .refine((value) => value === null || isIsoDate(value), { error: "날짜를 올바르게 입력해 주세요." }),
    title: z.string().trim().min(1, { error: "내용을 입력해 주세요." }).max(80),
    subject: optionalText(30),
    memo: optionalText(500),
    supplies: z.array(z.string().max(50, { error: "준비물 이름은 50자 이하로 입력해 주세요." })).max(MAX_SUPPLIES),
  })
  .refine((value) => value.endDate === null || value.endDate >= value.eventDate, {
    path: ["endDate"],
    error: "끝나는 날은 시작하는 날 이후여야 합니다.",
  });

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** 준비물은 쉼표나 줄바꿈으로 나눠 적는다 */
export function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    childId: text(formData, "childId"),
    kind: text(formData, "kind"),
    eventDate: text(formData, "eventDate"),
    endDate: text(formData, "endDate"),
    title: text(formData, "title"),
    subject: text(formData, "subject"),
    memo: text(formData, "memo"),
    supplies: text(formData, "supplies")
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  });
}

const optionalScore = z.string().transform((value, ctx) => {
  if (value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 9999) {
    ctx.addIssue({ code: "custom", message: "점수를 숫자로 입력해 주세요." });
    return z.NEVER;
  }
  return number;
});

export const scoreSchema = z
  .object({ id: z.uuid(), score: optionalScore, maxScore: optionalScore })
  .refine((value) => value.score === null || value.maxScore === null || value.score <= value.maxScore, {
    path: ["score"],
    error: "점수는 만점보다 클 수 없습니다.",
  });

export const eventRefSchema = z.object({ id: z.uuid() });
export const itemToggleSchema = z.object({ id: z.uuid(), eventId: z.uuid(), checked: z.enum(["true", "false"]) });
