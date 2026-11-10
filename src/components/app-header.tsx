import Link from "next/link";
import { signOutAction } from "@/features/auth/actions";
import { isAutoLoginEnabled } from "@/lib/auto-login";
import { ROUTES } from "@/lib/routes";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-panel backdrop-blur-lg">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4 lg:max-w-none lg:px-6">
        <Link href={ROUTES.home} className="flex items-center gap-2 font-display text-[length:calc(22px+var(--fs-up))]">
          <span aria-hidden>🏡</span>
          Family Hub
        </Link>
        {/* 자동 로그인 모드에서는 로그아웃해도 바로 다시 로그인되므로 버튼을 두지 않는다 */}
        {!isAutoLoginEnabled() && (
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-full px-3 py-2 text-sm font-bold text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            로그아웃
          </button>
        </form>
        )}
      </div>
    </header>
  );
}
