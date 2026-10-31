import { z } from "zod";
import { isIsoDate, parseMonth } from "@/lib/dates";
import { parseWon } from "@/lib/money";

/** DB 와 같은 상한 */
const MAX_AMOUNT = 100_000_000;
const MAX_SESSION_AMOUNT = 10_000_000;
export const MAX_INVOICE_ITEMS = 20;

export const TUITION_METHODS = ["monthly", "per_session", "manual"] as const;
export const ITEM_KINDS = ["extra", "discount"] as const;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((value) => (value === "" ? null : value));

/** "300,000" → 300000. 빈 값은 null. */
const optionalWon = (max: number) =>
  z
    .string()
    .transform((value, ctx) => {
      if (value.trim() === "") return null;
      const amount = parseWon(value);
      if (amount === null || amount > max) {
        ctx.addIssue({ code: "custom", message: "금액을 숫자로 입력해 주세요." });
        return z.NEVER;
      }
      return amount;
    });

const requiredWon = (min: number, max: number) =>
  z.string().transform((value, ctx) => {
    const amount = parseWon(value);
    if (amount === null || amount < min || amount > max) {
      ctx.addIssue({ code: "custom", message: "금액을 숫자로 입력해 주세요." });
      return z.NEVER;
    }
    return amount;
  });

const isoDate = z.string().refine(isIsoDate, { error: "날짜를 올바르게 입력해 주세요." });

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function texts(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

const policySchema = z
  .object({
    enrollmentId: z.uuid(),
    effectiveMonth: z.string().transform((value, ctx) => {
      const month = parseMonth(value);
      if (!month) {
        ctx.addIssue({ code: "custom", message: "적용 시작 월을 골라 주세요." });
        return z.NEVER;
      }
      return `${value}-01`;
    }),
    method: z.enum(TUITION_METHODS, { error: "계산 방식을 골라 주세요." }),
    monthlyAmount: optionalWon(MAX_AMOUNT),
    perSessionAmount: optionalWon(MAX_SESSION_AMOUNT),
    absentBillable: z.boolean(),
    academyCancelledBillable: z.boolean(),
    paymentDay: z.string().transform((value, ctx) => {
      if (value.trim() === "") return null;
      const day = Number(value);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        ctx.addIssue({ code: "custom", message: "결제일은 1~31 사이로 입력해 주세요." });
        return z.NEVER;
      }
      return day;
    }),
    memo: optionalText(500, "메모는 500자 이하로 입력해 주세요."),
  })
  .superRefine((value, ctx) => {
    if (value.method === "monthly" && value.monthlyAmount === null) {
      ctx.addIssue({ code: "custom", path: ["monthlyAmount"], message: "월 수강료를 입력해 주세요." });
    }
    if (value.method === "per_session" && value.perSessionAmount === null) {
      ctx.addIssue({ code: "custom", path: ["perSessionAmount"], message: "회당 수강료를 입력해 주세요." });
    }
  })
  // 고른 방식에 쓰지 않는 금액은 버린다
  .transform((value) => ({
    ...value,
    monthlyAmount: value.method === "monthly" ? value.monthlyAmount : null,
    perSessionAmount: value.method === "per_session" ? value.perSessionAmount : null,
  }));

export function parsePolicyForm(formData: FormData) {
  return policySchema.safeParse({
    enrollmentId: text(formData, "enrollmentId"),
    effectiveMonth: text(formData, "effectiveMonth"),
    method: text(formData, "method"),
    monthlyAmount: text(formData, "monthlyAmount"),
    perSessionAmount: text(formData, "perSessionAmount"),
    absentBillable: formData.get("absentBillable") === "on",
    academyCancelledBillable: formData.get("academyCancelledBillable") === "on",
    paymentDay: text(formData, "paymentDay"),
    memo: text(formData, "memo"),
  });
}

const itemSchema = z.object({
  kind: z.enum(ITEM_KINDS),
  label: z.string().trim().min(1).max(50),
  amount: requiredWon(1, MAX_AMOUNT),
});

const confirmSchema = z.object({
  enrollmentId: z.uuid(),
  month: isoDate.refine((value) => value.endsWith("-01")),
  // 비워 두면 예상액으로 확정한다
  baseAmount: optionalWon(MAX_AMOUNT),
  reason: optionalText(200, "사유는 200자 이하로 입력해 주세요."),
  items: z
    .array(itemSchema, { error: "추가·할인 항목의 이름과 금액을 확인해 주세요." })
    .max(MAX_INVOICE_ITEMS),
});

/** 추가·할인 행은 itemKind/itemLabel/itemAmount 가 같은 순서로 온다. 이름·금액이 모두 빈 행은 무시한다. */
export function parseConfirmForm(formData: FormData) {
  const kinds = texts(formData, "itemKind");
  const labels = texts(formData, "itemLabel");
  const amounts = texts(formData, "itemAmount");
  const items = kinds
    .map((kind, index) => ({ kind, label: labels[index] ?? "", amount: amounts[index] ?? "" }))
    .filter((item) => item.label.trim() !== "" || item.amount.trim() !== "");

  return confirmSchema.safeParse({
    enrollmentId: text(formData, "enrollmentId"),
    month: text(formData, "month"),
    baseAmount: text(formData, "baseAmount"),
    reason: text(formData, "reason"),
    items,
  });
}

const invoiceRef = {
  invoiceId: z.uuid(),
  version: z.coerce.number().int().positive(),
};

export const adjustFormSchema = z.object({
  ...invoiceRef,
  // 비워 두면 지금 예상액으로 맞춘다
  baseAmount: optionalWon(MAX_AMOUNT),
  reason: optionalText(200, "사유는 200자 이하로 입력해 주세요."),
});

export const invoiceRefSchema = z.object(invoiceRef);

export const itemFormSchema = z.object({ invoiceId: z.uuid(), ...itemSchema.shape });

export const paymentFormSchema = z.object({
  invoiceId: z.uuid(),
  paidOn: isoDate,
  amount: requiredWon(1, MAX_AMOUNT),
  method: optionalText(30, "납부 방법은 30자 이하로 입력해 주세요."),
  memo: optionalText(200, "메모는 200자 이하로 입력해 주세요."),
});

export const rowRefSchema = z.object({ id: z.uuid(), invoiceId: z.uuid() });
