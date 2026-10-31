import { describe, expect, it } from "vitest";
import {
  adjustFormSchema,
  itemFormSchema,
  parseConfirmForm,
  parsePolicyForm,
  paymentFormSchema,
} from "./schemas";

const UUID = "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11";

function form(fields: Record<string, string | string[]>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) formData.append(key, item);
  }
  return formData;
}

describe("parsePolicyForm", () => {
  const base = {
    enrollmentId: UUID,
    effectiveMonth: "2026-11",
    method: "per_session",
    monthlyAmount: "",
    perSessionAmount: "40,000",
    absentBillable: "on",
    paymentDay: "5",
    memo: "",
  };

  it("parses a per-session policy with checkboxes", () => {
    expect(parsePolicyForm(form(base)).data).toEqual({
      enrollmentId: UUID,
      effectiveMonth: "2026-11-01",
      method: "per_session",
      monthlyAmount: null,
      perSessionAmount: 40000,
      absentBillable: true,
      academyCancelledBillable: false,
      paymentDay: 5,
      memo: null,
    });
  });

  it("requires the amount that matches the method", () => {
    const missing = parsePolicyForm(form({ ...base, perSessionAmount: "" }));
    expect(missing.error?.issues[0]?.path).toEqual(["perSessionAmount"]);
    const monthly = parsePolicyForm(form({ ...base, method: "monthly", monthlyAmount: "" }));
    expect(monthly.error?.issues[0]?.path).toEqual(["monthlyAmount"]);
  });

  it("does not need an amount for manual policies and drops stray amounts", () => {
    const result = parsePolicyForm(form({ ...base, method: "manual", perSessionAmount: "40000" }));
    expect(result.data).toMatchObject({ method: "manual", monthlyAmount: null, perSessionAmount: null });
  });

  it.each([
    [{ paymentDay: "32" }, "paymentDay"],
    [{ effectiveMonth: "2026-13" }, "effectiveMonth"],
    [{ perSessionAmount: "사만원" }, "perSessionAmount"],
  ])("rejects %j", (overrides, field) => {
    const result = parsePolicyForm(form({ ...base, ...overrides }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe("parseConfirmForm", () => {
  it("uses the estimate when the amount is blank and keeps filled item rows", () => {
    const result = parseConfirmForm(
      form({
        enrollmentId: UUID,
        month: "2026-11-01",
        baseAmount: "",
        reason: "",
        itemKind: ["extra", "discount", "extra"],
        itemLabel: ["교재비", "형제 할인", ""],
        itemAmount: ["20,000", "10000", ""],
      }),
    );
    expect(result.data).toEqual({
      enrollmentId: UUID,
      month: "2026-11-01",
      baseAmount: null,
      reason: null,
      items: [
        { kind: "extra", label: "교재비", amount: 20000 },
        { kind: "discount", label: "형제 할인", amount: 10000 },
      ],
    });
  });

  it("rejects half-filled items", () => {
    const result = parseConfirmForm(
      form({ enrollmentId: UUID, month: "2026-11-01", baseAmount: "", reason: "", itemKind: ["extra"], itemLabel: ["교재비"], itemAmount: [""] }),
    );
    expect(result.error?.issues[0]?.path[0]).toBe("items");
  });

  it("accepts an explicit amount", () => {
    const result = parseConfirmForm(form({ enrollmentId: UUID, month: "2026-11-01", baseAmount: "250,000", reason: "학원 안내 금액" }));
    expect(result.data).toMatchObject({ baseAmount: 250000, reason: "학원 안내 금액", items: [] });
  });
});

describe("other forms", () => {
  it("parses an adjustment to the current estimate", () => {
    expect(adjustFormSchema.parse({ invoiceId: UUID, version: "3", baseAmount: "", reason: " 1회 취소 " })).toEqual({
      invoiceId: UUID,
      version: 3,
      baseAmount: null,
      reason: "1회 취소",
    });
  });

  it("parses items and payments", () => {
    expect(itemFormSchema.parse({ invoiceId: UUID, kind: "extra", label: " 교재비 ", amount: "20,000" })).toEqual({
      invoiceId: UUID,
      kind: "extra",
      label: "교재비",
      amount: 20000,
    });
    expect(
      paymentFormSchema.parse({ invoiceId: UUID, paidOn: "2026-11-05", amount: "100,000", method: "", memo: "" }),
    ).toEqual({ invoiceId: UUID, paidOn: "2026-11-05", amount: 100000, method: null, memo: null });
  });

  it("rejects zero payments and bad dates", () => {
    expect(paymentFormSchema.safeParse({ invoiceId: UUID, paidOn: "2026-11-05", amount: "0", method: "", memo: "" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ invoiceId: UUID, paidOn: "2026-02-30", amount: "10", method: "", memo: "" }).success).toBe(false);
  });
});
