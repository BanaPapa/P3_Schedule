import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/auth-form";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <>
      <h1 className="page-title mb-4">로그인</h1>
      <AuthForm mode="login" />
    </>
  );
}
