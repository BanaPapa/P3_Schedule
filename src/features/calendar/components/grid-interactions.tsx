"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { formatTime } from "@/lib/dates";
import type { CalendarSession } from "../queries";
import { INACTIVE_STATUSES, sessionBadge, sessionLabel } from "../session-display";
import { childTone, dropStartMinutes, minutesToTime, toMinutes } from "../timetable";
import { EDIT_HINT_ID, useTimetableEditor } from "./timetable-editor";

/** 이보다 짧은 수업은 한 줄(이름 + 시작 시각)로 줄인다 */
const ONE_LINE_MINUTES = 40;
const HINT = "더블클릭: 편집 · 끌기: 옮기기 · 우클릭: 메뉴";

interface BlockProps {
  session: CalendarSession;
  top: number;
  height: number;
  left: number;
  width: number;
  z: number;
  /** 같은 자녀의 다른 수업과 시간이 겹침 */
  conflict: boolean;
}

/**
 * PC 주간 격자의 수업 칸. 더블클릭(또는 Enter) 편집, 끌어 옮기기, 우클릭(또는 메뉴 키) 메뉴,
 * Delete 키 삭제. 화면을 바꾸지 않고 그 위에 모달을 띄운다.
 */
export function EditableSessionBlock({ session, top, height, left, width, z, conflict }: BlockProps) {
  const { openEdit, openDelete, openMenu, startDrag, endDrag } = useTimetableEditor();
  const [isDragging, setIsDragging] = useState(false);
  const tone = childTone(session.child.color);
  const inactive = INACTIVE_STATUSES.has(session.status);
  const badge = sessionBadge(session);
  const label = sessionLabel(session, true, conflict);
  const oneLine = height < ONE_LINE_MINUTES;

  return (
    <button
      type="button"
      draggable
      aria-label={label}
      aria-describedby={EDIT_HINT_ID}
      title={`${label}\n${HINT}`}
      onDoubleClick={() => openEdit(session)}
      onContextMenu={(event) => {
        event.preventDefault();
        // 메뉴 키로 열면 좌표가 0 이라 칸 위치에 띄운다
        const rect = event.currentTarget.getBoundingClientRect();
        const fromKeyboard = event.clientX === 0 && event.clientY === 0;
        openMenu(session, fromKeyboard ? rect.left : event.clientX, fromKeyboard ? rect.bottom : event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          openEdit(session);
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          openDelete(session);
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", session.id);
        event.dataTransfer.effectAllowed = "move";
        startDrag({ session, grabOffsetPx: event.clientY - event.currentTarget.getBoundingClientRect().top });
        setIsDragging(true);
      }}
      onDragEnd={() => {
        endDrag();
        setIsDragging(false);
      }}
      className={`absolute cursor-grab overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left leading-snug transition-[filter,opacity] select-none hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary active:cursor-grabbing ${inactive ? "opacity-55" : ""} ${isDragging ? "opacity-40" : ""}`}
      style={{
        top: `calc(var(--tt-hour) * ${top / 60} + 1px)`,
        height: `calc(var(--tt-hour) * ${height / 60} - 2px)`,
        left: `calc(${left * 100}% + 2px)`,
        width: `calc(${width * 100}% - 4px)`,
        zIndex: z + 1,
        // 같은 자녀 겹침(드묾)에서 위 칸이 아래 칸을 비추지 않도록 바탕을 먼저 깐다
        background: `linear-gradient(${tone.background}, ${tone.background}), var(--surface)`,
        borderLeftColor: tone.accent,
        color: tone.text,
        boxShadow: conflict ? "inset 0 0 0 1px var(--danger)" : undefined,
      }}
    >
      <span className={`block truncate text-xs font-bold ${inactive ? "line-through" : ""}`}>
        {/* 겹쳐 쌓이면 아래 줄이 가려질 수 있어, 겹침 경고는 제목 줄 맨 앞에 둔다 */}
        {conflict ? (
          <span
            aria-hidden
            className="mr-1 inline-flex size-3.5 items-center justify-center rounded-full bg-danger align-[-2px] text-[length:calc(10px+var(--fs-up))] leading-none text-surface"
          >
            !
          </span>
        ) : null}
        {session.academyName}
        {oneLine ? (
          <span className="ml-1 font-medium tabular-nums opacity-80">{formatTime(session.startTime)}</span>
        ) : null}
      </span>
      {oneLine ? null : (
        <span className="block truncate text-[length:calc(11px+var(--fs-up))] tabular-nums opacity-80">
          {/* 자녀 줄이 좁으면 시작 시각만, 넉넉하면 시작–끝 (줄 폭 기준 컨테이너 쿼리) */}
          <span className="@[6.5rem]:hidden">{formatTime(session.startTime)}</span>
          <span className="hidden @[6.5rem]:inline">
            {formatTime(session.startTime)}–{formatTime(session.endTime)}
          </span>
        </span>
      )}
      {badge && !oneLine ? (
        <span className="mt-0.5 inline-block rounded-sm bg-surface/70 px-1 text-[length:calc(10px+var(--fs-up))] font-semibold">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

interface LaneProps {
  date: string;
  /** 이 줄의 자녀. 놓으면 그 아이 수업으로 옮긴다 */
  childId: string | null;
  startHour: number;
  endHour: number;
  divided: boolean;
  children: ReactNode;
}

interface Preview {
  start: number;
  duration: number;
}

/** 하루 칸 안의 자녀 한 줄 = 끌어 놓는 자리. 놓을 곳을 점선 칸으로 미리 보여 준다 */
export function LaneDropZone({ date, childId, startHour, endHour, divided, children }: LaneProps) {
  const { openEdit, currentDrag, endDrag } = useTimetableEditor();
  const [preview, setPreview] = useState<Preview | null>(null);

  const target = (event: DragEvent<HTMLDivElement>) => {
    const info = currentDrag();
    if (!info) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const duration = toMinutes(info.session.endTime) - toMinutes(info.session.startTime);
    const start = dropStartMinutes({
      topPx: event.clientY - rect.top - info.grabOffsetPx,
      laneHeightPx: rect.height,
      startHour,
      endHour,
      durationMinutes: duration,
    });
    return { info, start, duration };
  };

  return (
    <div
      className={`@container relative ${divided ? "border-l border-dashed border-border" : ""} ${preview ? "bg-primary-soft/30" : ""}`}
      onDragOver={(event) => {
        const next = target(event);
        if (!next) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (preview?.start !== next.start) setPreview({ start: next.start, duration: next.duration });
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(null);
      }}
      onDrop={(event) => {
        const next = target(event);
        setPreview(null);
        if (!next) return;
        event.preventDefault();
        const { info, start, duration } = next;
        const newChild = childId ?? info.session.child.id;
        const unchanged =
          date === info.session.date &&
          newChild === info.session.child.id &&
          start === toMinutes(info.session.startTime);
        endDrag();
        if (unchanged) return;
        openEdit(info.session, {
          date,
          childId: newChild,
          startTime: minutesToTime(start),
          endTime: minutesToTime(start + duration),
        });
      }}
    >
      {children}
      {preview ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0.5 z-30 flex items-start rounded-md border-2 border-dashed border-primary bg-primary-soft/60 px-1.5 py-1 text-[length:calc(11px+var(--fs-up))] font-bold text-primary tabular-nums"
          style={{
            top: `calc(var(--tt-hour) * ${(preview.start - startHour * 60) / 60})`,
            height: `calc(var(--tt-hour) * ${preview.duration / 60})`,
          }}
        >
          {minutesToTime(preview.start)}
        </div>
      ) : null}
    </div>
  );
}
