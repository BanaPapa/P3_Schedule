"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, ERROR_MESSAGES } from "@/lib/errors";
import {
  conflict,
  failure,
  formValues,
  success,
  validationError,
  type FormState,
} from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireFamily } from "@/features/family/queries";
import {
  adjustFormSchema,
  invoiceRefSchema,
  itemFormSchema,
  parseConfirmForm,
  parsePolicyForm,
  paymentFormSchema,
  rowRefSchema,
} from "./schemas";

/** 청구서 RPC 가 읽은 뒤 다른 사람이 바꿨을 때 던지는 코드 */
const INVOICE_CONFLICT = "invoice_conflict";

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function dbFailure(action: string, error: PostgrestLikeError, values?: Record<string, string>): FormState {
  if (error.message === INVOICE_CONFLICT) return conflict();
  if (error.code !== "P0001") logger.error(`${action} failed`, { code: error.code });
  return failure(dbErrorMessage(error), values);
}

function refreshTuitionPages(): void {
  revalidatePath(ROUTES.tuition, "layout");
  revalidatePath(ROUTES.home);
}

export async function savePolicyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, [
    "effectiveMonth",
    "method",
    "monthlyAmount",
    "perSessionAmount",
    "paymentDay",
    "memo",
  ]);
  const parsed = parsePolicyForm(formData);
  if (!parsed.success) return validationError(parsed.error, values);

  const policy = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_tuition_policy", {
    p_enrollment_id: policy.enrollmentId,
    p_effective_month: policy.effectiveMonth,
    p_method: policy.method,
    // RPC 인자 타입은 non-null 이지만 SQL 은 고르지 않은 방식의 금액으로 null 을 받는다
    p_monthly_amount: policy.monthlyAmount as number,
    p_per_session_amount: policy.perSessionAmount as number,
    p_absent_billable: policy.absentBillable,
    p_academy_cancelled_billable: policy.academyCancelledBillable,
    p_payment_day: policy.paymentDay as number,
    p_memo: policy.memo as string,
  });
  if (error) return dbFailure("save_tuition_policy", error, values);

  refreshTuitionPages();
  return success("요금 정책을 저장했습니다. 확정하지 않은 달의 예상액에 바로 반영됩니다.");
}

export async function confirmInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["baseAmount", "reason"]);
  const parsed = parseConfirmForm(formData);
  if (!parsed.success) return validationError(parsed.error, values);

  const { enrollmentId, month, baseAmount, reason, items } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_invoice", {
    p_enrollment_id: enrollmentId,
    p_month: month,
    p_base_amount: baseAmount as number,
    p_reason: reason as string,
    p_items: items,
  });
  if (error) return dbFailure("confirm_invoice", error, values);

  refreshTuitionPages();
  return success("청구를 확정했습니다. 이제 일정이 바뀌어도 확정액은 그대로입니다.");
}

export async function adjustInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["invoiceId", "version", "baseAmount", "reason"]);
  const parsed = adjustFormSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_invoice", {
    p_invoice_id: parsed.data.invoiceId,
    p_version: parsed.data.version,
    p_base_amount: parsed.data.baseAmount as number,
    p_reason: parsed.data.reason as string,
  });
  refreshTuitionPages();
  if (error) return dbFailure("adjust_invoice", error, values);
  return success("확정액을 조정했습니다.");
}

export async function cancelInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = invoiceRefSchema.safeParse(formValues(formData, ["invoiceId", "version"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_invoice", {
    p_invoice_id: parsed.data.invoiceId,
    p_version: parsed.data.version,
  });
  refreshTuitionPages();
  if (error) return dbFailure("cancel_invoice", error);
  return success("확정을 취소했습니다.");
}

export async function addItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["invoiceId", "kind", "label", "amount"]);
  const parsed = itemFormSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const { error } = await supabase.from("tuition_invoice_items").insert({
    family_id: family.id,
    invoice_id: parsed.data.invoiceId,
    kind: parsed.data.kind,
    label: parsed.data.label,
    amount: parsed.data.amount,
  });
  if (error) return dbFailure("add_invoice_item", error, values);

  refreshTuitionPages();
  return success(`${parsed.data.label}을(를) 추가했습니다.`);
}

export async function deleteItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = rowRefSchema.safeParse(formValues(formData, ["id", "invoiceId"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tuition_invoice_items")
    .delete()
    .eq("id", parsed.data.id)
    .eq("invoice_id", parsed.data.invoiceId);
  if (error) return dbFailure("delete_invoice_item", error);

  refreshTuitionPages();
  return success("항목을 지웠습니다.");
}

export async function addPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["invoiceId", "paidOn", "amount", "method", "memo"]);
  const parsed = paymentFormSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const { error } = await supabase.from("tuition_payments").insert({
    family_id: family.id,
    invoice_id: parsed.data.invoiceId,
    paid_on: parsed.data.paidOn,
    amount: parsed.data.amount,
    method: parsed.data.method,
    memo: parsed.data.memo,
  });
  if (error) return dbFailure("add_payment", error, values);

  refreshTuitionPages();
  return success("납부를 기록했습니다.");
}

export async function deletePaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = rowRefSchema.safeParse(formValues(formData, ["id", "invoiceId"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tuition_payments")
    .delete()
    .eq("id", parsed.data.id)
    .eq("invoice_id", parsed.data.invoiceId);
  if (error) return dbFailure("delete_payment", error);

  refreshTuitionPages();
  return success("납부 기록을 지웠습니다.");
}
