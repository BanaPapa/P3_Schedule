"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { ROUTES, safeNextPath } from "@/lib/routes";
import { signInAction, signUpAction } from "../actions";

type Mode = "login" | "signup";

interface AuthFormProps {
  mode: Mode;
}

const COPY = {
  login: {
    submit: "로그인",
    pending: "로그인 중…",
    switchText: "처음이신가요?",
    switchLabel: "회원가입",
    switchHref: ROUTES.signup,
    passwordAutoComplete: "current-password",
    passwordHint: undefined,
  },
  signup: {
    submit: "가입하기",
    pending: "가입 중…",
    switchText: "이미 계정이 있으신가요?",
    switchLabel: "로그인",
    switchHref: ROUTES.login,
    passwordAutoComplete: "new-password",
    passwordHint: "8자 이상",
  },
} as const;

/**
 * 로그인 후 돌아갈 경로(?next=)를 주소창에서 읽는다.
 * 페이지에서 searchParams 를 읽으면 폼이 스트리밍으로 늦게 바뀌면서 입력값이 사라질 수 있어,
 * 페이지는 정적으로 두고 제출·이동하는 순간에만 읽는다.
 */
function currentNextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return safeNextPath(next, "") || null;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const copy = COPY[mode];
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const next = currentNextPath();
      if (next) formData.set("next", next);
      return (mode === "login" ? signInAction : signUpAction)(prev, formData);
    },
    IDLE,
  );
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  function switchMode(event: MouseEvent<HTMLAnchorElement>) {
    const next = currentNextPath();
    if (!next) return;
    event.preventDefault();
    router.push(`${copy.switchHref}?next=${encodeURIComponent(next)}`);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextField
        label="이메일"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={values?.email}
        error={fieldErrors?.email}
      />
      <TextField
        label="비밀번호"
        name="password"
        type="password"
        autoComplete={copy.passwordAutoComplete}
        required
        hint={copy.passwordHint}
        error={fieldErrors?.password}
      />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? copy.pending : copy.submit}
      </Button>
      <p className="text-center text-sm text-muted">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} onClick={switchMode} className="font-semibold text-primary">
          {copy.switchLabel}
        </Link>
      </p>
    </form>
  );
}
