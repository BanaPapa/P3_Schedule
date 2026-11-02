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
  {
    href: ROUTES.manage,
    label: "관리",
    icon: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === ROUTES.home) return pathname === href;
  if (href === ROUTES.education) {
    return [ROUTES.education, ROUTES.school, ROUTES.study].some((path) => pathname.startsWith(path));
  }
  // 교육비 화면은 비용 탭 아래에 있다
  if (href === ROUTES.costs) return pathname.startsWith(href) || pathname.startsWith(ROUTES.tuition);
  // 가족·자녀 화면은 관리 탭 아래에 있다
  if (href === ROUTES.manage) return pathname.startsWith(href) || pathname.startsWith(ROUTES.family);
  return pathname.startsWith(href);
}

/** 현재 탭 표시. 동적 경로에서는 주소를 읽기 전까지 표시 없이 그린다. */
export function BottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}

/** 휴대폰에서는 아래 탭 바, PC(lg 이상)에서는 왼쪽 메뉴로 보인다 */
export function BottomNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-panel pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:inset-x-auto lg:top-14 lg:left-0 lg:w-60 lg:border-t-0 lg:border-r lg:pb-0"
    >
      <ul className="mx-auto grid h-16 max-w-2xl grid-cols-6 px-1 lg:flex lg:h-auto lg:flex-col lg:gap-1 lg:p-3">
        {TABS.map((tab) => {
          const active = pathname !== null && isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`group flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-3 lg:text-[15px] ${active ? "text-primary lg:bg-primary-soft lg:font-extrabold" : "text-faint hover:text-muted lg:text-muted lg:hover:bg-surface-2"}`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-2xl transition lg:h-auto lg:w-auto ${active ? "bg-primary-soft lg:bg-transparent" : ""}`}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="size-[22px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={tab.icon} />
                  </svg>
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
