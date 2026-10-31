import Link from "next/link";
import { addMonths, formatMonthLabel, formatMonthParam, type YearMonth } from "@/lib/dates";

interface MonthNavProps {
  month: YearMonth;
  /** "YYYY-MM" 을 받아 그 달 주소를 만든다 */
  hrefFor: (month: string) => string;
}

const ARROW = "flex size-10 items-center justify-center rounded-xl border border-border bg-surface";

export function MonthNav({ month, hrefFor }: MonthNavProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={hrefFor(formatMonthParam(addMonths(month, -1)))} aria-label="이전 달" className={ARROW}>
        ‹
      </Link>
      <h2 className="text-base font-semibold" aria-live="polite">
        {formatMonthLabel(month)}
      </h2>
      <Link href={hrefFor(formatMonthParam(addMonths(month, 1)))} aria-label="다음 달" className={ARROW}>
        ›
      </Link>
    </div>
  );
}
