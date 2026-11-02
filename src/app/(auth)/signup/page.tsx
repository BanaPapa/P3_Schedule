import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/auth-form";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <>
      <h1 className="page-title mb-1">회원가입</h1>
      <p className="mb-4 text-sm text-muted">부모 각자 자신의 이메일로 가입합니다.</p>
      <AuthForm mode="signup" />
    </>
  );
}
