import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { eventDateLabel, KIND_LABELS, needsAttention } from "../format";
import type { SchoolEvent } from "../queries";

function badge(event: SchoolEvent): string | null {
  if (event.kind === "homework") return event.done ? "완료" : "할 일";
  if (event.uncheckedCount > 0) return `준비물 ${event.uncheckedCount}`;
  if (event.kind === "exam" && event.score !== null) return `${event.score}/${event.maxScore ?? 100}`;
  return null;
}

export function SchoolEventList({ events, emptyText }: { events: SchoolEvent[]; emptyText: string }) {
  if (events.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {events.map((event) => {
        const label = badge(event);
        return (
          <li key={event.id}>
            <Link href={ROUTES.schoolEvent(event.id)} className="flex items-start gap-3 py-2.5">
              <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: event.child.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <span className="mr-1.5 text-xs font-semibold text-violet-600">{KIND_LABELS[event.kind]}</span>
                  {event.title}
                </p>
                <p className="text-sm text-muted">
                  {event.child.name} · {eventDateLabel(event)}
                  {event.subject ? ` · ${event.subject}` : ""}
                </p>
              </div>
              {label ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${needsAttention(event) ? "bg-danger/10 text-danger" : "bg-background text-muted"}`}
                >
                  {label}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
