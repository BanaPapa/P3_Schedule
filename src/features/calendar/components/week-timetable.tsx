import Link from "next/link";
import type { CSSProperties } from "react";
import { formatTime, isoWeekday, WEEKDAY_LABELS, type IsoDate } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import type { CalendarSession } from "../queries";
import { INACTIVE_STATUSES, sessionBadge, sessionLabel } from "../session-display";
import { childTone, hourRange, layoutDay } from "../timetable";
import { NowLine } from "./now-line";

interface WeekTimetableProps {
  dates: readonly IsoDate[];
  today: IsoDate;
  sessionsByDate: Map<string, CalendarSession[]>;
  showChild: boolean;
}

const WEEKEND = new Set([6, 7]);
/** 이보다 짧은 수업은 한 줄(이름 + 시작 시각)로 줄인다 */
const ONE_LINE_MINUTES = 40;

const hourHeight = (hours: number): CSSProperties => ({ height: `calc(var(--tt-hour) * ${hours})` });

interface BlockProps {
  session: CalendarSession;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  showChild: boolean;
}

function SessionBlock({ session, top, height, lane, lanes, showChild }: BlockProps) {
  const tone = childTone(session.child.color);
  const inactive = INACTIVE_STATUSES.has(session.status);
  const badge = sessionBadge(session);
  const label = sessionLabel(session, showChild);
  const oneLine = height < ONE_LINE_MINUTES;

  return (
    <Link
      href={ROUTES.session(session.id)}
      aria-label={label}
      title={label}
      className={`absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left leading-snug transition-[filter] hover:brightness-[0.97] ${inactive ? "opacity-55" : ""}`}
      style={{
        top: `calc(var(--tt-hour) * ${top / 60} + 1px)`,
        height: `calc(var(--tt-hour) * ${height / 60} - 2px)`,
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        backgroundColor: tone.background,
        borderLeftColor: tone.accent,
        color: tone.text,
      }}
    >
      <span className={`block truncate text-xs font-bold ${inactive ? "line-through" : ""}`}>
        {session.academyName}
        {oneLine ? (
          <span className="ml-1 font-medium tabular-nums opacity-80">{formatTime(session.startTime)}</span>
        ) : null}
      </span>
      {oneLine ? null : (
        <span className="block truncate text-[length:calc(11px+var(--fs-up))] tabular-nums opacity-80">
          {formatTime(session.startTime)}–{formatTime(session.endTime)}
        </span>
      )}
      {badge && !oneLine ? (
        <span className="mt-0.5 inline-block rounded-sm bg-surface/70 px-1 text-[length:calc(10px+var(--fs-up))] font-semibold">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * PC 주간 보기: 요일 × 시간 격자(Notion Calendar 식). 칸은 자녀 색의 연한 배경과 왼쪽 띠.
 * 칸이 좁아 자녀 이름은 글자로 쓰지 않는다(색과 위쪽 자녀 칩으로 구분, 낭독기·툴팁에는 이름 포함).
 * 주말은 수업이 있거나 오늘일 때만 보인다.
 */
export function WeekTimetable({ dates, today, sessionsByDate, showChild }: WeekTimetableProps) {
  const visibleDates = dates.filter(
    (date) => !WEEKEND.has(isoWeekday(date)) || date === today || (sessionsByDate.get(date)?.length ?? 0) > 0,
  );
  const sessions = visibleDates.flatMap((date) => sessionsByDate.get(date) ?? []);
  const { startHour, endHour } = hourRange(sessions);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const gridColumns = { gridTemplateColumns: `3rem repeat(${visibleDates.length}, minmax(0, 1fr))` };

  return (
    <div className="timetable rounded-2xl border border-border bg-surface px-3 pt-3 pb-4">
      <div className="grid border-b border-border pb-2" style={gridColumns}>
        <span aria-hidden />
        {visibleDates.map((date) => {
          const weekday = isoWeekday(date);
          const isToday = date === today;
          return (
            <div
              key={date}
              className={`flex items-center justify-center gap-1.5 text-sm ${weekday === 7 ? "text-danger" : isToday ? "text-foreground" : "text-muted"}`}
            >
              <span className={isToday ? "font-bold" : ""}>{WEEKDAY_LABELS[weekday]}</span>
              <span
                className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 tabular-nums ${isToday ? "bg-primary font-bold text-primary-foreground" : ""}`}
              >
                {Number(date.slice(8))}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid pt-3" style={gridColumns}>
        <div className="relative" style={hourHeight(hours.length)} aria-hidden>
          {hours.map((hour, index) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[length:calc(11px+var(--fs-up))] text-faint tabular-nums"
              style={{ top: `calc(var(--tt-hour) * ${index})` }}
            >
              {hour}:00
            </span>
          ))}
        </div>
        {visibleDates.map((date) => {
          const placed = layoutDay(sessionsByDate.get(date) ?? [], startHour);
          const isToday = date === today;
          return (
            <section
              key={date}
              aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 ${WEEKDAY_LABELS[isoWeekday(date)]}요일${isToday ? " 오늘" : ""}, 수업 ${placed.length}개`}
              className="timetable-day relative border-l border-border"
              style={hourHeight(hours.length)}
            >
              {placed.map((entry) => (
                <SessionBlock
                  key={entry.item.id}
                  session={entry.item}
                  top={entry.top}
                  height={entry.height}
                  lane={entry.lane}
                  lanes={entry.lanes}
                  showChild={showChild}
                />
              ))}
              {isToday ? <NowLine startHour={startHour} endHour={endHour} /> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
