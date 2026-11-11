import { z } from "zod";
import {
  addDays,
  addMonths,
  formatMonthParam,
  isIsoDate,
  monthGrid,
  monthOf,
  weekDates,
  type IsoDate,
} from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

/** 월간 / 주간 캘린더 / 주간 표(자녀·학원 × 요일) */
export type CalendarView = "month" | "week" | "table";

const VIEWS: readonly CalendarView[] = ["month", "week", "table"];

/** 주 단위로 움직이는 보기 */
export const isWeekly = (view: CalendarView) => view !== "month";

export interface CalendarParams {
  view: CalendarView;
  /** 보고 있는 날짜. 월간이면 그 달, 주간·표면 그 주, 아래 목록은 이 날짜 */
  date: IsoDate;
  childId: string | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

/** DB ensure_sessions_until 의 한도(400일)보다 짧게 둔다 */
const MAX_DAYS_AHEAD = 365;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseCalendarParams(searchParams: SearchParams, today: IsoDate): CalendarParams {
  const rawView = single(searchParams.view);
  const view = VIEWS.find((candidate) => candidate === rawView) ?? "week";
  const rawDate = single(searchParams.date);
  const latest = addDays(today, MAX_DAYS_AHEAD);
  const date = rawDate && isIsoDate(rawDate) ? (rawDate > latest ? latest : rawDate) : today;
  const child = z.uuid().safeParse(single(searchParams.child));
  return { view, date, childId: child.success ? child.data : null };
}

/** 화면에 보이는 칸 전체(월간은 앞뒤 이웃 달 포함) */
export function calendarRange({ view, date }: CalendarParams): { from: IsoDate; to: IsoDate } {
  if (isWeekly(view)) {
    const days = weekDates(date);
    return { from: days[0], to: days[6] };
  }
  const grid = monthGrid(monthOf(date));
  return { from: grid[0][0], to: grid[grid.length - 1][6] };
}

export function shiftCalendar(params: CalendarParams, step: 1 | -1): CalendarParams {
  if (isWeekly(params.view)) return { ...params, date: addDays(params.date, 7 * step) };
  const month = addMonths(monthOf(params.date), step);
  return { ...params, date: `${formatMonthParam(month)}-01` };
}

export function calendarHref(params: CalendarParams, today: IsoDate): string {
  const query = new URLSearchParams();
  if (params.view !== "week") query.set("view", params.view);
  if (params.date !== today) query.set("date", params.date);
  if (params.childId) query.set("child", params.childId);
  const search = query.toString();
  return search ? `${ROUTES.calendar}?${search}` : ROUTES.calendar;
}

export function groupByDate<T extends { date: IsoDate }>(items: readonly T[]): Map<IsoDate, T[]> {
  const groups = new Map<IsoDate, T[]>();
  for (const item of items) {
    groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
  }
  return groups;
}
