"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, ERROR_MESSAGES } from "@/lib/errors";
import { failure, formValues, success, validationError, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireFamily } from "@/features/family/queries";
import { logSchema, studyRowSchema, subjectSchema } from "./schemas";

const DUPLICATE = "23505";

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function dbFailure(action: string, error: PostgrestLikeError, values?: Record<string, string>): FormState {
  if (error.code !== "P0001") logger.error(`${action} failed`, { code: error.code });
  return failure(dbErrorMessage(error), values);
}

function refreshStudyPages(): void {
  revalidatePath(ROUTES.study);
  revalidatePath(ROUTES.home);
}

export async function addSubjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["childId", "name", "textbook", "goal"]);
  const parsed = subjectSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const { error } = await supabase.from("study_subjects").insert({
    family_id: family.id,
    child_id: parsed.data.childId,
    name: parsed.data.name,
    textbook: parsed.data.textbook,
    goal: parsed.data.goal,
  });
  if (error?.code === DUPLICATE) return failure("이 자녀에게 같은 이름의 과목이 이미 있습니다.", values);
  if (error) return dbFailure("add_study_subject", error, values);

  refreshStudyPages();
  return success(`${parsed.data.name} 과목을 추가했습니다.`);
}

export async function addStudyLogAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["subjectId", "studiedOn", "minutes", "unit", "progressPercent", "content"]);
  const parsed = logSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const log = parsed.data;
  const { error } = await supabase.from("study_logs").insert({
    family_id: family.id,
    subject_id: log.subjectId,
    studied_on: log.studiedOn,
    minutes: log.minutes,
    unit: log.unit,
    progress_percent: log.progressPercent,
    content: log.content,
  });
  if (error) return dbFailure("add_study_log", error, values);

  refreshStudyPages();
  return success("학습 기록을 남겼습니다.");
}

export async function deleteStudyRowAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const table = formData.get("table");
  const parsed = studyRowSchema.safeParse(formValues(formData, ["id"]));
  if (!parsed.success || (table !== "study_logs" && table !== "study_subjects")) {
    return failure(ERROR_MESSAGES.invalid_input);
  }
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", parsed.data.id);
  if (error) return dbFailure(`delete_${table}`, error);
  refreshStudyPages();
  return success("지웠습니다.");
}
