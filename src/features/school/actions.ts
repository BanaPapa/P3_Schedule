"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, ERROR_MESSAGES } from "@/lib/errors";
import { failure, formValues, success, validationError, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireFamily } from "@/features/family/queries";
import { eventRefSchema, itemToggleSchema, parseEventForm, scoreSchema } from "./schemas";

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function dbFailure(action: string, error: PostgrestLikeError, values?: Record<string, string>): FormState {
  if (error.code !== "P0001") logger.error(`${action} failed`, { code: error.code });
  return failure(dbErrorMessage(error), values);
}

function refreshSchoolPages(eventId?: string): void {
  revalidatePath(ROUTES.school);
  if (eventId) revalidatePath(ROUTES.schoolEvent(eventId));
  revalidatePath(ROUTES.calendar);
  revalidatePath(ROUTES.home);
}

export async function createSchoolEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["childId", "kind", "eventDate", "endDate", "title", "subject", "memo", "supplies"]);
  const parsed = parseEventForm(formData);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const event = parsed.data;
  const { data, error } = await supabase
    .from("school_events")
    .insert({
      family_id: family.id,
      child_id: event.childId,
      kind: event.kind,
      event_date: event.eventDate,
      end_date: event.endDate,
      title: event.title,
      subject: event.subject,
      memo: event.memo,
    })
    .select("id")
    .single();
  if (error) return dbFailure("create_school_event", error, values);

  if (event.supplies.length > 0) {
    const { error: itemsError } = await supabase
      .from("school_event_items")
      .insert(event.supplies.map((label) => ({ family_id: family.id, event_id: data.id, label })));
    if (itemsError) return dbFailure("add_school_supplies", itemsError, values);
  }

  refreshSchoolPages(data.id);
  return success(`'${event.title}'을(를) 등록했습니다.`);
}

export async function toggleDoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = eventRefSchema.safeParse(formValues(formData, ["id"]));
  const done = formData.get("done") === "true";
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase.from("school_events").update({ done }).eq("id", parsed.data.id);
  if (error) return dbFailure("toggle_homework_done", error);
  refreshSchoolPages(parsed.data.id);
  return success(done ? "끝냈습니다." : "다시 할 일로 돌렸습니다.");
}

export async function toggleSupplyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = itemToggleSchema.safeParse(formValues(formData, ["id", "eventId", "checked"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("school_event_items")
    .update({ checked: parsed.data.checked === "true" })
    .eq("id", parsed.data.id)
    .eq("event_id", parsed.data.eventId);
  if (error) return dbFailure("toggle_supply", error);
  refreshSchoolPages(parsed.data.eventId);
  return success("준비물을 표시했습니다.");
}

export async function saveScoreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["id", "score", "maxScore"]);
  const parsed = scoreSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase
    .from("school_events")
    .update({ score: parsed.data.score, max_score: parsed.data.maxScore })
    .eq("id", parsed.data.id);
  if (error) return dbFailure("save_exam_score", error, values);
  refreshSchoolPages(parsed.data.id);
  return success("점수를 저장했습니다.");
}

export async function deleteSchoolEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = eventRefSchema.safeParse(formValues(formData, ["id"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase.from("school_events").delete().eq("id", parsed.data.id);
  if (error) return dbFailure("delete_school_event", error);
  refreshSchoolPages();
  redirect(ROUTES.school);
}
