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
import { childTone, dayFlow, toMinutes } from "../timetable";
import type { TimetableLane } from "./week-timetable";

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
            <span className={`text-xs ${isSelected ? "opacity-80" : weekday === 7 ? "text-danger" : "text-muted"}`}>
              {WEEKDAY_LABELS[weekday]}
            </span>
            <span className={`text-base font-bold tabular-nums ${!isSelected && isToday ? "text-primary" : ""}`}>
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

/** "1시간 10분", "40분" */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}시간` : "", rest ? `${rest}분` : ""].filter(Boolean).join(" ");
}

/** 수업 사이 한 줄: 빈 시간(여유) / 바로 이어서 / 겹침 */
function GapRow({ gap, color }: { gap: number; color: string }) {
  const overlap = gap < 0;
  const text = overlap ? `${formatDuration(-gap)} ${SAME_CHILD_OVERLAP_LABEL}` : gap === 0 ? "바로 이어서" : `${formatDuration(gap)} 여유`;
  return (
    <li className="grid grid-cols-[3.25rem_1rem_1fr] items-center gap-x-2" aria-label={text}>
      <span />
      <span className="flex h-full justify-center" aria-hidden>
        <span
          className="w-px"
          style={{ backgroundImage: `linear-gradient(${color} 50%, transparent 50%)`, backgroundSize: "1px 6px" }}
        />
      </span>
      <span className={`py-1 text-xs ${overlap ? "font-semibold text-danger" : "text-muted"}`} aria-hidden>
        {text}
      </span>
    </li>
  );
}

function FlowItem({ session, conflict }: { session: CalendarSession; conflict: boolean }) {
  const tone = childTone(session.child.color);
  const inactive = INACTIVE_STATUSES.has(session.status);
  const badge = sessionBadge(session);
  const minutes = toMinutes(session.endTime) - toMinutes(session.startTime);
  return (
    <li className="grid grid-cols-[3.25rem_1rem_1fr] gap-x-2">
      <div className="pt-2.5 text-right tabular-nums">
        <p className="text-sm font-semibold leading-tight">{formatTime(session.startTime)}</p>
        <p className="text-xs text-faint">{formatTime(session.endTime)}</p>
      </div>
      <div className="flex flex-col items-center pt-3.5" aria-hidden>
        <span
          className="size-2.5 shrink-0 rounded-full ring-2 ring-surface"
          style={{ backgroundColor: inactive ? "var(--faint)" : tone.accent }}
        />
      </div>
      <Link
        href={ROUTES.session(session.id)}
        aria-label={sessionLabel(session, true, conflict)}
        className={`my-0.5 block rounded-lg px-3 py-2.5 transition-[filter] hover:brightness-[0.97] ${inactive ? "opacity-55" : ""}`}
        style={{
          backgroundColor: tone.background,
          color: tone.text,
          boxShadow: conflict ? "inset 0 0 0 1px var(--danger)" : undefined,
        }}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`font-bold ${inactive ? "line-through" : ""}`}>{session.academyName}</span>
          {badge ? <span className="rounded-sm bg-surface/70 px-1.5 text-xs font-semibold">{badge}</span> : null}
        </span>
        {minutes > 0 ? <span className="mt-0.5 block text-sm opacity-75">{formatDuration(minutes)}</span> : null}
      </Link>
    </li>
  );
}

/** 자녀 한 명의 하루 흐름: 이름·요약 + 세로 타임라인(수업 사이 빈 시간까지) */
function ChildFlow({ lane, sessions }: { lane: TimetableLane; sessions: readonly CalendarSession[] }) {
  const tone = childTone(lane.color);
  const flow = dayFlow(sessions);
  const first = flow[0]?.item;
  const lastEnd = sessions.reduce((latest, session) => (session.endTime > latest ? session.endTime : latest), "");
  const conflicts = dayOverlaps(sessions).sameChild;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: lane.color }} aria-hidden />
        <h4 className="font-bold" style={{ color: tone.text }}>
          {lane.name}
        </h4>
        {first ? (
          <span className="text-sm text-muted tabular-nums">
            {sessions.length}개 · {formatTime(first.startTime)}–{formatTime(lastEnd)}
          </span>
        ) : null}
      </div>
      <ol className="relative">
        {/* 타임라인 세로선 */}
        <span
          aria-hidden
          className="absolute top-4 bottom-4 left-[calc(3.25rem+0.5rem+0.5rem-0.5px)] w-px"
          style={{ backgroundColor: `color-mix(in oklch, ${lane.color} 30%, transparent)` }}
        />
        {flow.flatMap((step) => [
          step.gapBefore === null ? null : (
            <GapRow key={`gap-${step.item.id}`} gap={step.gapBefore} color={lane.color} />
          ),
          <FlowItem key={step.item.id} session={step.item} conflict={conflicts.has(step.item.id)} />,
        ])}
      </ol>
    </div>
  );
}

interface DayFlowProps {
  date: IsoDate;
  today: IsoDate;
  sessions: readonly CalendarSession[];
  /** 보여 줄 자녀(왼쪽부터). 그날 수업이 없는 자녀는 건너뛴다 */
  lanes: readonly TimetableLane[];
  /** 여행·학교 일정(종일) */
  allDay?: ReactNode;
}

/**
 * 휴대폰 주간 보기 아래쪽: 고른 날을 자녀별 세로 타임라인으로.
 * 격자 대신 "아이마다 어디서 어디로, 사이에 얼마나 비는지"를 보여 준다(데려다주기·픽업 계획용).
 */
export function DayFlow({ date, today, sessions, lanes, allDay }: DayFlowProps) {
  const isToday = date === today;
  const groups = lanes
    .map((lane) => ({ lane, sessions: sessions.filter((session) => session.child.id === lane.id) }))
    .filter((group) => group.sessions.length > 0);

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

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">수업 없음</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <ChildFlow key={group.lane.id} lane={group.lane} sessions={group.sessions} />
          ))}
        </div>
      )}
    </section>
  );
}
