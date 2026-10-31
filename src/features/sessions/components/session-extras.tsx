"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { IDLE, type FormState } from "@/lib/form-state";
import { setMakeupWaivedAction, updateSessionNoteAction } from "../actions";

interface SessionRef {
  id: string;
  version: number;
}

/** 결석·휴강했지만 보강을 하지 않을 때 */
export function WaiveMakeupForm({ id, version, waived }: SessionRef & { waived: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setMakeupWaivedAction, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="waived" value={waived ? "false" : "true"} />
      <Button type="submit" variant="secondary" pending={pending}>
        {waived ? "다시 보강 대기에 올리기" : "보강 안 함"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function SessionNoteForm({ id, version, note }: SessionRef & { note: string | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateSessionNoteAction, IDLE);
  const fieldError = state.status === "error" ? state.fieldErrors?.note : undefined;
  const value = state.status === "error" ? state.values?.note : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        메모
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          placeholder="예: 감기로 결석, 학원에 연락함"
          defaultValue={value ?? note ?? ""}
          aria-invalid={fieldError ? true : undefined}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-base font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      {fieldError ? <p className="text-sm text-danger">{fieldError}</p> : null}
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" pending={pending}>
        메모 저장
      </Button>
    </form>
  );
}
