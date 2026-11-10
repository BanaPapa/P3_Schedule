import Link from "next/link";
import { CALENDAR_WEEKDAYS, formatDayLabel, monthGrid, monthOf, WEEKDAY_LABELS } from "@/lib/dates";
import { calendarHref, type CalendarParams } from "../params";
import type { CalendarSession } from "../queries";

interface MonthGridProps {
  params: CalendarParams;
  today: string;
  sessionsByDate: Map<string, CalendarSession[]>;
  /** 여행 중인 날 */
  tripDates: Set<string>;
  /** 학교 일정이 있는 날 */
  schoolDates: Set<string>;
}

const MAX_DOTS = 3;

export function MonthGrid({ params, today, sessionsByDate, tripDates, schoolDates }: MonthGridProps) {
  const month = monthOf(params.date);
  const weeks = monthGrid(month);

  return (
    <div className="rounded-2xl border border-border bg-surface p-2 shadow-soft">
      <div className="grid grid-cols-7 pb-1 text-center text-xs font-extrabold text-muted" aria-hidden>
        {CALENDAR_WEEKDAYS.map((day) => (
          <span key={day} className={day === 7 ? "text-danger" : ""}>
            {WEEKDAY_LABELS[day]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {weeks.flat().map((date) => {
          const sessions = sessionsByDate.get(date) ?? [];
          const inMonth = monthOf(date).month === month.month;
          const selected = date === params.date;
          const onTrip = tripDates.has(date);
          const label = `${formatDayLabel(date)}, 수업 ${sessions.length}개${onTrip ? ", 여행" : ""}${schoolDates.has(date) ? ", 학교 일정" : ""}`;
          return (
            <Link
              key={date}
              href={calendarHref({ ...params, date }, today)}
              aria-label={label}
              aria-current={selected ? "date" : undefined}
              scroll={false}
              className={`flex h-14 flex-col items-center gap-1 rounded-xl pt-1.5 ${selected ? "bg-primary-soft" : ""} ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-sm tabular-nums ${date === today ? "btn-primary font-extrabold" : ""}`}
              >
                {Number(date.slice(8))}
              </span>
              {onTrip ? <span aria-hidden className="h-1 w-6 rounded-full bg-peach" /> : null}
              {schoolDates.has(date) ? <span aria-hidden className="h-1 w-6 rounded-full bg-sky" /> : null}
              <span className="flex items-center gap-0.5" aria-hidden>
                {sessions.slice(0, MAX_DOTS).map((session) => (
                  <span
                    key={session.id}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: session.child.color }}
                  />
                ))}
                {sessions.length > MAX_DOTS ? (
                  <span className="text-[length:calc(10px+var(--fs-up))] leading-none text-muted">+{sessions.length - MAX_DOTS}</span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
