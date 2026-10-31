import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/auth-form";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">로그인</h1>
      <AuthForm mode="login" />
    </>
  );
}
