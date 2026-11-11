import type { CSSProperties } from "react";
import { isoWeekday, WEEKDAY_LABELS, type IsoDate } from "@/lib/dates";
import type { CalendarSession } from "../queries";
import { dayOverlaps } from "../session-display";
import { childTone, hourRange, layoutDay } from "../timetable";
import { EditableSessionBlock, LaneDropZone } from "./grid-interactions";
import { NowLine } from "./now-line";
import { EDIT_HINT_ID, TimetableEditorProvider, type ChildOption } from "./timetable-editor";

export type TimetableLane = ChildOption;

interface WeekTimetableProps {
  dates: readonly IsoDate[];
  today: IsoDate;
  sessionsByDate: Map<string, CalendarSession[]>;
  /** 하루 칸을 나눌 자녀 줄(왼쪽부터). 한 명이면 나누지 않는다 */
  lanes: readonly TimetableLane[];
  /** 편집 모달에서 고를 수 있는 가족의 모든 자녀 */
  childOptions: readonly ChildOption[];
}

const WEEKEND = new Set([6, 7]);

const hourHeight = (hours: number): CSSProperties => ({ height: `calc(var(--tt-hour) * ${hours})` });

/** 하루 칸 안의 자녀 한 줄. 그 자녀 수업만 배치하므로 형제 수업끼리는 겹치지 않는다 */
function LaneColumn({
  date,
  childId,
  sessions,
  startHour,
  endHour,
  conflicts,
  divided,
}: {
  date: IsoDate;
  childId: string | null;
  sessions: readonly CalendarSession[];
  startHour: number;
  endHour: number;
  conflicts: ReadonlySet<string>;
  divided: boolean;
}) {
  return (
    <LaneDropZone date={date} childId={childId} startHour={startHour} endHour={endHour} divided={divided}>
      {layoutDay(sessions, startHour).map((entry) => (
        <EditableSessionBlock
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
    </LaneDropZone>
  );
}

/**
 * PC 주간 보기: 요일 × 시간 격자(Notion Calendar 식).
 * 형제 수업이 겹쳐 찌그러지지 않도록 하루 칸을 자녀별 고정 줄로 나눈다(종이 시간표의 반 나누기처럼).
 * 칸은 자녀 색의 연한 배경과 왼쪽 띠. 주말은 수업이 있거나 오늘일 때만 보인다.
 * 칸을 끌어 다른 요일·시간·아이 줄로 옮기고, 더블클릭으로 고치고, 우클릭으로 삭제한다(화면 전환 없이 모달).
 */
export function WeekTimetable({ dates, today, sessionsByDate, lanes, childOptions }: WeekTimetableProps) {
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
    <TimetableEditorProvider childOptions={childOptions}>
      <div className="timetable rounded-2xl border border-border bg-surface px-3 pt-3 pb-4">
        {/* 스크롤해도 요일·자녀 머리글이 보이도록 앱 헤더(h-14) 아래에 붙인다 */}
        <div className="sticky top-14 z-40 -mx-3 bg-surface px-3">
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
                  <LaneColumn
                    date={date}
                    childId={null}
                    sessions={daySessions}
                    startHour={startHour}
                    endHour={endHour}
                    conflicts={sameChild}
                    divided={false}
                  />
                ) : (
                  lanes.map((lane, index) => (
                    <LaneColumn
                      key={lane.id}
                      date={date}
                      childId={lane.id}
                      sessions={daySessions.filter((session) => session.child.id === lane.id)}
                      startHour={startHour}
                      endHour={endHour}
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
        <p id={EDIT_HINT_ID} className="mt-3 text-xs text-faint">
          칸을 끌어 다른 요일·시간·아이로 옮기고, 더블클릭으로 고치고, 오른쪽 클릭으로 삭제할 수 있습니다.
        </p>
      </div>
    </TimetableEditorProvider>
  );
}
