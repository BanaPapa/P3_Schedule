"use client";

import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** 화면을 그리다 실패했을 때. 서버 오류 내용은 보여 주지 않는다(로그에 남는다). */
export default function AppError({ reset }: ErrorPageProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-10 text-center">
      <p className="text-lg font-semibold">화면을 불러오지 못했습니다</p>
      <p className="text-sm text-muted">잠시 후 다시 시도해 주세요. 계속되면 앱을 다시 열어 주세요.</p>
      <Button type="button" onClick={reset}>
        다시 시도
      </Button>
    </div>
  );
}
