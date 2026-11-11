import { SESSION_KIND_LABELS, SESSION_STATUS_LABELS } from "@/features/education/format";
import { formatTime } from "@/lib/dates";
import type { CalendarSession } from "./queries";

/** 흐리게·취소선으로 보이는 상태 */
export const INACTIVE_STATUSES: ReadonlySet<string> = new Set(["cancelled", "academy_cancelled", "absent"]);

/** "보강", "결석" 같은 짧은 꼬리표. 예정인 정규 수업이면 없음 */
export function sessionBadge(session: Pick<CalendarSession, "status" | "kind">): string | null {
  if (session.status !== "scheduled") return SESSION_STATUS_LABELS[session.status];
  return SESSION_KIND_LABELS[session.kind];
}

/** 화면 낭독기용 한 줄 설명: "수호, 피아노, 14:00–14:50, 결석" */
export function sessionLabel(session: CalendarSession, showChild: boolean): string {
  const time = `${formatTime(session.startTime)}–${formatTime(session.endTime)}`;
  return [showChild ? session.child.name : null, session.academyName, time, sessionBadge(session)]
    .filter(Boolean)
    .join(", ");
}
