import type { IsoDate } from "@/lib/dates";
import { toMinutes } from "./timetable";

interface TableSession {
  id: string;
  date: IsoDate;
  startTime: string;
  endTime: string;
  academyName: string;
  child: { id: string; name: string; color: string };
}

export interface WeekTableRow<T extends TableSession> {
  key: string;
  child: T["child"];
  academyName: string;
  /** 날짜별 수업(시작 순) */
  cells: ReadonlyMap<IsoDate, readonly T[]>;
  /** 실제로 가는 수업 수와 시간(분). 취소·결석은 빼고 센다 */
  count: number;
  minutes: number;
}

/**
 * 주간 표: 한 줄 = 자녀 × 학원, 칸 = 요일. 종이 시간표처럼 한 주를 한눈에 본다.
 * 줄 순서는 자녀 순서(childOrder), 그다음 그 주 첫 수업 시각 순.
 */
export function buildWeekTable<T extends TableSession>(
  sessions: readonly T[],
  childOrder: readonly string[],
  isActive: (session: T) => boolean = () => true,
): WeekTableRow<T>[] {
  const sorted = [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || toMinutes(a.startTime) - toMinutes(b.startTime),
  );
  const groups = new Map<string, T[]>();
  for (const session of sorted) {
    const key = `${session.child.id}|${session.academyName}`;
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }

  const rank = (childId: string) => {
    const index = childOrder.indexOf(childId);
    return index === -1 ? childOrder.length : index;
  };

  // 각 묶음의 첫 수업(날짜·시각 순으로 이미 정렬됨)으로 줄 순서를 정한다
  const ordered = [...groups.entries()].sort(
    ([, a], [, b]) =>
      rank(a[0].child.id) - rank(b[0].child.id) ||
      a[0].date.localeCompare(b[0].date) ||
      toMinutes(a[0].startTime) - toMinutes(b[0].startTime),
  );

  return ordered.map(([key, rows]) => {
    const cells = new Map<IsoDate, T[]>();
    for (const session of rows) cells.set(session.date, [...(cells.get(session.date) ?? []), session]);
    const active = rows.filter(isActive);
    return {
      key,
      child: rows[0].child,
      academyName: rows[0].academyName,
      cells,
      count: active.length,
      minutes: active.reduce((sum, s) => sum + Math.max(0, toMinutes(s.endTime) - toMinutes(s.startTime)), 0),
    };
  });
}
