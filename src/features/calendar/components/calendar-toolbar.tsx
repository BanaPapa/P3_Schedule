import Link from "next/link";
import { formatDayLabel, formatMonthLabel, monthOf, weekDates } from "@/lib/dates";
import { calendarHref, shiftCalendar, type CalendarParams } from "../params";

interface ChildOption {
  id: string;
  name: string;
  color: string;
}

interface CalendarToolbarProps {
  params: CalendarParams;
  today: string;
  childOptions: ChildOption[];
}

function title(params: CalendarParams): string {
  if (params.view === "month") return formatMonthLabel(monthOf(params.date));
  const days = weekDates(params.date);
  return `${formatDayLabel(days[0])} – ${formatDayLabel(days[6])}`;
}

const PILL = "rounded-full px-3 py-1.5 text-sm font-medium";

export function CalendarToolbar({ params, today, childOptions }: CalendarToolbarProps) {
  const href = (next: Partial<CalendarParams>) => calendarHref({ ...params, ...next }, today);
  const unit = params.view === "month" ? "달" : "주";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={calendarHref(shiftCalendar(params, -1), today)}
          aria-label={`이전 ${unit}`}
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface"
        >
          ‹
        </Link>
        <h2 className="text-center text-base font-semibold" aria-live="polite">
          {title(params)}
        </h2>
        <Link
          href={calendarHref(shiftCalendar(params, 1), today)}
          aria-label={`다음 ${unit}`}
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface"
        >
          ›
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-full border border-border bg-surface p-0.5" role="group" aria-label="보기">
          {(["month", "week"] as const).map((view) => (
            <Link
              key={view}
              href={href({ view })}
              aria-current={params.view === view ? "true" : undefined}
              className={`${PILL} ${params.view === view ? "bg-primary text-primary-foreground" : "text-muted"}`}
            >
              {view === "month" ? "월간" : "주간"}
            </Link>
          ))}
        </div>
        {params.date !== today ? (
          <Link href={href({ date: today })} className={`${PILL} border border-border bg-surface`}>
            오늘
          </Link>
        ) : null}
      </div>

      {childOptions.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="자녀 선택">
          <Link
            href={href({ childId: null })}
            aria-current={params.childId === null ? "true" : undefined}
            className={`${PILL} shrink-0 border ${params.childId === null ? "border-foreground" : "border-border text-muted"}`}
          >
            전체
          </Link>
          {childOptions.map((child) => (
            <Link
              key={child.id}
              href={href({ childId: child.id })}
              aria-current={params.childId === child.id ? "true" : undefined}
              className={`${PILL} flex shrink-0 items-center gap-1.5 border ${params.childId === child.id ? "border-foreground" : "border-border text-muted"}`}
            >
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: child.color }} />
              {child.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
