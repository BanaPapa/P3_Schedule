import Link from "next/link";
import { signOutAction } from "@/features/auth/actions";
import { ROUTES } from "@/lib/routes";

const NAV = [
  { href: ROUTES.home, label: "홈" },
  { href: ROUTES.family, label: "가족" },
] as const;

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <Link href={ROUTES.home} className="text-base font-bold">
          Family Hub
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 font-medium text-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
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
