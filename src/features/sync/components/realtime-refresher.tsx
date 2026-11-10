"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

interface RealtimeRefresherProps {
  familyId: string;
  userId: string;
  /** user_id → 호칭 */
  memberNames: Record<string, string>;
  /** 로그인 화면 없이 부부가 한 계정을 같이 쓰는 모드. 행위자로 배우자를 구분할 수 없다. */
  sharedAccount?: boolean;
}

/** 배우자 변경을 한데 모아 한 번만 새로 고친다 */
const REFRESH_DELAY_MS = 400;
const MAX_REFRESH_WAIT_MS = 2000;
const NOTICE_MS = 4000;
/** 같은 계정 모드: 이 화면에서 저장한 직후 들어온 이력은 내 변경으로 본다 */
const OWN_CHANGE_WINDOW_MS = 5000;

/**
 * 가족의 변경 이력(audit_logs) 추가를 실시간으로 받아 화면을 새로 고친다.
 * 내 변경은 서버 액션이 이미 새로 고치므로 배우자 변경일 때만 알림과 함께 새로 고친다.
 */
export function RealtimeRefresher({ familyId, userId, memberNames, sharedAccount = false }: RealtimeRefresherProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 새로 고칠 때마다 새 객체가 와도 구독을 다시 맺지 않도록 ref 로 읽는다
  const namesRef = useRef(memberNames);

  useEffect(() => {
    namesRef.current = memberNames;
  }, [memberNames]);

  useEffect(() => {
    const supabase = getBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let firstPendingAt: number | null = null;
    let lastSubmitAt = 0;

    function handleSubmit() {
      lastSubmitAt = Date.now();
    }
    if (sharedAccount) document.addEventListener("submit", handleSubmit, true);

    // 연결이 끊긴 사이의 변경을 놓치지 않도록 앱으로 돌아오면 한 번 새로 고친다
    function handleVisibility() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    function refreshNow() {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
      firstPendingAt = null;
      router.refresh();
    }

    function handleChange(payload: { new: Record<string, unknown> }) {
      const actorId = (payload.new.actor_id as string | null | undefined) ?? null;
      if (sharedAccount ? Date.now() - lastSubmitAt < OWN_CHANGE_WINDOW_MS : actorId === userId) return;

      // 변경이 계속 들어와도 너무 오래 미루지 않는다
      firstPendingAt ??= Date.now();
      if (Date.now() - firstPendingAt >= MAX_REFRESH_WAIT_MS) {
        refreshNow();
      } else {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(refreshNow, REFRESH_DELAY_MS);
      }

      const name = (actorId && namesRef.current[actorId]) || "가족";
      setNotice(
        sharedAccount
          ? "다른 기기에서 내용을 바꿔 화면을 새로 고쳤습니다."
          : `${name}님이 내용을 바꿔 화면을 새로 고쳤습니다.`,
      );
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    }

    async function subscribe() {
      // 브라우저 클라이언트는 세션을 늦게 읽는다. 토큰 없이 구독하면 익명으로 취급되어
      // RLS 때문에 거절되므로, 세션을 읽어 Realtime 에 토큰을 넘긴 뒤 구독한다.
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`family:${familyId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "audit_logs", filter: `family_id=eq.${familyId}` },
          handleChange,
        )
        .subscribe();
    }
    void subscribe();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("submit", handleSubmit, true);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [familyId, userId, sharedAccount, router]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md rounded-xl bg-foreground px-4 py-3 text-sm text-background shadow-lg"
    >
      {notice}
    </div>
  );
}
