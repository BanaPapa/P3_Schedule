import { describe, expect, it } from "vitest";
import { describeEstimate, dueDate, estimateChanged, paymentStatus, summarizeMonth } from "./calc";

describe("describeEstimate", () => {
  it("explains each method", () => {
    expect(describeEstimate({ method: "per_session", unitAmount: 40000, sessionCount: 9, billableCount: 8 })).toBe(
      "청구 8회 (전체 9회) × 40,000원",
    );
    expect(describeEstimate({ method: "monthly", unitAmount: 300000, sessionCount: 8, billableCount: 8 })).toBe(
      "월정액 300,000원 (수업 8회)",
    );
    expect(describeEstimate({ method: "manual", unitAmount: null, sessionCount: 4, billableCount: 4 })).toBe(
      "수동 입력 (수업 4회)",
    );
    expect(describeEstimate({ method: null, unitAmount: null, sessionCount: 4, billableCount: 4 })).toBe(
      "요금 정책 없음",
    );
  });
});

describe("paymentStatus", () => {
  it.each([
    [300000, 0, "unpaid"],
    [300000, 100000, "partial"],
    [300000, 300000, "paid"],
    [300000, 350000, "overpaid"],
    [0, 0, "paid"],
  ] as const)("total %d, paid %d → %s", (total, paid, expected) => {
    expect(paymentStatus(total, paid)).toBe(expected);
  });
});

describe("dueDate", () => {
  it("uses the payment day of the billing month", () => {
    expect(dueDate("2026-11-01", 5)).toBe("2026-11-05");
  });

  it("clamps to the last day of short months", () => {
    expect(dueDate("2026-02-01", 31)).toBe("2026-02-28");
  });

  it("returns null without a payment day", () => {
    expect(dueDate("2026-11-01", null)).toBeNull();
  });
});

describe("estimateChanged", () => {
  const invoice = { estimatedAmount: 320000, billableCount: 8 };

  it("is false when the estimate matches the snapshot", () => {
    expect(estimateChanged(invoice, { estimatedAmount: 320000, billableCount: 8 })).toBe(false);
  });

  it("is true when the amount or the billed sessions changed", () => {
    expect(estimateChanged(invoice, { estimatedAmount: 280000, billableCount: 7 })).toBe(true);
    // 월정액은 금액은 같아도 회차 수가 바뀌면 알린다
    expect(estimateChanged(invoice, { estimatedAmount: 320000, billableCount: 7 })).toBe(true);
  });

  it("is false for manual policies that have no estimate", () => {
    expect(
      estimateChanged({ estimatedAmount: null, billableCount: 4 }, { estimatedAmount: null, billableCount: 3 }),
    ).toBe(false);
  });

  it("is false when there is no estimate to compare", () => {
    expect(estimateChanged(invoice, null)).toBe(false);
  });
});

describe("summarizeMonth", () => {
  it("adds estimates of unconfirmed rows and totals of confirmed rows", () => {
    expect(
      summarizeMonth([
        { estimatedAmount: 300000, invoice: null },
        { estimatedAmount: 200000, invoice: { totalAmount: 210000, paidAmount: 100000, balance: 110000 } },
        { estimatedAmount: null, invoice: null },
      ]),
    ).toEqual({ expected: 510000, confirmed: 210000, paid: 100000, unpaid: 110000, unconfirmedCount: 2 });
  });

  it("does not count overpayments as negative unpaid amounts", () => {
    expect(
      summarizeMonth([{ estimatedAmount: 100, invoice: { totalAmount: 100, paidAmount: 150, balance: -50 } }]).unpaid,
    ).toBe(0);
  });
});
