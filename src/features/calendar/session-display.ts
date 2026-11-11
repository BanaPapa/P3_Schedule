import { SESSION_KIND_LABELS, SESSION_STATUS_LABELS } from "@/features/education/format";
import { formatTime } from "@/lib/dates";
import type { CalendarSession } from "./queries";
import { findOverlaps } from "./timetable";

/** 흐리게·취소선으로 보이는 상태 */
export const INACTIVE_STATUSES: ReadonlySet<string> = new Set(["cancelled", "academy_cancelled", "absent"]);

/** "보강", "결석" 같은 짧은 꼬리표. 예정인 정규 수업이면 없음 */
export function sessionBadge(session: Pick<CalendarSession, "status" | "kind">): string | null {
  if (session.status !== "scheduled") return SESSION_STATUS_LABELS[session.status];
  return SESSION_KIND_LABELS[session.kind];
}

/** 같은 자녀 수업끼리 시간이 겹칠 때 붙이는 경고 */
export const SAME_CHILD_OVERLAP_LABEL = "시간 겹침";

/** 화면 낭독기용 한 줄 설명: "수호, 피아노, 14:00–14:50, 결석" */
export function sessionLabel(session: CalendarSession, showChild: boolean, conflict = false): string {
  const time = `${formatTime(session.startTime)}–${formatTime(session.endTime)}`;
  return [
    showChild ? session.child.name : null,
    session.academyName,
    time,
    sessionBadge(session),
    conflict ? SAME_CHILD_OVERLAP_LABEL : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** 하루치 수업의 겹침(같은 자녀 / 형제 동시). 취소·결석은 빼고 본다. */
export function dayOverlaps(sessions: readonly CalendarSession[]) {
  return findOverlaps(
    sessions,
    (session) => session.child.id,
    (session) => !INACTIVE_STATUSES.has(session.status),
  );
}
