import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/ui/card";
import { CreateFamilyForm } from "@/features/family/components/create-family-form";
import { getFamilyContext } from "@/features/family/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "가족 만들기" };

async function OnboardingContent() {
  const context = await getFamilyContext();
  if (context) redirect(ROUTES.home);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <CreateFamilyForm />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold">가족 만들기</h1>
        <p className="mt-1 text-sm text-muted">
          가족을 만든 뒤 배우자를 초대하면 일정과 교육비를 함께 관리할 수 있습니다.
        </p>
      </div>
      <Suspense fallback={<CardSkeleton />}>
        <OnboardingContent />
      </Suspense>
      <p className="text-sm text-muted">
        배우자에게 초대 링크를 받으셨나요? 가족을 만들지 말고 받은 링크를 열어 주세요.
      </p>
    </main>
  );
}
