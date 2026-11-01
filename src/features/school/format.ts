import { formatDayLabel, type IsoDate } from "@/lib/dates";

export const SCHOOL_KINDS = ["academic", "event", "homework", "exam", "holiday"] as const;
export type SchoolKind = (typeof SCHOOL_KINDS)[number];

export const KIND_LABELS: Record<SchoolKind, string> = {
  academic: "학사일정",
  event: "행사",
  homework: "과제",
  exam: "시험",
  holiday: "휴업·방학",
};

interface Dated {
  eventDate: IsoDate;
  endDate: IsoDate | null;
}

export function eventDateLabel({ eventDate, endDate }: Dated): string {
  if (!endDate || endDate === eventDate) return formatDayLabel(eventDate);
  return `${formatDayLabel(eventDate)} ~ ${formatDayLabel(endDate)}`;
}

export function isOnDate({ eventDate, endDate }: Dated, date: IsoDate): boolean {
  return date >= eventDate && date <= (endDate ?? eventDate);
}

/** 챙겨야 할 일: 안 끝낸 과제, 시험, 덜 챙긴 준비물 */
export function needsAttention(event: { kind: SchoolKind; done: boolean; uncheckedCount: number }): boolean {
  if (event.uncheckedCount > 0) return true;
  if (event.kind === "homework") return !event.done;
  return event.kind === "exam";
}
