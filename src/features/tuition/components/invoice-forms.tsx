"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { formatWon } from "@/lib/money";
import { addItemAction, addPaymentAction, adjustInvoiceAction, confirmInvoiceAction } from "../actions";
import { MAX_INVOICE_ITEMS } from "../schemas";

const SMALL_INPUT =
  "h-11 min-w-0 rounded-xl border-[1.5px] border-border-strong bg-surface px-3 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft";

interface ItemRow {
  key: number;
}

let nextItemKey = 0;

function KindSelect({ name, label }: { name: string; label: string }) {
  return (
    <select name={name} aria-label={label} className={SMALL_INPUT}>
      <option value="extra">추가</option>
      <option value="discount">할인</option>
    </select>
  );
}

interface ConfirmFormProps {
  enrollmentId: string;
  /** "YYYY-MM-01" */
  month: string;
  estimatedAmount: number | null;
}

/** 그 달 청구 확정. 금액을 비우면 예상액으로 확정한다. */
export function ConfirmForm({ enrollmentId, month, estimatedAmount }: ConfirmFormProps) {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await confirmInvoiceAction(prev, formData);
    if (result.status === "success") setRows([]);
    return result;
  }, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="month" value={month} />
      <TextField
        label="기본 청구액 (원)"
        name="baseAmount"
        inputMode="numeric"
        placeholder={estimatedAmount === null ? "학원 안내 금액" : estimatedAmount.toLocaleString("ko-KR")}
        hint={estimatedAmount === null ? undefined : `비워 두면 예상액 ${formatWon(estimatedAmount)}으로 확정합니다.`}
        defaultValue={values?.baseAmount ?? ""}
        error={fieldErrors?.baseAmount}
      />
      <TextField
        label="메모 (선택)"
        name="reason"
        maxLength={200}
        placeholder="예: 학원 문자 안내 금액"
        defaultValue={values?.reason ?? ""}
        error={fieldErrors?.reason}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">추가·할인 (선택)</legend>
        {rows.map((row, index) => (
          <div key={row.key} className="grid grid-cols-[4.5rem_1fr_7rem_auto] items-center gap-2">
            <KindSelect name="itemKind" label={`${index + 1}번째 항목 종류`} />
            <input name="itemLabel" aria-label={`${index + 1}번째 항목 이름`} placeholder="교재비" maxLength={50} className={SMALL_INPUT} />
            <input name="itemAmount" aria-label={`${index + 1}번째 항목 금액`} inputMode="numeric" placeholder="20,000" className={SMALL_INPUT} />
            <button
              type="button"
              aria-label={`${index + 1}번째 항목 삭제`}
              onClick={() => setRows(rows.filter((item) => item.key !== row.key))}
              className="size-9 rounded-lg text-muted hover:text-danger"
            >
              ✕
            </button>
          </div>
        ))}
        {fieldErrors?.items ? <p className="text-sm text-danger">{fieldErrors.items}</p> : null}
        {rows.length < MAX_INVOICE_ITEMS ? (
          <button
            type="button"
            onClick={() => setRows([...rows, { key: ++nextItemKey }])}
            className="self-start px-1 py-1 text-sm font-semibold text-primary"
          >
            + 항목 추가
          </button>
        ) : null}
      </fieldset>
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? "확정 중…" : "이 달 청구 확정"}
      </Button>
    </form>
  );
}

interface InvoiceRef {
  invoiceId: string;
  version: number;
}

/** 확정액을 사용자가 고른 금액으로 바꾼다. 비우면 지금 예상액으로 맞춘다. */
export function AdjustForm({ invoiceId, version, estimatedAmount }: InvoiceRef & { estimatedAmount: number | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(adjustInvoiceAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="version" value={version} />
      <TextField
        label="새 기본 청구액 (원)"
        name="baseAmount"
        inputMode="numeric"
        hint={estimatedAmount === null ? undefined : `비워 두면 지금 예상액 ${formatWon(estimatedAmount)}으로 맞춥니다.`}
        error={fieldErrors?.baseAmount}
      />
      <TextField label="조정 사유 (선택)" name="reason" maxLength={200} placeholder="예: 1회 휴강 반영" error={fieldErrors?.reason} />
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" pending={pending}>
        확정액 조정
      </Button>
    </form>
  );
}

export function ItemForm({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addItemAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid grid-cols-[4.5rem_1fr_7rem] items-center gap-2">
        <KindSelect name="kind" label="항목 종류" />
        <input name="label" aria-label="항목 이름" placeholder="교재비" maxLength={50} className={SMALL_INPUT} />
        <input name="amount" aria-label="항목 금액" inputMode="numeric" placeholder="20,000" className={SMALL_INPUT} />
      </div>
      {fieldErrors?.label || fieldErrors?.amount ? (
        <p className="text-sm text-danger">항목 이름과 금액을 확인해 주세요.</p>
      ) : null}
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" pending={pending}>
        항목 추가
      </Button>
    </form>
  );
}

export function PaymentForm({ invoiceId, today, balance }: { invoiceId: string; today: string; balance: number }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addPaymentAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="납부일"
          name="paidOn"
          type="date"
          required
          defaultValue={values?.paidOn ?? today}
          error={fieldErrors?.paidOn}
        />
        <TextField
          label="금액 (원)"
          name="amount"
          inputMode="numeric"
          required
          defaultValue={values?.amount ?? (balance > 0 ? balance.toLocaleString("ko-KR") : "")}
          error={fieldErrors?.amount}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="방법 (선택)" name="method" maxLength={30} placeholder="카드, 계좌이체" defaultValue={values?.method ?? ""} />
        <TextField label="메모 (선택)" name="memo" maxLength={200} defaultValue={values?.memo ?? ""} />
      </div>
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        납부 기록
      </Button>
    </form>
  );
}
