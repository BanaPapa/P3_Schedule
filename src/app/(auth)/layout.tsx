import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p aria-hidden className="text-5xl">
          🏡
        </p>
        <p className="mt-3 font-display text-3xl">Family Hub</p>
        <p className="mt-1 text-sm text-muted">부부가 함께 보는 아이 일정과 교육비</p>
      </div>
      <div className="animate-rise rounded-2xl border border-border bg-surface p-6 shadow-lift">{children}</div>
    </main>
  );
}
