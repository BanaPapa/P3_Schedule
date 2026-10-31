import { formatDotDate, formatTime, WEEKDAY_LABELS, type IsoDate } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

type SessionStatus = Database["public"]["Enums"]["class_session_status"];
type SessionKind = Database["public"]["Enums"]["class_session_kind"];

/** 정규 수업은 따로 표시하지 않는다 */
export const SESSION_KIND_LABELS: Record<SessionKind, string | null> = {
  regular: null,
  makeup: "보강",
  rescheduled: "변경",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: "예정",
  completed: "완료",
  absent: "결석",
  academy_cancelled: "휴강",
  cancelled: "취소",
  makeup_scheduled: "보강 예정",
  makeup_completed: "보강 완료",
};

interface RuleLike {
  weekday: number;
  start_time: string;
  end_time: string;
  effective_until: string | null;
}

/** 오늘 이후에도 유효한 규칙 */
export function currentRules<T extends RuleLike>(rules: readonly T[], today: IsoDate): T[] {
  return rules.filter((rule) => rule.effective_until === null || rule.effective_until >= today);
}

/** "월·수 15:00–16:00 · 금 17:00–18:00". 같은 시간대의 요일은 묶는다. */
export function scheduleSummary(rules: readonly RuleLike[]): string {
  if (rules.length === 0) return "정규 수업 없음";

  const byTime = new Map<string, number[]>();
  for (const rule of [...rules].sort((a, b) => a.weekday - b.weekday)) {
    const time = `${formatTime(rule.start_time)}–${formatTime(rule.end_time)}`;
    byTime.set(time, [...(byTime.get(time) ?? []), rule.weekday]);
  }
  return [...byTime.entries()]
    .map(([time, weekdays]) => `${weekdays.map((day) => WEEKDAY_LABELS[day]).join("·")} ${time}`)
    .join(" · ");
}

export function isEnded(endDate: IsoDate | null, today: IsoDate): boolean {
  return endDate !== null && endDate < today;
}

export function enrollmentPeriodLabel(startDate: IsoDate, endDate: IsoDate | null, today: IsoDate): string {
  if (endDate === null) return `${formatDotDate(startDate)}부터`;
  if (isEnded(endDate, today)) return `${formatDotDate(endDate)} 종료`;
  return `${formatDotDate(startDate)} ~ ${formatDotDate(endDate)}`;
}
