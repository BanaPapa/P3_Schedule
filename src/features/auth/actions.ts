"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/errors";
import { requestOrigin } from "@/lib/invite-url";
import { failure, formValues, success, validationError, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { ROUTES, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "./schemas";

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return validationError(parsed.error, values);

  const next = safeNextPath(formData.get("next")?.toString(), ROUTES.onboarding);
  // 메일 확인을 켠 운영 환경: 확인 링크(/auth/confirm)가 로그인 후 next(예: 초대 화면)로 보낸다
  const origin = requestOrigin(await headers(), process.env.NEXT_PUBLIC_SITE_URL);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}${ROUTES.authConfirm}?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    if (!error.code) logger.error("sign up failed", { status: error.status });
    return failure(authErrorMessage(error), values);
  }

  // 이메일 인증을 켠 환경에서는 세션 없이 돌아온다
  if (!data.session) {
    return success("가입 확인 메일을 보냈습니다. 메일의 링크를 누르면 바로 로그인됩니다.");
  }

  redirect(next);
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (!error.code) logger.error("sign in failed", { status: error.status });
    return failure(authErrorMessage(error), values);
  }

  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) logger.error("sign out failed", { code: error.code });
  redirect(ROUTES.login);
}
