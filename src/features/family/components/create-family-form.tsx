"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { createFamilyAction } from "../actions";

export function CreateFamilyForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createFamilyAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextField
        label="가족 이름"
        name="familyName"
        placeholder="예: 김씨네"
        maxLength={50}
        required
        defaultValue={values?.familyName}
        error={fieldErrors?.familyName}
      />
      <TextField
        label="나의 호칭"
        name="displayName"
        placeholder="예: 아빠"
        hint="배우자와 변경 이력에 이 이름으로 표시됩니다."
        maxLength={30}
        required
        defaultValue={values?.displayName}
        error={fieldErrors?.displayName}
      />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? "만드는 중…" : "가족 만들기"}
      </Button>
    </form>
  );
}
