"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { savePolicyAction } from "../actions";
import { METHOD_LABELS } from "../calc";
import type { Policy, TuitionMethod } from "../queries";

interface PolicyFormProps {
  enrollmentId: string;
  /** 지금 적용 중인 정책. 없으면 기본값으로 시작한다. */
  current: Policy | null;
  /** "YYYY-MM" */
  defaultMonth: string;
}

const METHOD_HINTS: Record<TuitionMethod, string> = {
  monthly: "매달 같은 금액",
  per_session: "청구 대상 수업 횟수 × 회당 금액",
  manual: "학원 안내 금액을 매달 직접 입력",
};

export function PolicyForm({ enrollmentId, current, defaultMonth }: PolicyFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(savePolicyAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const [method, setMethod] = useState<TuitionMethod>(
    (values?.method as TuitionMethod | undefined) ?? current?.method ?? "monthly",
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">계산 방식</legend>
        {(Object.keys(METHOD_LABELS) as TuitionMethod[]).map((option) => (
          <label key={option} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
            <input
              type="radio"
              name="method"
              value={option}
              checked={method === option}
              onChange={() => setMethod(option)}
              className="size-4 accent-primary"
            />
            <span>
              <span className="font-medium">{METHOD_LABELS[option]}</span>
              <span className="ml-2 text-sm text-muted">{METHOD_HINTS[option]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {method === "monthly" ? (
        <TextField
          label="월 수강료 (원)"
          name="monthlyAmount"
          inputMode="numeric"
          placeholder="300,000"
          defaultValue={values?.monthlyAmount ?? current?.monthlyAmount?.toLocaleString("ko-KR") ?? ""}
          error={fieldErrors?.monthlyAmount}
        />
      ) : null}
      {method === "per_session" ? (
        <TextField
          label="회당 수강료 (원)"
          name="perSessionAmount"
          inputMode="numeric"
          placeholder="40,000"
          defaultValue={values?.perSessionAmount ?? current?.perSessionAmount?.toLocaleString("ko-KR") ?? ""}
          error={fieldErrors?.perSessionAmount}
        />
      ) : null}
      {/* 회차별에서만 금액에 쓰이지만, 방식을 바꿔도 설정이 지워지지 않도록 항상 함께 보낸다 */}
      <fieldset hidden={method !== "per_session"} className="flex flex-col gap-2 rounded-xl bg-background p-3">
        <legend className="sr-only">청구 대상</legend>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="absentBillable"
            defaultChecked={current?.absentBillable ?? true}
            className="size-4 accent-primary"
          />
          결석한 수업도 청구 (이 경우 결석 보강은 무료)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="academyCancelledBillable"
            defaultChecked={current?.academyCancelledBillable ?? false}
            className="size-4 accent-primary"
          />
          학원 휴강도 청구 (이 경우 휴강 보강은 무료)
        </label>
        <p className="text-xs text-muted">청구하지 않은 수업의 보강은 그 보강을 청구합니다. 수업 1건은 한 번만 청구됩니다.</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="결제일 (선택)"
          name="paymentDay"
          inputMode="numeric"
          placeholder="예: 5"
          defaultValue={values?.paymentDay ?? current?.paymentDay?.toString() ?? ""}
          error={fieldErrors?.paymentDay}
        />
        <TextField
          label="적용 시작 월"
          name="effectiveMonth"
          type="month"
          required
          defaultValue={values?.effectiveMonth ?? defaultMonth}
          error={fieldErrors?.effectiveMonth}
        />
      </div>
      <TextField
        label="메모 (선택)"
        name="memo"
        maxLength={500}
        placeholder="예: 교재비 별도, 형제 할인 10%"
        defaultValue={values?.memo ?? current?.memo ?? ""}
        error={fieldErrors?.memo}
      />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? "저장 중…" : "요금 정책 저장"}
      </Button>
    </form>
  );
}
