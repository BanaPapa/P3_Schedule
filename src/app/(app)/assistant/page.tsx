import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { aiMode, AI_MESSAGES } from "@/features/ai/claude";
import { ExtractPanel } from "@/features/ai/components/extract-panel";
import { requireFamily } from "@/features/family/queries";

export const metadata: Metadata = { title: "AI 도우미" };

async function AssistantContent() {
  await connection();
  const { children } = await requireFamily();
  if (aiMode() === "disabled") {
    return (
      <Card title="AI 도우미가 꺼져 있습니다">
        <p className="text-sm text-muted">{AI_MESSAGES.disabled}</p>
      </Card>
    );
  }
  return (
    <Card
      title="안내문에서 일정 찾기"
      description="가정통신문·알림장·학원 공지를 붙여 넣거나 찍어 올리면 일정 후보를 찾아 드립니다. 확인하고 고른 것만 등록됩니다."
    >
      {children.length === 0 ? (
        <p className="text-sm text-muted">먼저 가족 화면에서 자녀를 등록해 주세요.</p>
      ) : (
        <ExtractPanel childOptions={children.map(({ id, name }) => ({ id, name }))} />
      )}
    </Card>
  );
}

export default function AssistantPage() {
  return (
    <>
      <h1 className="page-title">AI 도우미</h1>
      <Suspense fallback={<CardSkeleton />}>
        <AssistantContent />
      </Suspense>
    </>
  );
}
