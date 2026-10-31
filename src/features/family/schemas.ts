import { z } from "zod";
import { isInviteCode } from "@/lib/invite-url";

/** 캘린더에서 자녀를 구분하는 색. 첫 번째 값은 DB 기본값과 같다. */
export const CHILD_COLORS = [
  "#2563eb",
  "#db2777",
  "#16a34a",
  "#ea580c",
  "#7c3aed",
  "#0891b2",
] as const;

export type ChildColor = (typeof CHILD_COLORS)[number];

const FAMILY_TIME_ZONE = "Asia/Seoul";

const familyName = z
  .string()
  .trim()
  .min(1, { error: "가족 이름을 입력해 주세요." })
  .max(50, { error: "가족 이름은 50자 이하로 입력해 주세요." });

const displayName = z
  .string()
  .trim()
  .min(1, { error: "호칭을 입력해 주세요. 예: 아빠, 엄마" })
  .max(30, { error: "호칭은 30자 이하로 입력해 주세요." });

export const createFamilySchema = z.object({ familyName, displayName });

export const acceptInvitationSchema = z.object({
  code: z.string().refine(isInviteCode, { error: "초대 코드 형식이 올바르지 않습니다." }),
  displayName,
});

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function dateInFamilyTimeZone(now: Date): string {
  // en-CA 형식이 YYYY-MM-DD 다
  return new Intl.DateTimeFormat("en-CA", { timeZone: FAMILY_TIME_ZONE }).format(now);
}

function birthDate(today: Date) {
  const todayIso = dateInFamilyTimeZone(today);
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || isCalendarDate(value), {
      error: "생년월일을 올바르게 입력해 주세요.",
    })
    .refine((value) => value === null || value <= todayIso, {
      error: "생년월일은 오늘 이후일 수 없습니다.",
    });
}

const childFields = (today: Date) => ({
  name: z
    .string()
    .trim()
    .min(1, { error: "이름을 입력해 주세요." })
    .max(30, { error: "이름은 30자 이하로 입력해 주세요." }),
  birthDate: birthDate(today),
  color: z.enum(CHILD_COLORS, { error: "색을 골라 주세요." }),
});

const recordRef = {
  id: z.uuid(),
  // 화면이 읽은 시점의 version. 저장 시 이 값으로 동시 수정을 감지한다.
  version: z.coerce.number().int().positive(),
};

export const childCreateSchema = (today: Date = new Date()) => z.object(childFields(today));

export const childUpdateSchema = (today: Date = new Date()) =>
  z.object({ ...recordRef, ...childFields(today) });

export const childDeleteSchema = z.object(recordRef);

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type ChildCreateInput = z.infer<ReturnType<typeof childCreateSchema>>;
export type ChildUpdateInput = z.infer<ReturnType<typeof childUpdateSchema>>;
