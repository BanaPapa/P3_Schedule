import Link from "next/link";
import type { CSSProperties } from "react";
import { SESSION_KIND_LABELS, SESSION_STATUS_LABELS } from "@/features/education/format";
import { formatTime, isoWeekday, WEEKDAY_LABELS, type IsoDate } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import type { CalendarSession } from "../queries";
import { academyColors, hourRange, layoutDay } from "../timetable";

interface WeekTimetableProps {
  dates: readonly IsoDate[];
  today: IsoDate;
  sessionsByDate: Map<string, CalendarSession[]>;
  showChild: boolean;
}

const WEEKEND = new Set([6, 7]);
const INACTIVE = new Set(["cancelled", "academy_cancelled", "absent"]);
/** 파스텔 칸 위 글자색. 밝은·어두운 테마 모두 칸 배경이 밝으므로 고정한다. */
const BLOCK_TEXT = "#2b2838";
/** 35분보다 짧은 칸은 시간 줄을 빼고 이름만 보인다 */
const COMPACT_MINUTES = 35;

/** 1시간 높이. PC 는 글자가 커지므로 더 높게 */
const hourHeight = (hours: number): CSSProperties => ({ height: `calc(var(--tt-hour) * ${hours})` });

function SessionBlock({
  session,
  top,
  height,
  lane,
  lanes,
  color,
  showChild,
}: {
  session: CalendarSession;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  color: string;
  showChild: boolean;
}) {
  const inactive = INACTIVE.has(session.status);
  const time = `${formatTime(session.startTime)}–${formatTime(session.endTime)}`;
  const kindLabel = SESSION_KIND_LABELS[session.kind];
  const statusLabel = session.status === "scheduled" ? null : SESSION_STATUS_LABELS[session.status];
  const title = `${showChild ? `${session.child.name} ` : ""}${session.academyName}`;
  const label = [title, time, kindLabel, statusLabel].filter(Boolean).join(", ");

  return (
    <Link
      href={ROUTES.session(session.id)}
      aria-label={label}
      title={label}
      className={`absolute overflow-hidden rounded-xl px-1 pt-0.5 text-center leading-[1.15] transition hover:brightness-95 ${inactive ? "opacity-45" : ""}`}
      style={{
        top: `calc(var(--tt-hour) * ${top / 60})`,
        height: `calc(var(--tt-hour) * ${height / 60} - 3px)`,
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        backgroundColor: color,
        color: BLOCK_TEXT,
        // 왼쪽 띠: 자녀 색 (형제 수업을 한눈에 구분)
        boxShadow: `inset 3px 0 0 ${session.child.color}`,
      }}
    >
      {showChild ? (
        <span className="block truncate text-[length:calc(10px+var(--fs-up))] font-bold opacity-75">
          {session.child.name}
        </span>
      ) : null}
      <span
        className={`line-clamp-2 break-keep text-xs font-extrabold ${inactive ? "line-through" : ""}`}
      >
        {session.academyName}
      </span>
      {height >= COMPACT_MINUTES ? (
        <span className="block truncate text-[length:calc(10px+var(--fs-up))] font-semibold opacity-80 tabular-nums">
          {/* 휴대폰 칸은 좁아 시작 시각만, PC 는 시작~끝 */}
          <span className="lg:hidden">{formatTime(session.startTime)}</span>
          <span className="hidden lg:inline">
            {formatTime(session.startTime)}~{formatTime(session.endTime)}
          </span>
        </span>
      ) : null}
      {kindLabel || statusLabel ? (
        <span className="block truncate text-[length:calc(10px+var(--fs-up))] font-bold">{statusLabel ?? kindLabel}</span>
      ) : null}
    </Link>
  );
}

/**
 * 주간 보기: 요일 × 시간 격자에 수업을 학원별 색 칸으로 채운다(종이 시간표처럼).
 * 주말은 수업이 있거나 오늘일 때만 보인다.
 */
export function WeekTimetable({ dates, today, sessionsByDate, showChild }: WeekTimetableProps) {
  const visibleDates = dates.filter(
    (date) => !WEEKEND.has(isoWeekday(date)) || date === today || (sessionsByDate.get(date)?.length ?? 0) > 0,
  );
  const sessions = visibleDates.flatMap((date) => sessionsByDate.get(date) ?? []);
  const { startHour, endHour } = hourRange(sessions);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const colors = academyColors(sessions.map((session) => session.academyName));
  const gridColumns = { gridTemplateColumns: `2.25rem repeat(${visibleDates.length}, minmax(0, 1fr))` };

  return (
    <div className="timetable rounded-2xl border border-border bg-surface p-2 shadow-soft">
      <div className="grid border-b border-border pb-1.5" style={gridColumns}>
        <span aria-hidden />
        {visibleDates.map((date) => {
          const weekday = isoWeekday(date);
          const isToday = date === today;
          return (
            <div key={date} className="flex flex-col items-center gap-0.5 text-center">
              <span className={`text-sm font-extrabold ${weekday === 7 ? "text-danger" : isToday ? "text-primary" : ""}`}>
                {WEEKDAY_LABELS[weekday]}
              </span>
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${isToday ? "btn-primary font-extrabold" : "text-muted"}`}
              >
                {Number(date.slice(8))}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid pt-2" style={gridColumns}>
        <div className="relative" style={hourHeight(hours.length)} aria-hidden>
          {hours.map((hour, index) => (
            <span
              key={hour}
              className="absolute right-1.5 -translate-y-1/2 text-[length:calc(10px+var(--fs-up))] font-semibold text-muted tabular-nums"
              style={{ top: `calc(var(--tt-hour) * ${index})` }}
            >
              {hour}시
            </span>
          ))}
        </div>
        {visibleDates.map((date) => {
          const placed = layoutDay(sessionsByDate.get(date) ?? [], startHour);
          return (
            <section
              key={date}
              aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 ${WEEKDAY_LABELS[isoWeekday(date)]}요일${date === today ? " 오늘" : ""}, 수업 ${placed.length}개`}
              className={`timetable-day relative border-l border-border ${date === today ? "bg-primary-soft/40" : ""}`}
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
                  color={colors.get(entry.item.academyName) ?? "#e5e7eb"}
                  showChild={showChild}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
