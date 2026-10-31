import type { FormState } from "@/lib/form-state";

interface FormMessageProps {
  state: FormState;
}

/** 폼 전체 결과 메시지. 화면 낭독기가 바로 읽도록 role 을 준다. */
export function FormMessage({ state }: FormMessageProps) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-xl px-3 py-2 text-sm ${isError ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}
    >
      {state.message}
    </p>
  );
}
