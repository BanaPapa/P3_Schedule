"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, ERROR_MESSAGES, SESSION_CONFLICT } from "@/lib/errors";
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
import { SESSION_STATUS_LABELS } from "@/features/education/format";
import { sessionNoteSchema, sessionSlotSchema, sessionStatusSchema, sessionWaiveSchema } from "./schemas";

const SLOT_FIELDS = ["id", "version", "date", "startTime", "endTime"] as const;

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function rpcFailure(action: string, error: PostgrestLikeError, values?: Record<string, string>): FormState {
  if (error.message === SESSION_CONFLICT) return conflict();
  if (error.code !== "P0001") logger.error(`${action} failed`, { code: error.code });
  return failure(dbErrorMessage(error), values);
}

/** 회차가 바뀌면 그 회차를 보여 주는 모든 화면을 새로 그린다 */
function refreshSessionPages(...sessionIds: string[]): void {
  for (const id of sessionIds) revalidatePath(ROUTES.session(id));
  revalidatePath(ROUTES.calendar);
  revalidatePath(ROUTES.education);
  revalidatePath(ROUTES.home);
}

export async function setSessionStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = sessionStatusSchema.safeParse(formValues(formData, ["id", "version", "status"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_session_status", {
    p_session_id: parsed.data.id,
    p_version: parsed.data.version,
    p_status: parsed.data.status,
  });
  refreshSessionPages(parsed.data.id);
  if (error) return rpcFailure("set_session_status", error);
  return success(`'${SESSION_STATUS_LABELS[parsed.data.status]}'(으)로 바꿨습니다.`);
}

export async function rescheduleSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, SLOT_FIELDS);
  const parsed = sessionSlotSchema().safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data: resultId, error } = await supabase.rpc("reschedule_session", {
    p_session_id: parsed.data.id,
    p_version: parsed.data.version,
    p_date: parsed.data.date,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
  });
  refreshSessionPages(parsed.data.id);
  if (error) return rpcFailure("reschedule_session", error, values);
  // 다른 날로 옮기면 원래 수업은 취소되어 이 화면의 변경 폼이 사라진다. 새 수업 화면으로 보낸다.
  if (resultId !== parsed.data.id) redirect(ROUTES.session(resultId));
  return success("시간을 바꿨습니다.");
}

export async function createMakeupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, SLOT_FIELDS);
  const parsed = sessionSlotSchema().safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_makeup", {
    p_session_id: parsed.data.id,
    p_version: parsed.data.version,
    p_date: parsed.data.date,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
  });
  refreshSessionPages(parsed.data.id);
  if (error) return rpcFailure("create_makeup", error, values);
  return success("보강 일정을 등록했습니다.");
}

export async function setMakeupWaivedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = sessionWaiveSchema.safeParse(formValues(formData, ["id", "version", "waived"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_makeup_waived", {
    p_session_id: parsed.data.id,
    p_version: parsed.data.version,
    p_waived: parsed.data.waived,
  });
  refreshSessionPages(parsed.data.id);
  if (error) return rpcFailure("set_makeup_waived", error);
  return success(parsed.data.waived ? "보강 없이 넘어가기로 했습니다." : "다시 보강 대기에 올렸습니다.");
}

export async function updateSessionNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["id", "version", "note"]);
  const parsed = sessionNoteSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .update({ note: parsed.data.note })
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id");
  refreshSessionPages(parsed.data.id);
  if (error) return rpcFailure("update_session_note", error, values);
  if (data.length === 0) return conflict();
  return success("메모를 저장했습니다.");
}
