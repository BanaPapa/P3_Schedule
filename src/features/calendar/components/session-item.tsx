import { formatTime } from "@/lib/dates";
import { SESSION_STATUS_LABELS } from "@/features/education/format";
import type { CalendarSession } from "../queries";

interface SessionItemProps {
  session: CalendarSession;
  showChild: boolean;
}

export function SessionItem({ session, showChild }: SessionItemProps) {
  const inactive = session.status === "cancelled" || session.status === "academy_cancelled";

  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        aria-hidden
        className="mt-1.5 size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: session.child.color }}
      />
      <div className="w-24 shrink-0 text-sm tabular-nums text-muted">
        {formatTime(session.startTime)}–{formatTime(session.endTime)}
      </div>
      <div className={`min-w-0 flex-1 ${inactive ? "text-muted line-through" : ""}`}>
        <p className="font-medium">
          {showChild ? `${session.child.name} · ` : ""}
          {session.subject}
        </p>
        <p className="text-sm text-muted">{session.academyName}</p>
      </div>
      {session.status !== "scheduled" ? (
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted">
          {SESSION_STATUS_LABELS[session.status]}
        </span>
      ) : null}
    </li>
  );
}

interface SessionListProps {
  sessions: CalendarSession[];
  showChild: boolean;
  emptyText?: string;
}

export function SessionList({ sessions, showChild, emptyText = "일정이 없습니다." }: SessionListProps) {
  if (sessions.length === 0) return <p className="py-2 text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {sessions.map((session) => (
        <SessionItem key={session.id} session={session} showChild={showChild} />
      ))}
    </ul>
  );
}
