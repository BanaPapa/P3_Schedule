"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";

const TABS = [
  { href: ROUTES.home, label: "홈", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  {
    href: ROUTES.calendar,
    label: "캘린더",
    icon: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  },
  {
    href: ROUTES.education,
    label: "교육",
    icon: "M12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5",
  },
  {
    href: ROUTES.travel,
    label: "여행",
    icon: "M2 16l20-6-20-6 4 6zM6 10h8",
  },
  {
    href: ROUTES.costs,
    label: "비용",
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 9l2 6 2-4 2 4 2-6M7.5 12h9",
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === ROUTES.home) return pathname === href;
  // 교육비 화면은 비용 탭 아래에 있다
  if (href === ROUTES.costs) return pathname.startsWith(href) || pathname.startsWith(ROUTES.tuition);
  return pathname.startsWith(href);
}

/** 현재 탭 표시. 동적 경로에서는 주소를 읽기 전까지 표시 없이 그린다. */
export function BottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}

export function BottomNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid h-16 max-w-2xl grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname !== null && isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-xs font-medium ${active ? "text-primary" : "text-muted"}`}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
