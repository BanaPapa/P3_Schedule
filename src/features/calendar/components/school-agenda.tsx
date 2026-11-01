import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { isOnDate, KIND_LABELS } from "@/features/school/format";
import type { SchoolEvent } from "@/features/school/queries";

/** 그날의 학교 일정 (캘린더 날짜 목록 위에 붙인다) */
export function SchoolAgenda({ date, events }: { date: string; events: SchoolEvent[] }) {
  const today = events.filter((event) => isOnDate(event, date));
  if (today.length === 0) return null;
  return (
    <ul className="mb-2 flex flex-col gap-1">
      {today.map((event) => (
        <li key={event.id}>
          <Link href={ROUTES.schoolEvent(event.id)} className="flex items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: event.child.color }} />
            <span className="font-semibold text-violet-600">{KIND_LABELS[event.kind]}</span>
            <span className="min-w-0 flex-1 truncate">
              {event.child.name} · {event.title}
            </span>
            {event.uncheckedCount > 0 ? <span className="shrink-0 text-xs text-danger">준비물 {event.uncheckedCount}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
