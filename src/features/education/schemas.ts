import { z } from "zod";
import { addDays, isIsoDate, todayInSeoul } from "@/lib/dates";

/** DB create_enrollment 의 제한과 같다 */
export const MAX_WEEKLY_SCHEDULES = 14;
/** 시작일 허용 범위. DB create_enrollment 와 같은 값 */
const MAX_PAST_START_DAYS = 366;
const MAX_FUTURE_START_DAYS = 400;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_PATTERN = /^[0-9+\-() ]{2,30}$/;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((value) => (value === "" ? null : value));

const isoDate = z.string().refine(isIsoDate, { error: "날짜를 올바르게 입력해 주세요." });

const recordRef = {
  id: z.uuid(),
  version: z.coerce.number().int().positive(),
};

const academyFields = {
  name: z
    .string()
    .trim()
    .min(1, { error: "학원 이름을 입력해 주세요." })
    .max(50, { error: "학원 이름은 50자 이하로 입력해 주세요." }),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || PHONE_PATTERN.test(value), {
      error: "전화번호는 숫자와 - ( ) + 만 입력해 주세요.",
    })
    .transform((value) => (value === "" ? null : value)),
  contactName: optionalText(30, "담당자 이름은 30자 이하로 입력해 주세요."),
  memo: optionalText(500, "메모는 500자 이하로 입력해 주세요."),
};

export const academyCreateSchema = z.object(academyFields);
export const academyUpdateSchema = z.object({ ...recordRef, ...academyFields });
export const academyDeleteSchema = z.object(recordRef);

const weeklyScheduleSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    startTime: z.string().regex(TIME_PATTERN),
    endTime: z.string().regex(TIME_PATTERN),
  })
  .refine((rule) => rule.endTime > rule.startTime);

function enrollmentSchema(today: Date) {
  const earliestStart = addDays(todayInSeoul(today), -MAX_PAST_START_DAYS);
  const latestStart = addDays(todayInSeoul(today), MAX_FUTURE_START_DAYS);
  return z
    .object({
      childId: z.uuid({ error: "자녀를 골라 주세요." }),
      academyId: z.uuid({ error: "학원을 골라 주세요." }),
      subject: z
        .string()
        .trim()
        .min(1, { error: "과목을 입력해 주세요." })
        .max(30, { error: "과목은 30자 이하로 입력해 주세요." }),
      startDate: isoDate.refine((value) => value >= earliestStart && value <= latestStart, {
        error: "시작일은 앞뒤 1년 이내로 입력해 주세요.",
      }),
      endDate: z
        .string()
        .transform((value) => (value === "" ? null : value))
        .refine((value) => value === null || isIsoDate(value), { error: "날짜를 올바르게 입력해 주세요." }),
      rules: z
        .array(weeklyScheduleSchema, { error: "수업 요일과 시간을 확인해 주세요." })
        .min(1, { error: "수업 요일과 시간을 하나 이상 입력해 주세요." })
        .max(MAX_WEEKLY_SCHEDULES)
        .refine(
          (rules) => new Set(rules.map((rule) => `${rule.weekday}-${rule.startTime}`)).size === rules.length,
          { error: "같은 요일·시간이 두 번 들어 있습니다." },
        ),
    })
    .refine((value) => value.endDate === null || value.endDate >= value.startDate, {
      path: ["endDate"],
      error: "종료일은 시작일 이후여야 합니다.",
    });
}

export type EnrollmentInput = z.infer<ReturnType<typeof enrollmentSchema>>;

function textEntries(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

/** 수업 시간 행은 weekday/startTime/endTime 이 같은 순서로 여러 개 온다 */
export function parseEnrollmentForm(formData: FormData, today: Date = new Date()) {
  const weekdays = textEntries(formData, "weekday");
  const startTimes = textEntries(formData, "startTime");
  const endTimes = textEntries(formData, "endTime");
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return enrollmentSchema(today).safeParse({
    childId: text("childId"),
    academyId: text("academyId"),
    subject: text("subject"),
    startDate: text("startDate"),
    endDate: text("endDate"),
    rules: weekdays.map((weekday, index) => ({
      weekday,
      startTime: startTimes[index] ?? "",
      endTime: endTimes[index] ?? "",
    })),
  });
}

export const enrollmentEndSchema = z.object({ id: z.uuid(), endDate: isoDate });
export const enrollmentDeleteSchema = z.object({ id: z.uuid() });
