import { z } from "zod";
import { addDays, isIsoDate, todayInSeoul } from "@/lib/dates";
import { TIME_PATTERN } from "@/features/education/schemas";

/** DB private.validate_session_slot 과 같은 범위 */
const MAX_PAST_DAYS = 366;
const MAX_FUTURE_DAYS = 400;

export const SESSION_STATUSES = [
  "scheduled",
  "completed",
  "absent",
  "academy_cancelled",
  "cancelled",
  "makeup_scheduled",
  "makeup_completed",
] as const;

const sessionRef = {
  id: z.uuid(),
  // 화면이 읽은 시점의 version. 배우자가 먼저 바꿨으면 DB 가 session_conflict 를 던진다.
  version: z.coerce.number().int().positive(),
};

export const sessionStatusSchema = z.object({ ...sessionRef, status: z.enum(SESSION_STATUSES) });

/** 이번만 변경·보강 등록에 쓰는 날짜와 시간 */
export function sessionSlotSchema(today: Date = new Date()) {
  const todayIso = todayInSeoul(today);
  const earliest = addDays(todayIso, -MAX_PAST_DAYS);
  const latest = addDays(todayIso, MAX_FUTURE_DAYS);
  return z
    .object({
      ...sessionRef,
      date: z
        .string()
        .refine(isIsoDate, { error: "날짜를 올바르게 입력해 주세요." })
        .refine((value) => value >= earliest && value <= latest, { error: "앞뒤 1년 이내 날짜로 입력해 주세요." }),
      startTime: z.string().regex(TIME_PATTERN, { error: "시작 시각을 입력해 주세요." }),
      endTime: z.string().regex(TIME_PATTERN, { error: "끝나는 시각을 입력해 주세요." }),
    })
    .refine((value) => value.endTime > value.startTime, {
      path: ["endTime"],
      error: "끝나는 시각은 시작 시각보다 늦어야 합니다.",
    });
}

export const sessionWaiveSchema = z.object({
  ...sessionRef,
  waived: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const sessionNoteSchema = z.object({
  ...sessionRef,
  note: z
    .string()
    .trim()
    .max(500, { error: "메모는 500자 이하로 입력해 주세요." })
    .transform((value) => (value === "" ? null : value)),
});
