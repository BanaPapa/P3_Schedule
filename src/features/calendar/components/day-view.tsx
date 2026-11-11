import Link from "next/link";
import type { ReactNode } from "react";
import { formatDayLabel, formatTime, isoWeekday, WEEKDAY_LABELS, type IsoDate } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import type { CalendarSession } from "../queries";
import {
  dayOverlaps,
  INACTIVE_STATUSES,
  SAME_CHILD_OVERLAP_LABEL,
  sessionBadge,
  sessionLabel,
} from "../session-display";
import { childTone, toMinutes } from "../timetable";

interface StripDay {
  date: IsoDate;
  href: string;
}

interface DayStripProps {
  days: readonly StripDay[];
  selected: IsoDate;
  today: IsoDate;
  sessionsByDate: Map<string, CalendarSession[]>;
}

const MAX_DOTS = 3;

/** 휴대폰 주간 보기 위쪽: 월~일 요일 줄. 날짜 아래 점은 그날 수업이 있는 자녀 색 */
export function DayStrip({ days, selected, today, sessionsByDate }: DayStripProps) {
  return (
    <nav aria-label="요일 고르기" className="grid grid-cols-7 gap-1 rounded-2xl border border-border bg-surface p-1.5">
      {days.map(({ date, href }) => {
        const weekday = isoWeekday(date);
        const isSelected = date === selected;
        const isToday = date === today;
        const childColors = [...new Set((sessionsByDate.get(date) ?? []).map((session) => session.child.color))];
        return (
          <Link
            key={date}
            href={href}
            scroll={false}
            aria-current={isSelected ? "date" : undefined}
            aria-label={`${formatDayLabel(date)}${isToday ? " 오늘" : ""}`}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-colors ${isSelected ? "bg-foreground text-surface" : "hover:bg-surface-2"}`}
          >
            <span
              className={`text-xs ${isSelected ? "opacity-80" : weekday === 7 ? "text-danger" : "text-muted"}`}
            >
              {WEEKDAY_LABELS[weekday]}
            </span>
            <span
              className={`text-base font-bold tabular-nums ${!isSelected && isToday ? "text-primary" : ""}`}
            >
              {Number(date.slice(8))}
            </span>
            <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
              {childColors.slice(0, MAX_DOTS).map((color) => (
                <span key={color} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
              ))}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

interface DayAgendaProps {
  date: IsoDate;
  today: IsoDate;
  sessions: readonly CalendarSession[];
  showChild: boolean;
  /** 여행·학교 일정(종일) */
  allDay?: ReactNode;
}

function durationLabel(session: CalendarSession): string {
  const minutes = toMinutes(session.endTime) - toMinutes(session.startTime);
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}시간` : "", rest ? `${rest}분` : ""].filter(Boolean).join(" ");
}

/** 휴대폰 주간 보기 아래쪽: 고른 날의 수업을 시간 순으로. 왼쪽 시각, 오른쪽 자녀 색 카드 */
export function DayAgenda({ date, today, sessions, showChild, allDay }: DayAgendaProps) {
  const isToday = date === today;
  const overlaps = dayOverlaps(sessions);
  return (
    <section
      aria-label={`${formatDayLabel(date)}${isToday ? " 오늘" : ""}, 수업 ${sessions.length}개`}
      className="rounded-2xl border border-border bg-surface px-4 py-4"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-bold">
          {formatDayLabel(date)}
          {isToday ? <span className="ml-2 text-sm font-semibold text-primary">오늘</span> : null}
        </h3>
        <span className="text-sm text-muted">수업 {sessions.length}개</span>
      </div>

      {allDay}

      {sessions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">수업 없음</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {sessions.map((session) => {
            const tone = childTone(session.child.color);
            const inactive = INACTIVE_STATUSES.has(session.status);
            const badge = sessionBadge(session);
            const conflict = overlaps.sameChild.has(session.id);
            // 형제 동시 수업은 정상이라 조용히 알려만 준다(같은 자녀 겹침이 있으면 그쪽을 보인다)
            const concurrent = !conflict && overlaps.concurrent.has(session.id);
            return (
              <li key={session.id} className="grid grid-cols-[3.25rem_1fr] items-stretch gap-2">
                <div className="pt-2 text-right tabular-nums">
                  <p className="text-sm font-semibold">{formatTime(session.startTime)}</p>
                  <p className="text-xs text-faint">{formatTime(session.endTime)}</p>
                </div>
                <Link
                  href={ROUTES.session(session.id)}
                  aria-label={sessionLabel(session, showChild, conflict)}
                  className={`block rounded-lg border-l-4 px-3 py-2.5 transition-[filter] hover:brightness-[0.97] ${inactive ? "opacity-55" : ""}`}
                  style={{
                    backgroundColor: tone.background,
                    borderLeftColor: tone.accent,
                    color: tone.text,
                    boxShadow: conflict ? "inset 0 0 0 1px var(--danger)" : undefined,
                  }}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-bold ${inactive ? "line-through" : ""}`}>{session.academyName}</span>
                    {badge ? (
                      <span className="rounded-sm bg-surface/70 px-1.5 text-xs font-semibold">{badge}</span>
                    ) : null}
                    {conflict ? (
                      <span className="rounded-sm bg-danger px-1.5 text-xs font-semibold text-surface">
                        {SAME_CHILD_OVERLAP_LABEL}
                      </span>
                    ) : null}
                    {concurrent ? (
                      <span className="rounded-sm bg-surface/70 px-1.5 text-xs font-medium opacity-80">동시간</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm opacity-80">
                    {[showChild ? session.child.name : null, durationLabel(session)].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
