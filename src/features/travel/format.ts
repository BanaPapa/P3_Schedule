import { datesBetween, daysBetween, type IsoDate } from "@/lib/dates";

export const TRIP_CATEGORIES = ["transport", "lodging", "food", "activity", "shopping", "etc"] as const;
export type TripCategory = (typeof TRIP_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<TripCategory, string> = {
  transport: "교통",
  lodging: "숙박",
  food: "식비",
  activity: "관광·체험",
  shopping: "쇼핑",
  etc: "기타",
};

/** 여행 첫날부터 마지막 날까지 */
export function tripDays(startDate: IsoDate, endDate: IsoDate): IsoDate[] {
  return datesBetween(startDate, endDate);
}

/** 여행 며칠째인지 (첫날 = 1) */
export function tripDayNumber(startDate: IsoDate, day: IsoDate): number {
  return daysBetween(startDate, day) + 1;
}

/** "D-12", "여행 중 · 2일차", "다녀옴" */
export function tripStatusLabel(today: IsoDate, startDate: IsoDate, endDate: IsoDate): string {
  if (today < startDate) return `D-${daysBetween(today, startDate)}`;
  if (today <= endDate) return `여행 중 · ${tripDayNumber(startDate, today)}일차`;
  return "다녀옴";
}
