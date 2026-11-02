import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNav, BottomNavView } from "@/components/bottom-nav";
import { RealtimeSync } from "@/features/sync/components/realtime-sync";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {/* 아래 탭 바(h-16)와 기기 하단 안전 영역만큼 띄운다. PC 에서는 왼쪽 메뉴(w-60) 옆에 둔다. */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:max-w-[63rem] lg:pb-10 lg:pl-[16rem]">
        {children}
      </main>
      {/* 동적 경로(/sessions/[id] 등)에서 주소는 요청 때 정해지므로 Suspense 안에서 읽는다 */}
      <Suspense fallback={<BottomNavView pathname={null} />}>
        <BottomNav />
      </Suspense>
      {/* 배우자가 바꾼 내용을 실시간으로 받아 화면을 새로 고친다 */}
      <Suspense fallback={null}>
        <RealtimeSync />
      </Suspense>
    </>
  );
}
