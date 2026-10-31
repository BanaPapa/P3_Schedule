"use server";

import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/errors";
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    if (!error.code) logger.error("sign up failed", { status: error.status });
    return failure(authErrorMessage(error), values);
  }

  // 이메일 인증을 켠 환경에서는 세션 없이 돌아온다
  if (!data.session) {
    return success("가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.");
  }

  redirect(safeNextPath(formData.get("next")?.toString(), ROUTES.onboarding));
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
