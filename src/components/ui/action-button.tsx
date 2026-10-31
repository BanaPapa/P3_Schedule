"use client";

import { useActionState, type FormEvent } from "react";
import { IDLE, type FormState } from "@/lib/form-state";
import { Button } from "./button";
import { FormMessage } from "./form-message";

interface ActionButtonProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** 숨은 입력으로 보낼 값 */
  fields: Record<string, string | number>;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  /** 있으면 누를 때 한 번 더 묻는다 */
  confirmText?: string;
  className?: string;
}

/** 버튼 하나로 서버 액션을 부르는 작은 폼 (삭제, 취소, 예상액으로 맞추기 등) */
export function ActionButton({ action, fields, label, variant = "secondary", confirmText, className }: ActionButtonProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, IDLE);

  function confirmSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmText && !window.confirm(confirmText)) event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={confirmSubmit} className={`flex flex-col gap-2 ${className ?? ""}`}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant={variant} pending={pending} className="h-9 px-3 text-sm">
        {label}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
