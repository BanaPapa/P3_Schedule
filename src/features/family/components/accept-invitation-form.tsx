"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { acceptInvitationAction } from "../actions";

interface AcceptInvitationFormProps {
  code: string;
  familyName: string;
}

export function AcceptInvitationForm({ code, familyName }: AcceptInvitationFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    acceptInvitationAction,
    IDLE,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="code" value={code} />
      <TextField
        label="나의 호칭"
        name="displayName"
        placeholder="예: 엄마"
        maxLength={30}
        required
        defaultValue={values?.displayName}
        error={fieldErrors?.displayName}
      />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? "합류하는 중…" : `${familyName}에 합류하기`}
      </Button>
    </form>
  );
}
