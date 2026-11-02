import Link from "next/link";
import { signOutAction } from "@/features/auth/actions";
import { ROUTES } from "@/lib/routes";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-panel backdrop-blur-lg">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4 lg:max-w-none lg:px-6">
        <Link href={ROUTES.home} className="flex items-center gap-2 font-display text-[22px]">
          <span aria-hidden>🏡</span>
          Family Hub
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-full px-3 py-2 text-sm font-bold text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
