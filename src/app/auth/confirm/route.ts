import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { ROUTES, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: readonly string[] = ["signup", "email", "invite", "magiclink", "recovery", "email_change"];

/**
 * 가입 확인 메일의 링크. 메일 템플릿이
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=… 로 보내면
 * 토큰을 확인해 로그인 쿠키를 만들고 next 로 보낸다. (로컬은 메일 확인이 꺼져 있어 쓰지 않는다)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"), ROUTES.onboarding);

  if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    logger.error("email confirmation failed", { code: error.code });
  }

  const login = new URL(ROUTES.login, request.url);
  login.searchParams.set("confirm", "failed");
  return NextResponse.redirect(login);
}
