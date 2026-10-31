"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { createAcademyAction, updateAcademyAction } from "../actions";
import type { Academy } from "../queries";

interface AcademyFormProps {
  /** 없으면 새 학원 등록, 있으면 그 학원 수정 */
  academy?: Academy;
  onResult?: (state: FormState) => void;
  onCancel?: () => void;
}

export function AcademyForm({ academy, onResult, onCancel }: AcademyFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    academy ? updateAcademyAction : createAcademyAction,
    IDLE,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  useEffect(() => {
    if (state.status !== "idle") onResult?.(state);
  }, [state, onResult]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {academy ? (
        <>
          <input type="hidden" name="id" value={academy.id} />
          <input type="hidden" name="version" value={academy.version} />
        </>
      ) : null}
      <TextField
        label="학원 이름"
        name="name"
        placeholder="예: 튼튼영어"
        maxLength={50}
        required
        defaultValue={values?.name ?? academy?.name}
        error={fieldErrors?.name}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="전화번호 (선택)"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="02-123-4567"
          maxLength={30}
          defaultValue={values?.phone ?? academy?.phone ?? ""}
          error={fieldErrors?.phone}
        />
        <TextField
          label="담당자 (선택)"
          name="contactName"
          placeholder="예: 김원장"
          maxLength={30}
          defaultValue={values?.contactName ?? academy?.contact_name ?? ""}
          error={fieldErrors?.contactName}
        />
      </div>
      <TextField
        label="메모 (선택)"
        name="memo"
        placeholder="예: 셔틀 4시 출발"
        maxLength={500}
        defaultValue={values?.memo ?? academy?.memo ?? ""}
        error={fieldErrors?.memo}
      />
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" pending={pending} className="flex-1">
          {pending ? "저장 중…" : academy ? "저장" : "학원 등록"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            닫기
          </Button>
        ) : null}
      </div>
    </form>
  );
}
