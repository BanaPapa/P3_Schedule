import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { parseWon } from "@/lib/money";
import { TIME_PATTERN } from "@/features/education/schemas";
import { tripDays, TRIP_CATEGORIES } from "./format";

/** DB 와 같은 상한 */
const MAX_TRIP_DAYS = 61;
const MAX_BUDGET = 1_000_000_000;
const MAX_EXPENSE = 100_000_000;

const isoDate = z.string().refine(isIsoDate, { error: "날짜를 올바르게 입력해 주세요." });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max}자 이하로 입력해 주세요.` })
    .transform((value) => (value === "" ? null : value));

const requiredWon = (min: number, max: number) =>
  z.string().transform((value, ctx) => {
    const amount = parseWon(value);
    if (amount === null || amount < min || amount > max) {
      ctx.addIssue({ code: "custom", message: "금액을 숫자로 입력해 주세요." });
      return z.NEVER;
    }
    return amount;
  });

const optionalWon = (max: number) =>
  z.string().transform((value, ctx) => {
    if (value.trim() === "") return null;
    const amount = parseWon(value);
    if (amount === null || amount > max) {
      ctx.addIssue({ code: "custom", message: "금액을 숫자로 입력해 주세요." });
      return z.NEVER;
    }
    return amount;
  });

const optionalTime = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || TIME_PATTERN.test(value), { error: "시각을 확인해 주세요." });

const tripFields = {
  title: z.string().trim().min(1, { error: "여행 이름을 입력해 주세요." }).max(50),
  destination: optionalText(50),
  startDate: isoDate,
  endDate: isoDate,
  budgetAmount: optionalWon(MAX_BUDGET),
  memo: optionalText(1000),
};

const tripRange = <T extends { startDate: string; endDate: string }>(value: T, ctx: z.RefinementCtx) => {
  if (value.endDate < value.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "돌아오는 날은 떠나는 날 이후여야 합니다." });
  } else if (tripDays(value.startDate, value.endDate).length > MAX_TRIP_DAYS) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "여행은 60일까지 등록할 수 있습니다." });
  }
};

export const tripCreateSchema = z.object(tripFields).superRefine(tripRange);

export const tripUpdateSchema = z
  .object({ id: z.uuid(), version: z.coerce.number().int().positive(), ...tripFields })
  .superRefine(tripRange);

export const itemSchema = z
  .object({
    tripId: z.uuid(),
    dayDate: isoDate,
    startTime: optionalTime,
    endTime: optionalTime,
    title: z.string().trim().min(1, { error: "일정 이름을 입력해 주세요." }).max(80),
    placeName: optionalText(80),
    address: optionalText(200),
    memo: optionalText(500),
  })
  .refine((value) => !value.startTime || !value.endTime || value.endTime > value.startTime, {
    path: ["endTime"],
    error: "끝나는 시각은 시작 시각보다 늦어야 합니다.",
  });

export const budgetSchema = z.object({
  tripId: z.uuid(),
  category: z.enum(TRIP_CATEGORIES),
  plannedAmount: requiredWon(0, MAX_BUDGET),
});

export const expenseSchema = z.object({
  tripId: z.uuid(),
  spentOn: isoDate,
  category: z.enum(TRIP_CATEGORIES, { error: "분류를 골라 주세요." }),
  amount: requiredWon(1, MAX_EXPENSE),
  description: optionalText(100),
});

export const travelRowSchema = z.object({ id: z.uuid(), tripId: z.uuid() });
export const tripDeleteSchema = z.object({ id: z.uuid(), version: z.coerce.number().int().positive() });
