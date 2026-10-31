"use client";

import { WEEKDAY_LABELS } from "@/lib/dates";
import { MAX_WEEKLY_SCHEDULES } from "../schemas";

export interface ScheduleRow {
  key: number;
  weekday: string;
  startTime: string;
  endTime: string;
}

let nextRowKey = 0;

export function newScheduleRow(previous?: ScheduleRow): ScheduleRow {
  nextRowKey += 1;
  // 새 행은 직전 행의 시간을 이어받는다(같은 시간에 요일만 다른 경우가 많다)
  return {
    key: nextRowKey,
    weekday: previous ? String((Number(previous.weekday) % 7) + 1) : "1",
    startTime: previous?.startTime ?? "16:00",
    endTime: previous?.endTime ?? "17:00",
  };
}

/** 지금 규칙으로 행을 채운다 (앞으로 전체 변경 화면의 시작값) */
export function scheduleRowsFrom(
  rules: readonly { weekday: number; start_time: string; end_time: string }[],
): ScheduleRow[] {
  if (rules.length === 0) return [newScheduleRow()];
  return rules.map((rule) => ({
    ...newScheduleRow(),
    weekday: String(rule.weekday),
    startTime: rule.start_time.slice(0, 5),
    endTime: rule.end_time.slice(0, 5),
  }));
}

interface ScheduleRowsProps {
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  error?: string;
}

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ value: String(day), label: WEEKDAY_LABELS[day] }));
const INPUT_CLASS =
  "h-11 min-w-0 rounded-xl border border-border bg-surface px-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ScheduleRows({ rows, onChange, error }: ScheduleRowsProps) {
  function update(key: number, patch: Partial<ScheduleRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">정규 수업 시간</legend>
      {rows.map((row, index) => (
        // 휴대폰에서 시각 입력칸("오후 04:00")이 잘리지 않도록 요일과 시간을 두 줄로 나눈다
        <div key={row.key} className="flex flex-col gap-2 rounded-xl bg-background p-2">
          <div className="flex items-center gap-2">
            <select
              name="weekday"
              aria-label={`${index + 1}번째 수업 요일`}
              value={row.weekday}
              onChange={(event) => update(row.key, { weekday: event.target.value })}
              className={`${INPUT_CLASS} flex-1`}
            >
              {WEEKDAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}요일
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`${index + 1}번째 수업 시간 삭제`}
              disabled={rows.length === 1}
              onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
              className="size-11 shrink-0 rounded-lg text-muted hover:text-danger disabled:opacity-30"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              type="time"
              name="startTime"
              step={300}
              aria-label={`${index + 1}번째 수업 시작 시각`}
              value={row.startTime}
              onChange={(event) => update(row.key, { startTime: event.target.value })}
              className={INPUT_CLASS}
            />
            <span aria-hidden className="text-muted">
              –
            </span>
            <input
              type="time"
              name="endTime"
              step={300}
              aria-label={`${index + 1}번째 수업 종료 시각`}
              value={row.endTime}
              onChange={(event) => update(row.key, { endTime: event.target.value })}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      ))}
      {rows.length < MAX_WEEKLY_SCHEDULES ? (
        <button
          type="button"
          onClick={() => onChange([...rows, newScheduleRow(rows.at(-1))])}
          className="self-start rounded-lg px-1 py-1 text-sm font-semibold text-primary"
        >
          + 요일 추가
        </button>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}
