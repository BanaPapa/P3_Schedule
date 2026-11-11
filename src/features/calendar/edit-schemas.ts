import { z } from "zod";
import { addDays, isIsoDate, isoWeekday, todayInSeoul, type IsoDate } from "@/lib/dates";
import { TIME_PATTERN } from "@/features/education/schemas";

/** 반복 수업을 고칠 때 범위: 이번 회차만 / 이 요일·시간 수업을 앞으로 매주 */
export const EDIT_SCOPES = ["once", "weekly"] as const;
export type EditScope = (typeof EDIT_SCOPES)[number];

/** DB private.validate_session_slot · change_schedule_from 과 같은 범위 */
const MAX_PAST_DAYS = 366;
const MAX_FUTURE_DAYS = 400;

const sessionRef = {
  id: z.uuid(),
  // 화면이 읽은 version. 다른 가족이 먼저 바꿨으면 DB 가 session_conflict 를 던진다.
  version: z.coerce.number().int().positive(),
};

export const CHILD_CHANGE_NEEDS_WEEKLY = "아이를 바꾸려면 '앞으로 매주'를 골라 주세요.";

/** 캘린더에서 바로 고치기(더블클릭 편집·끌어 옮기기 확인) */
export function sessionEditSchema(today: Date = new Date()) {
  const todayIso = todayInSeoul(today);
  const earliest = addDays(todayIso, -MAX_PAST_DAYS);
  const latest = addDays(todayIso, MAX_FUTURE_DAYS);
  return z
    .object({
      ...sessionRef,
      childId: z.uuid({ error: "아이를 골라 주세요." }),
      originalChildId: z.uuid(),
      date: z
        .string()
        .refine(isIsoDate, { error: "날짜를 올바르게 입력해 주세요." })
        .refine((value) => value >= earliest && value <= latest, { error: "앞뒤 1년 이내 날짜로 입력해 주세요." }),
      startTime: z.string().regex(TIME_PATTERN, { error: "시작 시각을 입력해 주세요." }),
      endTime: z.string().regex(TIME_PATTERN, { error: "끝나는 시각을 입력해 주세요." }),
      scope: z.enum(EDIT_SCOPES, { error: "적용 범위를 골라 주세요." }),
    })
    .refine((value) => value.endTime > value.startTime, {
      path: ["endTime"],
      error: "끝나는 시각은 시작 시각보다 늦어야 합니다.",
    })
    .refine((value) => value.childId === value.originalChildId || value.scope === "weekly", {
      path: ["scope"],
      error: CHILD_CHANGE_NEEDS_WEEKLY,
    });
}

export const sessionDeleteSchema = z.object({
  ...sessionRef,
  scope: z.enum(EDIT_SCOPES, { error: "삭제 범위를 골라 주세요." }),
});

/**
 * "앞으로 매주" 를 적용할 기준일. 원래 날짜와 새 날짜 중 이른 날부터 바꾸되 오늘보다 앞일 수는 없다
 * (지난 수업 기록은 바꾸지 않는다).
 */
export function weeklyFrom(originalDate: IsoDate, newDate: IsoDate, today: IsoDate): IsoDate {
  const earlier = originalDate < newDate ? originalDate : newDate;
  return earlier > today ? earlier : today;
}

/** 기준일 이후 처음으로 그 요일(ISO 1=월…7=일)이 오는 날. "언제부터 바뀌는지" 알려 줄 때 쓴다 */
export function firstClassDate(from: IsoDate, weekday: number): IsoDate {
  const gap = (weekday - isoWeekday(from) + 7) % 7;
  return addDays(from, gap);
}
