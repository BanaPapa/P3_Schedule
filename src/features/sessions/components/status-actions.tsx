"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { IDLE, type FormState } from "@/lib/form-state";
import { SESSION_STATUS_LABELS } from "@/features/education/format";
import { setSessionStatusAction } from "../actions";
import type { SessionKind, SessionStatus } from "../queries";

interface StatusActionsProps {
  id: string;
  version: number;
  kind: SessionKind;
  status: SessionStatus;
}

/** 회차 종류별로 고를 수 있는 상태 (DB set_session_status 와 같은 규칙) */
const CHOICES: Record<"makeup" | "other", readonly SessionStatus[]> = {
  makeup: ["makeup_scheduled", "makeup_completed", "cancelled"],
  other: ["scheduled", "completed", "absent", "academy_cancelled", "cancelled"],
};

const BUTTON_LABELS: Partial<Record<SessionStatus, string>> = {
  scheduled: "예정으로 되돌리기",
  makeup_scheduled: "보강 예정으로 되돌리기",
};

export function StatusActions({ id, version, kind, status }: StatusActionsProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setSessionStatusAction, IDLE);
  const choices = CHOICES[kind === "makeup" ? "makeup" : "other"].filter((choice) => choice !== status);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            type="submit"
            name="status"
            value={choice}
            disabled={pending}
            className="h-10 rounded-full border-[1.5px] border-border-strong bg-surface px-3 text-sm font-extrabold transition hover:bg-surface-2 active:scale-[0.97] disabled:opacity-50"
          >
            {BUTTON_LABELS[choice] ?? SESSION_STATUS_LABELS[choice]}
          </button>
        ))}
      </div>
      <FormMessage state={state} />
    </form>
  );
}
