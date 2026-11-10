/**
 * 날짜는 서울 기준 "YYYY-MM-DD" 문자열로 다룬다(DB 의 date 와 같다).
 * 계산은 UTC 자정 Date 로 해서 시간대·서머타임 영향을 받지 않게 한다.
 */
export type IsoDate = string;

export interface YearMonth {
  year: number;
  month: number; // 1..12
}

export const FAMILY_TIME_ZONE = "Asia/Seoul";

/** ISO 요일(1=월 … 7=일) → 한 글자 */
export const WEEKDAY_LABELS: Readonly<Record<number, string>> = {
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
  7: "일",
};

/** 캘린더 머리글 순서(월요일 시작) */
export const CALENDAR_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

function toUtc(iso: IsoDate): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function todayInSeoul(now: Date = new Date()): IsoDate {
  // en-CA 형식이 YYYY-MM-DD 다
  return new Intl.DateTimeFormat("en-CA", { timeZone: FAMILY_TIME_ZONE }).format(now);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

export function isoWeekday(iso: IsoDate): number {
  const day = toUtc(iso).getUTCDay(); // 0=일
  return day === 0 ? 7 : day;
}

/** 날짜가 속한 주(월~일) 7일 */
export function weekDates(iso: IsoDate): IsoDate[] {
  const monday = addDays(iso, 1 - isoWeekday(iso));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function parseMonth(value: string | undefined | null): YearMonth | null {
  const match = value ? YEAR_MONTH.exec(value) : null;
  if (!match) return null;
  const [year, month] = match.slice(1).map(Number);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

export function monthOf(iso: IsoDate): YearMonth {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

export function formatMonthParam({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function addMonths({ year, month }: YearMonth, months: number): YearMonth {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthBounds(value: YearMonth): { first: IsoDate; last: IsoDate } {
  const first = `${formatMonthParam(value)}-01`;
  const next = addMonths(value, 1);
  return { first, last: addDays(`${formatMonthParam(next)}-01`, -1) };
}

/** 월요일 시작, 7일씩 끊은 달력 칸. 앞뒤는 이웃 달 날짜로 채운다. */
export function monthGrid(value: YearMonth): IsoDate[][] {
  const { first, last } = monthBounds(value);
  const start = weekDates(first)[0];
  const end = weekDates(last)[6];
  const weeks: IsoDate[][] = [];
  for (let day = start; day <= end; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(day, index)));
  }
  return weeks;
}

/** "2026-03-02" → "2026. 3. 2." */
export function formatDotDate(iso: IsoDate): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${year}. ${month}. ${day}.`;
}

/** "16:00:00" → "16:00" */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatMonthLabel({ year, month }: YearMonth): string {
  return `${year}년 ${month}월`;
}

/** "2026-11-03" → "11월 3일 (화)" */
export function formatDayLabel(iso: IsoDate): string {
  const { month } = monthOf(iso);
  const day = Number(iso.slice(8, 10));
  return `${month}월 ${day}일 (${WEEKDAY_LABELS[isoWeekday(iso)]})`;
}

/** 서울 기준 "HH:MM" */
function seoulTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: FAMILY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** 변경 이력 시각: "방금", "5분 전", "3시간 전", "어제 20:00", "11월 1일 08:05" */
export function formatRelative(isoDateTime: string, now: Date = new Date()): string {
  const then = new Date(isoDateTime);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  const today = todayInSeoul(now);
  const day = todayInSeoul(then);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (day === today) return `${Math.floor(minutes / 60)}시간 전`;
  if (day === addDays(today, -1)) return `어제 ${seoulTime(then)}`;
  const { month } = monthOf(day);
  return `${month}월 ${Number(day.slice(8))}일 ${seoulTime(then)}`;
}

/** b - a (일). 같은 날이면 0 */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** start ~ end 의 모든 날짜 (end 포함) */
export function datesBetween(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}
