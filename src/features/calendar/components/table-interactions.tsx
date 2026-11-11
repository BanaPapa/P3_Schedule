"use client";

import { useState, type ReactNode } from "react";
import { formatTime } from "@/lib/dates";
import type { CalendarSession } from "../queries";
import { INACTIVE_STATUSES, sessionBadge, sessionLabel } from "../session-display";
import { childTone } from "../timetable";
import { useSessionGestures } from "./grid-interactions";
import { useTimetableEditor } from "./timetable-editor";

/** 표 칸 안의 수업(시각 칩). 주간 격자 칸과 같은 조작을 한다 */
export function EditableChip({ session, conflict }: { session: CalendarSession; conflict: boolean }) {
  const tone = childTone(session.child.color);
  const inactive = INACTIVE_STATUSES.has(session.status);
  const badge = sessionBadge(session);
  const { props, isDragging } = useSessionGestures(session, sessionLabel(session, true, conflict));
  return (
    <button
      {...props}
      className={`block w-full cursor-grab rounded-md border-l-[3px] px-2 py-1 text-left text-xs leading-snug tabular-nums transition-[filter,opacity] select-none hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary active:cursor-grabbing ${inactive ? "opacity-55" : ""} ${isDragging ? "opacity-40" : ""}`}
      style={{
        backgroundColor: tone.background,
        borderLeftColor: tone.accent,
        color: tone.text,
        boxShadow: conflict ? "inset 0 0 0 1px var(--danger)" : undefined,
      }}
    >
      <span className={`block font-semibold whitespace-nowrap ${inactive ? "line-through" : ""}`}>
        {formatTime(session.startTime)}–{formatTime(session.endTime)}
      </span>
      {badge || conflict ? (
        <span className={`block text-[length:calc(10px+var(--fs-up))] font-semibold ${conflict ? "text-danger" : ""}`}>
          {conflict ? "시간 겹침" : badge}
        </span>
      ) : null}
    </button>
  );
}

interface CellProps {
  date: string;
  /** 이 줄(자녀 × 학원) */
  childId: string;
  academyName: string;
  isToday: boolean;
  children: ReactNode;
}

/**
 * 표의 한 칸 = 놓는 자리. 같은 학원 줄에만 놓을 수 있다(다른 요일 칸 → 날짜 변경, 다른 아이 줄 → 아이 변경).
 * 시각은 그대로 두고, 놓으면 확인 모달에서 이번만 / 앞으로 매주를 고른다.
 */
export function CellDropZone({ date, childId, academyName, isToday, children }: CellProps) {
  const { openEdit, currentDrag, endDrag } = useTimetableEditor();
  const [over, setOver] = useState(false);

  const accepts = () => {
    const info = currentDrag();
    if (!info || info.session.academyName !== academyName) return null;
    return info;
  };

  return (
    <td
      className={`border-b border-border px-1.5 py-1.5 align-top transition-colors ${isToday ? "bg-primary-soft/40" : ""} ${over ? "bg-primary-soft outline-2 -outline-offset-2 outline-dashed outline-primary" : ""}`}
      onDragOver={(event) => {
        if (!accepts()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        setOver(false);
        const info = accepts();
        if (!info) return;
        event.preventDefault();
        endDrag();
        const { session } = info;
        if (session.date === date && session.child.id === childId) return;
        openEdit(session, {
          date,
          childId,
          startTime: formatTime(session.startTime),
          endTime: formatTime(session.endTime),
        });
      }}
    >
      <div className="flex min-h-8 flex-col gap-1">{children}</div>
    </td>
  );
}
