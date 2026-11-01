import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const TABS = [
  { key: "academy", label: "학원", href: ROUTES.education },
  { key: "school", label: "학교", href: ROUTES.school },
  { key: "study", label: "학습", href: ROUTES.study },
] as const;

/** 교육 탭 안의 학원·학교·학습 */
export function EducationTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="교육 메뉴" className="flex rounded-full border border-border bg-surface p-0.5">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={`flex-1 rounded-full py-2 text-center text-sm font-semibold ${tab.key === current ? "bg-primary text-primary-foreground" : "text-muted"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
