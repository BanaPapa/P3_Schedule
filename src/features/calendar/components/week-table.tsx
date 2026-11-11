import { isoWeekday, WEEKDAY_LABELS, type IsoDate } from "@/lib/dates";
import type { CalendarSession } from "../queries";
import { dayOverlaps, INACTIVE_STATUSES } from "../session-display";
import { childTone } from "../timetable";
import { buildWeekTable, type WeekTableRow } from "../week-table";
import { CellDropZone, EditableChip } from "./table-interactions";
import { EDIT_HINT_ID, TimetableEditorProvider, type ChildOption } from "./timetable-editor";

interface WeekTableProps {
  dates: readonly IsoDate[];
  today: IsoDate;
  sessions: readonly CalendarSession[];
  /** 가족의 모든 자녀(줄 순서 + 편집 모달의 아이 고르기) */
  childOptions: readonly ChildOption[];
}

const WEEKEND = new Set([6, 7]);
const FIRST_COLUMN_REM = 10.5;
const DAY_COLUMN_MIN_REM = 6.5;

function formatTotal(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}시간` : "", rest ? `${rest}분` : ""].filter(Boolean).join(" ") || "0분";
}

/**
 * 주간 표 보기: 한 줄 = 자녀 × 학원, 칸 = 요일. 칸에는 그날 수업 시각.
 * 시각 칩을 다른 요일 칸(날짜 변경)이나 같은 학원의 다른 아이 줄(아이 변경)로 끌어 옮기고,
 * 더블클릭 편집·우클릭 삭제는 주간 격자와 같다. 휴대폰에서는 첫 열을 고정하고 요일 열을 옆으로 넘긴다.
 */
export function WeekTable({ dates, today, sessions, childOptions }: WeekTableProps) {
  const childOrder = childOptions.map((child) => child.id);
  const visibleDates = dates.filter(
    (date) => !WEEKEND.has(isoWeekday(date)) || date === today || sessions.some((session) => session.date === date),
  );
  const rows = buildWeekTable(sessions, childOrder, (session) => !INACTIVE_STATUSES.has(session.status));
  const conflicts = new Set(
    visibleDates.flatMap((date) => [...dayOverlaps(sessions.filter((session) => session.date === date)).sameChild]),
  );
  // 자녀별로 묶어 머리줄을 하나씩 둔다
  const groups = childOrder
    .map((childId) => rows.filter((row) => row.child.id === childId))
    .filter((group) => group.length > 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
        이번 주에는 수업이 없습니다.
      </div>
    );
  }

  return (
    <TimetableEditorProvider childOptions={childOptions}>
      <div className="week-table overflow-x-auto rounded-2xl border border-border bg-surface">
        {/* 넓으면 화면 폭에 맞추고, 좁으면(휴대폰) 요일 열이 6.5rem 아래로 줄지 않게 옆으로 넘긴다 */}
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
          style={{ minWidth: `${FIRST_COLUMN_REM + visibleDates.length * DAY_COLUMN_MIN_REM}rem` }}
        >
          <caption className="sr-only">주간 수업 표: 자녀·학원별 요일 수업 시각</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-2.5 text-left text-xs font-semibold text-muted"
                style={{ width: `${FIRST_COLUMN_REM}rem` }}
              >
                수업
              </th>
              {visibleDates.map((date) => {
                const weekday = isoWeekday(date);
                const isToday = date === today;
                return (
                  <th
                    key={date}
                    scope="col"
                    aria-label={`${WEEKDAY_LABELS[weekday]}요일 ${Number(date.slice(8))}일${isToday ? " 오늘" : ""}`}
                    className={`border-b border-border px-2 py-2.5 text-center font-normal ${isToday ? "bg-primary-soft/40" : ""}`}
                  >
                    <span className={`text-sm ${weekday === 7 ? "text-danger" : isToday ? "font-bold" : "text-muted"}`}>
                      {WEEKDAY_LABELS[weekday]}
                    </span>{" "}
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm tabular-nums ${isToday ? "bg-primary font-bold text-primary-foreground" : "text-muted"}`}
                    >
                      {Number(date.slice(8))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          {groups.map((group) => (
            <ChildGroup
              key={group[0].child.id}
              rows={group}
              dates={visibleDates}
              today={today}
              conflicts={conflicts}
              showHeader={groups.length > 1}
            />
          ))}
        </table>
        <p id={EDIT_HINT_ID} className="px-3 py-2.5 text-xs text-faint">
          시각을 끌어 다른 요일이나 같은 학원의 다른 아이 줄로 옮기고, 더블클릭으로 고치고, 오른쪽 클릭으로 삭제할 수
          있습니다.
        </p>
      </div>
    </TimetableEditorProvider>
  );
}

function ChildGroup({
  rows,
  dates,
  today,
  conflicts,
  showHeader,
}: {
  rows: readonly WeekTableRow<CalendarSession>[];
  dates: readonly IsoDate[];
  today: IsoDate;
  conflicts: ReadonlySet<string>;
  showHeader: boolean;
}) {
  const child = rows[0].child;
  const tone = childTone(child.color);
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const minutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  return (
    <tbody>
      {showHeader ? (
        <tr>
          <th
            scope="colgroup"
            colSpan={dates.length + 1}
            className="border-b border-border bg-surface-2 px-3 py-2 text-left"
          >
            <span className="sticky left-3 inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: child.color }} aria-hidden />
              <span className="font-bold" style={{ color: tone.text }}>
                {child.name}
              </span>
              <span className="text-xs font-normal text-muted tabular-nums">
                주 {count}회 · {formatTotal(minutes)}
              </span>
            </span>
          </th>
        </tr>
      ) : null}
      {rows.map((row) => (
        <tr key={row.key}>
          <th
            scope="row"
            className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-2 text-left align-top font-normal"
          >
            <span className="flex items-center gap-2">
              <span className="h-4 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: child.color }} aria-hidden />
              <span className="font-semibold">{row.academyName}</span>
            </span>
            <span className="mt-0.5 block pl-[11px] text-xs text-muted tabular-nums">
              주 {row.count}회 · {formatTotal(row.minutes)}
            </span>
          </th>
          {dates.map((date) => (
            <CellDropZone
              key={date}
              date={date}
              childId={row.child.id}
              academyName={row.academyName}
              isToday={date === today}
            >
              {(row.cells.get(date) ?? []).map((session) => (
                <EditableChip key={session.id} session={session} conflict={conflicts.has(session.id)} />
              ))}
            </CellDropZone>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
