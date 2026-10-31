"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { addChildAction, updateChildAction } from "../actions";
import type { Child } from "../queries";
import { CHILD_COLORS } from "../schemas";

interface ChildFormProps {
  /** 없으면 새 자녀 등록, 있으면 그 자녀 수정 */
  child?: Child;
  /** 저장 결과를 부모에게 알린다. 수정 화면은 성공·충돌 때 편집을 닫는다. */
  onResult?: (state: FormState) => void;
  onCancel?: () => void;
}

export function ChildForm({ child, onResult, onCancel }: ChildFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    child ? updateChildAction : addChildAction,
    IDLE,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const selectedColor = values?.color ?? child?.color ?? CHILD_COLORS[0];

  useEffect(() => {
    if (state.status !== "idle") onResult?.(state);
  }, [state, onResult]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {child ? (
        <>
          <input type="hidden" name="id" value={child.id} />
          <input type="hidden" name="version" value={child.version} />
        </>
      ) : null}
      <TextField
        label="이름"
        name="name"
        placeholder="예: 첫째, 김하늘"
        maxLength={30}
        required
        defaultValue={values?.name ?? child?.name}
        error={fieldErrors?.name}
      />
      <TextField
        label="생년월일 (선택)"
        name="birthDate"
        type="date"
        defaultValue={values?.birthDate ?? child?.birth_date ?? ""}
        error={fieldErrors?.birthDate}
      />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">캘린더 색</legend>
        <div className="flex flex-wrap gap-2">
          {CHILD_COLORS.map((color) => (
            <label key={color} className="relative cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={color === selectedColor}
                className="peer sr-only"
                aria-label={`색 ${color}`}
              />
              <span
                className="block size-9 rounded-full border-2 border-transparent ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                style={{ backgroundColor: color }}
              />
            </label>
          ))}
        </div>
        {fieldErrors?.color ? <p className="text-sm text-danger">{fieldErrors.color}</p> : null}
      </fieldset>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" pending={pending} className="flex-1">
          {pending ? "저장 중…" : child ? "저장" : "자녀 등록"}
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
