import Link from "next/link";
import { formatTime } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import { SESSION_KIND_LABELS, SESSION_STATUS_LABELS } from "@/features/education/format";
import type { CalendarSession } from "../queries";

interface SessionItemProps {
  session: CalendarSession;
  showChild: boolean;
}

const INACTIVE = new Set(["cancelled", "academy_cancelled", "absent"]);

export function SessionItem({ session, showChild }: SessionItemProps) {
  const inactive = INACTIVE.has(session.status);
  const kindLabel = SESSION_KIND_LABELS[session.kind];

  return (
    <li>
      <Link href={ROUTES.session(session.id)} className="flex items-start gap-3 py-2.5">
        <span
          aria-hidden
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: session.child.color }}
        />
        <div className="w-28 shrink-0 whitespace-nowrap text-sm lg:w-36 tabular-nums text-muted">
          {formatTime(session.startTime)}–{formatTime(session.endTime)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${inactive ? "text-muted line-through" : ""}`}>
            {showChild ? `${session.child.name} · ` : ""}
            {session.academyName}
            {kindLabel ? <span className="ml-1.5 text-xs font-semibold text-primary no-underline">{kindLabel}</span> : null}
          </p>
        </div>
        {session.status !== "scheduled" ? (
          <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted">
            {SESSION_STATUS_LABELS[session.status]}
          </span>
        ) : null}
      </Link>
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
