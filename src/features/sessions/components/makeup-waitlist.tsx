import Link from "next/link";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import { SESSION_STATUS_LABELS } from "@/features/education/format";
import type { WaitingSession } from "../queries";

interface MakeupWaitlistProps {
  sessions: WaitingSession[];
}

/** 결석·휴강 후 보강이 정해지지 않은 수업. 누르면 회차 화면에서 보강을 등록한다. */
export function MakeupWaitlist({ sessions }: MakeupWaitlistProps) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link href={ROUTES.session(session.id)} className="flex items-center gap-3 py-2.5">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: session.child.color }} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {session.child.name} · {session.subject}
              </p>
              <p className="text-sm text-muted">
                {formatDayLabel(session.date)} {formatTime(session.startTime)} · {session.academyName}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
              {SESSION_STATUS_LABELS[session.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
