"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";

interface SlotFormProps {
  id: string;
  version: number;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaults: { date: string; startTime: string; endTime: string };
}

/** 날짜와 시간 하나를 고르는 폼. 이번만 변경과 보강 등록에 같이 쓴다. */
export function SlotForm({ id, version, action, submitLabel, defaults }: SlotFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <TextField
        label="날짜"
        name="date"
        type="date"
        required
        defaultValue={values?.date ?? defaults.date}
        error={fieldErrors?.date}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="시작"
          name="startTime"
          type="time"
          step={300}
          required
          defaultValue={values?.startTime ?? defaults.startTime}
          error={fieldErrors?.startTime}
        />
        <TextField
          label="끝"
          name="endTime"
          type="time"
          step={300}
          required
          defaultValue={values?.endTime ?? defaults.endTime}
          error={fieldErrors?.endTime}
        />
      </div>
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? "저장 중…" : submitLabel}
      </Button>
    </form>
  );
}
