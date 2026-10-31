import { addDays, monthBounds, monthOf, type IsoDate } from "@/lib/dates";
import { formatWon } from "@/lib/money";

type Method = "monthly" | "per_session" | "manual";

export const METHOD_LABELS: Record<Method, string> = {
  monthly: "월정액",
  per_session: "회차별",
  manual: "수동 입력",
};

interface EstimateBasis {
  method: Method | null;
  unitAmount: number | null;
  sessionCount: number;
  billableCount: number;
}

/** 예상액이 어떻게 나왔는지 한 줄로 */
export function describeEstimate({ method, unitAmount, sessionCount, billableCount }: EstimateBasis): string {
  switch (method) {
    case "per_session":
      return `청구 ${billableCount}회 (전체 ${sessionCount}회) × ${formatWon(unitAmount ?? 0)}`;
    case "monthly":
      return `월정액 ${formatWon(unitAmount ?? 0)} (수업 ${sessionCount}회)`;
    case "manual":
      return `수동 입력 (수업 ${sessionCount}회)`;
    default:
      return "요금 정책 없음";
  }
}

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "미납",
  partial: "일부 납부",
  paid: "완납",
  overpaid: "초과 납부",
};

export function paymentStatus(total: number, paid: number): PaymentStatus {
  if (paid > total) return "overpaid";
  if (paid === total) return "paid";
  return paid === 0 ? "unpaid" : "partial";
}

/** 청구 월의 결제일. 그 달에 없는 날(2월 30일 등)은 말일로. */
export function dueDate(billingMonth: IsoDate, paymentDay: number | null): IsoDate | null {
  if (paymentDay === null) return null;
  const { last } = monthBounds(monthOf(billingMonth));
  const candidate = addDays(billingMonth, paymentDay - 1);
  return candidate > last ? last : candidate;
}

interface EstimateSnapshot {
  estimatedAmount: number | null;
  billableCount: number;
}

/**
 * 확정 이후 일정이 바뀌어 예상액이 달라졌는지. 달라졌으면 화면이 알리고, 확정액은 사용자가 조정해야 바뀐다.
 * 수동 방식(예상액 없음)은 비교할 기준이 없으므로 알리지 않는다.
 */
export function estimateChanged(invoice: EstimateSnapshot, current: EstimateSnapshot | null): boolean {
  if (!current || invoice.estimatedAmount === null || current.estimatedAmount === null) return false;
  return invoice.estimatedAmount !== current.estimatedAmount || invoice.billableCount !== current.billableCount;
}

interface MonthRow {
  estimatedAmount: number | null;
  invoice: { totalAmount: number; paidAmount: number; balance: number } | null;
}

export interface MonthSummary {
  /** 확정 전 과목은 예상액, 확정한 과목은 확정 합계로 본 이번 달 예상 교육비 */
  expected: number;
  confirmed: number;
  paid: number;
  unpaid: number;
  unconfirmedCount: number;
}

export function summarizeMonth(rows: readonly MonthRow[]): MonthSummary {
  return rows.reduce<MonthSummary>(
    (sum, row) => ({
      expected: sum.expected + (row.invoice ? row.invoice.totalAmount : (row.estimatedAmount ?? 0)),
      confirmed: sum.confirmed + (row.invoice?.totalAmount ?? 0),
      paid: sum.paid + (row.invoice?.paidAmount ?? 0),
      unpaid: sum.unpaid + Math.max(row.invoice?.balance ?? 0, 0),
      unconfirmedCount: sum.unconfirmedCount + (row.invoice ? 0 : 1),
    }),
    { expected: 0, confirmed: 0, paid: 0, unpaid: 0, unconfirmedCount: 0 },
  );
}
