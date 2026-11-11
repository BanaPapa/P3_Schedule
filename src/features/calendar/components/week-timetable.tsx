import Link from "next/link";
import type { CSSProperties } from "react";
import { formatTime, isoWeekday, WEEKDAY_LABELS, type IsoDate } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import type { CalendarSession } from "../queries";
import { dayOverlaps, INACTIVE_STATUSES, sessionBadge, sessionLabel } from "../session-display";
import { childTone, hourRange, layoutDay } from "../timetable";
import { NowLine } from "./now-line";

export interface TimetableLane {
  id: string;
  name: string;
  color: string;
}

interface WeekTimetableProps {
  dates: readonly IsoDate[];
  today: IsoDate;
  sessionsByDate: Map<string, CalendarSession[]>;
  /** 하루 칸을 나눌 자녀 줄(왼쪽부터). 한 명이면 나누지 않는다 */
  lanes: readonly TimetableLane[];
}

const WEEKEND = new Set([6, 7]);
/** 이보다 짧은 수업은 한 줄(이름 + 시작 시각)로 줄인다 */
const ONE_LINE_MINUTES = 40;

const hourHeight = (hours: number): CSSProperties => ({ height: `calc(var(--tt-hour) * ${hours})` });

interface BlockProps {
  session: CalendarSession;
  top: number;
  height: number;
  left: number;
  width: number;
  z: number;
  /** 같은 자녀의 다른 수업과 시간이 겹침 */
  conflict: boolean;
}

function SessionBlock({ session, top, height, left, width, z, conflict }: BlockProps) {
  const tone = childTone(session.child.color);
  const inactive = INACTIVE_STATUSES.has(session.status);
  const badge = sessionBadge(session);
  const label = sessionLabel(session, true, conflict);
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
        left: `calc(${left * 100}% + 2px)`,
        width: `calc(${width * 100}% - 4px)`,
        zIndex: z + 1,
        // 같은 자녀 겹침(드묾)에서 위 칸이 아래 칸을 비추지 않도록 바탕을 먼저 깐다
        background: `linear-gradient(${tone.background}, ${tone.background}), var(--surface)`,
        borderLeftColor: tone.accent,
        color: tone.text,
        boxShadow: conflict ? "inset 0 0 0 1px var(--danger)" : undefined,
      }}
    >
      <span className={`block truncate text-xs font-bold ${inactive ? "line-through" : ""}`}>
        {conflict ? (
          <span
            aria-hidden
            className="mr-1 inline-flex size-3.5 items-center justify-center rounded-full bg-danger align-[-2px] text-[length:calc(10px+var(--fs-up))] leading-none text-surface"
          >
            !
          </span>
        ) : null}
        {session.academyName}
        {oneLine ? (
          <span className="ml-1 font-medium tabular-nums opacity-80">{formatTime(session.startTime)}</span>
        ) : null}
      </span>
      {oneLine ? null : (
        <span className="block truncate text-[length:calc(11px+var(--fs-up))] tabular-nums opacity-80">
          {/* 자녀 줄이 좁으면 시작 시각만, 넉넉하면 시작–끝 (줄 폭 기준 컨테이너 쿼리) */}
          <span className="@[6.5rem]:hidden">{formatTime(session.startTime)}</span>
          <span className="hidden @[6.5rem]:inline">
            {formatTime(session.startTime)}–{formatTime(session.endTime)}
          </span>
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

/** 하루 칸 안의 자녀 한 줄. 그 자녀 수업만 배치하므로 형제 수업끼리는 겹치지 않는다 */
function LaneColumn({
  sessions,
  startHour,
  conflicts,
  divided,
}: {
  sessions: readonly CalendarSession[];
  startHour: number;
  conflicts: ReadonlySet<string>;
  divided: boolean;
}) {
  return (
    <div className={`@container relative ${divided ? "border-l border-dashed border-border" : ""}`}>
      {layoutDay(sessions, startHour).map((entry) => (
        <SessionBlock
          key={entry.item.id}
          session={entry.item}
          top={entry.top}
          height={entry.height}
          left={entry.left}
          width={entry.width}
          z={entry.z}
          conflict={conflicts.has(entry.item.id)}
        />
      ))}
    </div>
  );
}

/**
 * PC 주간 보기: 요일 × 시간 격자(Notion Calendar 식).
 * 형제 수업이 겹쳐 찌그러지지 않도록 하루 칸을 자녀별 고정 줄로 나눈다(종이 시간표의 반 나누기처럼).
 * 칸은 자녀 색의 연한 배경과 왼쪽 띠. 주말은 수업이 있거나 오늘일 때만 보인다.
 */
export function WeekTimetable({ dates, today, sessionsByDate, lanes }: WeekTimetableProps) {
  const visibleDates = dates.filter(
    (date) => !WEEKEND.has(isoWeekday(date)) || date === today || (sessionsByDate.get(date)?.length ?? 0) > 0,
  );
  const sessions = visibleDates.flatMap((date) => sessionsByDate.get(date) ?? []);
  const { startHour, endHour } = hourRange(sessions);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const gridColumns = { gridTemplateColumns: `3rem repeat(${visibleDates.length}, minmax(0, 1fr))` };
  const laneColumns = { gridTemplateColumns: `repeat(${Math.max(1, lanes.length)}, minmax(0, 1fr))` };
  const split = lanes.length > 1;

  return (
    <div className="timetable rounded-2xl border border-border bg-surface px-3 pt-3 pb-4">
      {/* 스크롤해도 요일·자녀 머리글이 보이도록 앱 헤더(h-14) 아래에 붙인다 */}
      <div className="sticky top-14 z-20 -mx-3 bg-surface px-3">
        <div className="grid pb-1.5" style={gridColumns}>
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
        {split ? (
          <div className="grid border-b border-border pb-1.5" style={gridColumns} aria-hidden>
            <span />
            {visibleDates.map((date) => (
              <div key={date} className="grid" style={laneColumns}>
                {lanes.map((lane) => (
                  <span
                    key={lane.id}
                    className="truncate text-center text-[length:calc(11px+var(--fs-up))] font-semibold"
                    style={{ color: childTone(lane.color).text }}
                  >
                    {lane.name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="border-b border-border" />
        )}
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
          const daySessions = sessionsByDate.get(date) ?? [];
          const { sameChild } = dayOverlaps(daySessions);
          const isToday = date === today;
          return (
            <section
              key={date}
              aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 ${WEEKDAY_LABELS[isoWeekday(date)]}요일${isToday ? " 오늘" : ""}, 수업 ${daySessions.length}개`}
              className="timetable-day relative grid border-l border-border"
              style={{ ...hourHeight(hours.length), ...laneColumns }}
            >
              {lanes.length === 0 ? (
                <LaneColumn sessions={daySessions} startHour={startHour} conflicts={sameChild} divided={false} />
              ) : (
                lanes.map((lane, index) => (
                  <LaneColumn
                    key={lane.id}
                    sessions={daySessions.filter((session) => session.child.id === lane.id)}
                    startHour={startHour}
                    conflicts={sameChild}
                    divided={index > 0}
                  />
                ))
              )}
              {isToday ? <NowLine startHour={startHour} endHour={endHour} /> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
