import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNav, BottomNavView } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {/* 아래 탭 바(h-16)와 기기 하단 안전 영역만큼 띄운다 */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      {/* 동적 경로(/sessions/[id] 등)에서 주소는 요청 때 정해지므로 Suspense 안에서 읽는다 */}
      <Suspense fallback={<BottomNavView pathname={null} />}>
        <BottomNav />
      </Suspense>
    </>
  );
}
