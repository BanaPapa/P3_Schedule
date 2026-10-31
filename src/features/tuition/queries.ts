import "server-only";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { getEnrollments, type Enrollment } from "@/features/education/queries";

type Enums = Database["public"]["Enums"];
export type TuitionMethod = Enums["tuition_method"];

export interface Estimate {
  policyId: string | null;
  method: TuitionMethod | null;
  unitAmount: number | null;
  paymentDay: number | null;
  sessionCount: number;
  billableCount: number;
  estimatedAmount: number | null;
}

export interface InvoiceSummary {
  id: string;
  version: number;
  method: TuitionMethod;
  unitAmount: number | null;
  sessionCount: number;
  billableCount: number;
  estimatedAmount: number | null;
  baseAmount: number;
  adjustmentReason: string | null;
  extraAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  confirmedAt: string;
}

export interface TuitionRow {
  enrollment: Enrollment;
  estimate: Estimate;
  invoice: InvoiceSummary | null;
}

export interface InvoiceItem {
  id: string;
  kind: Enums["tuition_item_kind"];
  label: string;
  amount: number;
}

export interface Payment {
  id: string;
  paidOn: string;
  amount: number;
  method: string | null;
  memo: string | null;
}

export interface Policy {
  id: string;
  effectiveMonth: string;
  method: TuitionMethod;
  monthlyAmount: number | null;
  perSessionAmount: number | null;
  absentBillable: boolean;
  academyCancelledBillable: boolean;
  paymentDay: number | null;
  memo: string | null;
}

export interface BreakdownSession {
  id: string;
  date: string;
  startTime: string;
  kind: Enums["class_session_kind"];
  status: Enums["class_session_status"];
  billable: boolean;
}

function loadFailed(what: string, code: string | undefined): never {
  logger.error(`failed to load ${what}`, { code });
  throw new Error("교육비 정보를 불러오지 못했습니다.");
}

type EstimateRow = Database["public"]["Functions"]["tuition_estimates"]["Returns"][number];
type SummaryRow = Database["public"]["Views"]["tuition_invoice_summaries"]["Row"];

function toEstimate(row: EstimateRow | undefined): Estimate {
  return {
    policyId: row?.policy_id ?? null,
    method: row?.method ?? null,
    unitAmount: row?.unit_amount ?? null,
    paymentDay: row?.payment_day ?? null,
    sessionCount: row?.session_count ?? 0,
    billableCount: row?.billable_count ?? 0,
    estimatedAmount: row?.estimated_amount ?? null,
  };
}

function toInvoice(row: SummaryRow): InvoiceSummary {
  return {
    id: row.id as string,
    version: row.version as number,
    method: row.method as TuitionMethod,
    unitAmount: row.unit_amount,
    sessionCount: row.session_count as number,
    billableCount: row.billable_count as number,
    estimatedAmount: row.estimated_amount,
    baseAmount: row.base_amount as number,
    adjustmentReason: row.adjustment_reason,
    extraAmount: row.extra_amount ?? 0,
    discountAmount: row.discount_amount ?? 0,
    totalAmount: row.total_amount ?? 0,
    paidAmount: row.paid_amount ?? 0,
    balance: row.balance ?? 0,
    confirmedAt: row.confirmed_at as string,
  };
}

/** 그 달에 수강 중인 과목마다 예상액과 확정 청구서 */
export async function getTuitionMonth(month: string): Promise<TuitionRow[]> {
  const supabase = await createClient();
  const [enrollments, estimates, invoices] = await Promise.all([
    getEnrollments(),
    supabase.rpc("tuition_estimates", { p_month: month }),
    supabase.from("tuition_invoice_summaries").select("*").eq("billing_month", month),
  ]);
  if (estimates.error) loadFailed("tuition estimates", estimates.error.code);
  if (invoices.error) loadFailed("invoices", invoices.error.code);

  const estimateById = new Map(estimates.data.map((row) => [row.enrollment_id, row]));
  const invoiceById = new Map(invoices.data.map((row) => [row.enrollment_id, row]));

  return enrollments
    .filter((enrollment) => estimateById.has(enrollment.id) || invoiceById.has(enrollment.id))
    .map((enrollment) => {
      const invoice = invoiceById.get(enrollment.id);
      return {
        enrollment,
        estimate: toEstimate(estimateById.get(enrollment.id)),
        invoice: invoice ? toInvoice(invoice) : null,
      };
    })
    .sort(
      (a, b) =>
        a.enrollment.academy.name.localeCompare(b.enrollment.academy.name, "ko") ||
        a.enrollment.child.name.localeCompare(b.enrollment.child.name, "ko"),
    );
}

export interface TuitionDetail extends TuitionRow {
  items: InvoiceItem[];
  payments: Payment[];
  breakdown: BreakdownSession[];
}

export async function getTuitionDetail(enrollmentId: string, month: string): Promise<TuitionDetail | null> {
  const rows = await getTuitionMonth(month);
  const enrollment = (await getEnrollments()).find((item) => item.id === enrollmentId);
  if (!enrollment) return null;
  const row = rows.find((item) => item.enrollment.id === enrollmentId) ?? {
    enrollment,
    estimate: toEstimate(undefined),
    invoice: null,
  };

  const supabase = await createClient();
  const invoiceId = row.invoice?.id ?? "00000000-0000-0000-0000-000000000000";
  const [items, payments, breakdown] = await Promise.all([
    supabase.from("tuition_invoice_items").select("id, kind, label, amount").eq("invoice_id", invoiceId).order("created_at"),
    supabase
      .from("tuition_payments")
      .select("id, paid_on, amount, method, memo")
      .eq("invoice_id", invoiceId)
      .order("paid_on"),
    supabase.rpc("tuition_session_breakdown", { p_enrollment_id: enrollmentId, p_month: month }),
  ]);
  if (items.error) loadFailed("invoice items", items.error.code);
  if (payments.error) loadFailed("payments", payments.error.code);
  if (breakdown.error) loadFailed("session breakdown", breakdown.error.code);

  return {
    ...row,
    items: items.data,
    payments: payments.data.map((payment) => ({
      id: payment.id,
      paidOn: payment.paid_on,
      amount: payment.amount,
      method: payment.method,
      memo: payment.memo,
    })),
    breakdown: breakdown.data.map((session) => ({
      id: session.session_id,
      date: session.session_date,
      startTime: session.start_time,
      kind: session.kind,
      status: session.status,
      billable: session.billable,
    })),
  };
}

/** 과목의 요금 정책 이력 (최근 것부터) */
export async function getPolicies(enrollmentId: string): Promise<Policy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tuition_policies")
    .select(
      "id, effective_month, method, monthly_amount, per_session_amount, absent_billable, academy_cancelled_billable, payment_day, memo",
    )
    .eq("enrollment_id", enrollmentId)
    .order("effective_month", { ascending: false });
  if (error) loadFailed("tuition policies", error.code);
  return data.map((row) => ({
    id: row.id,
    effectiveMonth: row.effective_month,
    method: row.method,
    monthlyAmount: row.monthly_amount,
    perSessionAmount: row.per_session_amount,
    absentBillable: row.absent_billable,
    academyCancelledBillable: row.academy_cancelled_billable,
    paymentDay: row.payment_day,
    memo: row.memo,
  }));
}
