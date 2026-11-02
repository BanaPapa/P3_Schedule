import Link from "next/link";
import { signOutAction } from "@/features/auth/actions";
import { ROUTES } from "@/lib/routes";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <Link href={ROUTES.home} className="text-base font-bold">
          Family Hub
        </Link>
        <nav aria-label="계정" className="flex items-center gap-1 text-sm">
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 font-medium text-muted hover:text-foreground"
            >
              로그아웃
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
