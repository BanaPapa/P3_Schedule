import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { HistoryList } from "@/features/history/components/history-list";
import { getHistory } from "@/features/history/queries";

export const metadata: Metadata = { title: "변경 이력" };

const HISTORY_LIMIT = 100;

async function HistoryContent() {
  await connection();
  const items = await getHistory(HISTORY_LIMIT);
  return (
    <Card description="부모 두 사람이 바꾼 내용이 최근 것부터 쌓입니다.">
      <HistoryList items={items} now={new Date()} />
    </Card>
  );
}

export default function HistoryPage() {
  return (
    <>
      <h1 className="text-xl font-bold">변경 이력</h1>
      <Suspense fallback={<CardSkeleton />}>
        <HistoryContent />
      </Suspense>
    </>
  );
}
