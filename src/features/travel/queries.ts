import "server-only";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { TripCategory } from "./format";

export interface Trip {
  id: string;
  version: number;
  title: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  budgetAmount: number | null;
  memo: string | null;
  plannedTotal: number;
  spentTotal: number;
}

export interface TripItem {
  id: string;
  tripId: string;
  dayDate: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  placeName: string | null;
  address: string | null;
  memo: string | null;
}

export interface CategoryTotal {
  category: TripCategory;
  plannedAmount: number;
  spentAmount: number;
}

export interface TripExpense {
  id: string;
  spentOn: string;
  category: TripCategory;
  amount: number;
  description: string | null;
}

export interface TripDetail {
  trip: Trip;
  items: TripItem[];
  categories: CategoryTotal[];
  expenses: TripExpense[];
}

function loadFailed(what: string, code: string | undefined): never {
  logger.error(`failed to load ${what}`, { code });
  throw new Error("여행 정보를 불러오지 못했습니다.");
}

interface TripRow {
  id: string | null;
  version: number | null;
  title: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  memo: string | null;
  planned_total: number | null;
  spent_total: number | null;
}

function toTrip(row: TripRow): Trip {
  return {
    id: row.id as string,
    version: row.version as number,
    title: row.title as string,
    destination: row.destination,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    budgetAmount: row.budget_amount,
    memo: row.memo,
    plannedTotal: Number(row.planned_total ?? 0),
    spentTotal: Number(row.spent_total ?? 0),
  };
}

interface ItemRow {
  id: string;
  trip_id: string;
  day_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  place_name: string | null;
  address: string | null;
  memo: string | null;
}

function toItem(row: ItemRow): TripItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayDate: row.day_date,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    placeName: row.place_name,
    address: row.address,
    memo: row.memo,
  };
}

const ITEM_COLUMNS = "id, trip_id, day_date, start_time, end_time, title, place_name, address, memo";

/** 가족 여행 (최근 출발 순) */
export async function getTrips(): Promise<Trip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("trip_summaries").select("*").order("start_date", { ascending: false });
  if (error) loadFailed("trips", error.code);
  return data.map(toTrip);
}

export async function getTripDetail(id: string): Promise<TripDetail | null> {
  const supabase = await createClient();
  const [trip, items, categories, expenses] = await Promise.all([
    supabase.from("trip_summaries").select("*").eq("id", id).maybeSingle(),
    supabase.from("trip_items").select(ITEM_COLUMNS).eq("trip_id", id).order("day_date").order("start_time", { nullsFirst: true }),
    supabase.from("trip_category_totals").select("category, planned_amount, spent_amount").eq("trip_id", id),
    supabase.from("trip_expenses").select("id, spent_on, category, amount, description").eq("trip_id", id).order("spent_on"),
  ]);
  if (trip.error) loadFailed("trip", trip.error.code);
  if (!trip.data) return null;
  if (items.error) loadFailed("trip items", items.error.code);
  if (categories.error) loadFailed("trip budgets", categories.error.code);
  if (expenses.error) loadFailed("trip expenses", expenses.error.code);

  return {
    trip: toTrip(trip.data),
    items: items.data.map(toItem),
    categories: categories.data.map((row) => ({
      category: row.category as TripCategory,
      plannedAmount: Number(row.planned_amount ?? 0),
      spentAmount: Number(row.spent_amount ?? 0),
    })),
    expenses: expenses.data.map((row) => ({
      id: row.id,
      spentOn: row.spent_on,
      category: row.category,
      amount: row.amount,
      description: row.description,
    })),
  };
}

export interface CalendarTrips {
  trips: Trip[];
  items: TripItem[];
}

/** 캘린더 범위와 겹치는 여행과 그 안의 일정 */
export async function getTripsBetween(from: string, to: string): Promise<CalendarTrips> {
  const supabase = await createClient();
  const [trips, items] = await Promise.all([
    supabase.from("trip_summaries").select("*").lte("start_date", to).gte("end_date", from),
    supabase
      .from("trip_items")
      .select(ITEM_COLUMNS)
      .gte("day_date", from)
      .lte("day_date", to)
      .order("day_date")
      .order("start_time", { nullsFirst: true }),
  ]);
  if (trips.error) loadFailed("calendar trips", trips.error.code);
  if (items.error) loadFailed("calendar trip items", items.error.code);
  return { trips: trips.data.map(toTrip), items: items.data.map(toItem) };
}

export interface MonthTripSpending {
  tripId: string;
  title: string;
  amount: number;
}

/** 그 달에 쓴 여행 지출 (지출일 기준) */
export async function getTripSpendingInMonth(firstDay: string, lastDay: string): Promise<MonthTripSpending[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_expenses")
    .select("amount, trip:trips!inner (id, title)")
    .gte("spent_on", firstDay)
    .lte("spent_on", lastDay);
  if (error) loadFailed("month trip spending", error.code);

  const byTrip = new Map<string, MonthTripSpending>();
  for (const row of data) {
    const current = byTrip.get(row.trip.id) ?? { tripId: row.trip.id, title: row.trip.title, amount: 0 };
    byTrip.set(row.trip.id, { ...current, amount: current.amount + row.amount });
  }
  return [...byTrip.values()];
}
