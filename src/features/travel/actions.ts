"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, ERROR_MESSAGES } from "@/lib/errors";
import {
  conflict,
  failure,
  formValues,
  success,
  validationError,
  type FormState,
} from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireFamily } from "@/features/family/queries";
import {
  budgetSchema,
  expenseSchema,
  itemSchema,
  travelRowSchema,
  tripCreateSchema,
  tripDeleteSchema,
  tripUpdateSchema,
} from "./schemas";

const TRIP_FIELDS = ["title", "destination", "startDate", "endDate", "budgetAmount", "memo"] as const;
const ITEM_FIELDS = ["tripId", "dayDate", "startTime", "endTime", "title", "placeName", "address", "memo"] as const;

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function dbFailure(action: string, error: PostgrestLikeError, values?: Record<string, string>): FormState {
  if (error.code !== "P0001") logger.error(`${action} failed`, { code: error.code });
  return failure(dbErrorMessage(error), values);
}

function refreshTravelPages(tripId?: string): void {
  revalidatePath(ROUTES.travel);
  if (tripId) revalidatePath(ROUTES.trip(tripId));
  revalidatePath(ROUTES.calendar);
  revalidatePath(ROUTES.costs);
  revalidatePath(ROUTES.home);
}

export async function createTripAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, TRIP_FIELDS);
  const parsed = tripCreateSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      family_id: family.id,
      title: parsed.data.title,
      destination: parsed.data.destination,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      budget_amount: parsed.data.budgetAmount,
      memo: parsed.data.memo,
    })
    .select("id")
    .single();
  if (error) return dbFailure("create_trip", error, values);

  refreshTravelPages();
  redirect(ROUTES.trip(data.id));
}

export async function updateTripAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["id", "version", ...TRIP_FIELDS]);
  const parsed = tripUpdateSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .update({
      title: parsed.data.title,
      destination: parsed.data.destination,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      budget_amount: parsed.data.budgetAmount,
      memo: parsed.data.memo,
    })
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id");
  refreshTravelPages(parsed.data.id);
  if (error) return dbFailure("update_trip", error, values);
  if (data.length === 0) return conflict();
  return success("여행 정보를 저장했습니다.");
}

export async function deleteTripAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = tripDeleteSchema.safeParse(formValues(formData, ["id", "version"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .delete()
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id");
  if (error) return dbFailure("delete_trip", error);
  if (data.length === 0) return conflict();

  refreshTravelPages();
  redirect(ROUTES.travel);
}

export async function addTripItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ITEM_FIELDS);
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const item = parsed.data;
  const { error } = await supabase.from("trip_items").insert({
    family_id: family.id,
    trip_id: item.tripId,
    day_date: item.dayDate,
    start_time: item.startTime,
    end_time: item.endTime,
    title: item.title,
    place_name: item.placeName,
    address: item.address,
    memo: item.memo,
  });
  if (error) return dbFailure("add_trip_item", error, values);

  refreshTravelPages(item.tripId);
  return success(`'${item.title}' 일정을 넣었습니다.`);
}

export async function deleteTripRowAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const table = formData.get("table");
  const parsed = travelRowSchema.safeParse(formValues(formData, ["id", "tripId"]));
  if (!parsed.success || (table !== "trip_items" && table !== "trip_expenses" && table !== "trip_budgets")) {
    return failure(ERROR_MESSAGES.invalid_input);
  }

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", parsed.data.id).eq("trip_id", parsed.data.tripId);
  if (error) return dbFailure(`delete_${table}`, error);

  refreshTravelPages(parsed.data.tripId);
  return success("지웠습니다.");
}

/** 분류별 예산: 있으면 고치고 없으면 넣는다 */
export async function saveBudgetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["tripId", "category", "plannedAmount"]);
  const parsed = budgetSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const { tripId, category, plannedAmount } = parsed.data;
  const updated = await supabase
    .from("trip_budgets")
    .update({ planned_amount: plannedAmount })
    .eq("trip_id", tripId)
    .eq("category", category)
    .select("id");
  if (updated.error) return dbFailure("update_trip_budget", updated.error, values);
  if (updated.data.length === 0) {
    const inserted = await supabase
      .from("trip_budgets")
      .insert({ family_id: family.id, trip_id: tripId, category, planned_amount: plannedAmount });
    if (inserted.error) return dbFailure("add_trip_budget", inserted.error, values);
  }

  refreshTravelPages(tripId);
  return success("예산을 저장했습니다.");
}

export async function addExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["tripId", "spentOn", "category", "amount", "description"]);
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const expense = parsed.data;
  const { error } = await supabase.from("trip_expenses").insert({
    family_id: family.id,
    trip_id: expense.tripId,
    spent_on: expense.spentOn,
    category: expense.category,
    amount: expense.amount,
    description: expense.description,
  });
  if (error) return dbFailure("add_trip_expense", error, values);

  refreshTravelPages(expense.tripId);
  return success("지출을 기록했습니다.");
}
