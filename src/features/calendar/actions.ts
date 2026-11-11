"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, ERROR_MESSAGES, SESSION_CONFLICT } from "@/lib/errors";
import { conflict, failure, formValues, success, validationError, type FormState } from "@/lib/form-state";
import { isoWeekday, todayInSeoul } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { sessionDeleteSchema, sessionEditSchema, weeklyFrom } from "./edit-schemas";

const EDIT_FIELDS = ["id", "version", "childId", "originalChildId", "date", "startTime", "endTime", "scope"] as const;

interface RpcError {
  code?: string;
  message?: string;
}

function rpcFailure(action: string, error: RpcError, values?: Record<string, string>): FormState {
  if (error.message === SESSION_CONFLICT) return conflict();
  if (error.code !== "P0001") logger.error(`${action} failed`, { code: error.code });
  return failure(dbErrorMessage(error), values);
}

function refreshPages(sessionId: string): void {
  revalidatePath(ROUTES.session(sessionId));
  revalidatePath(ROUTES.calendar);
  revalidatePath(ROUTES.education);
  revalidatePath(ROUTES.home);
}

/** 바꾸기 전 회차의 날짜·종류·자녀. RLS 로 우리 가족 회차만 보인다 */
async function loadSession(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select("session_date, kind, enrollment:enrollments!inner (child_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) logger.error("load session for edit failed", { code: error.code });
  return { supabase, session: data };
}

/** 캘린더 더블클릭 편집·끌어 옮기기: 이번만(그 회차) 또는 앞으로 매주(그 요일·시간 규칙) */
export async function editSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, EDIT_FIELDS);
  const parsed = sessionEditSchema().safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  const input = parsed.data;

  const { supabase, session } = await loadSession(input.id);
  if (!session) return failure(ERROR_MESSAGES.session_not_found, values);

  if (input.scope === "once") {
    const { error } = await supabase.rpc("reschedule_session", {
      p_session_id: input.id,
      p_version: input.version,
      p_date: input.date,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
    });
    refreshPages(input.id);
    if (error) return rpcFailure("reschedule_session", error, values);
    return success("이번 수업만 바꿨습니다.");
  }

  if (session.kind !== "regular") return failure(ERROR_MESSAGES.only_regular_session, values);
  const slot = {
    p_session_id: input.id,
    p_version: input.version,
    p_from: weeklyFrom(session.session_date, input.date, todayInSeoul()),
    p_weekday: isoWeekday(input.date),
    p_start: input.startTime,
    p_end: input.endTime,
  };
  const childChanged = input.childId !== session.enrollment.child_id;
  const { error } = childChanged
    ? await supabase.rpc("move_rule_to_child", { ...slot, p_child_id: input.childId })
    : await supabase.rpc("change_rule_from", slot);
  refreshPages(input.id);
  if (error) return rpcFailure(childChanged ? "move_rule_to_child" : "change_rule_from", error, values);
  return success(childChanged ? "앞으로 매주 다른 아이 수업으로 옮겼습니다." : "앞으로 매주 바꿨습니다.");
}

/** 캘린더 우클릭 삭제: 이번만(취소로 남김) 또는 앞으로 매주(그 요일·시간 수업을 없앰) */
export async function deleteSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = sessionDeleteSchema.safeParse(formValues(formData, ["id", "version", "scope"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);
  const input = parsed.data;

  const { supabase, session } = await loadSession(input.id);
  if (!session) return failure(ERROR_MESSAGES.session_not_found);

  if (input.scope === "once") {
    // 회차는 지우지 않고 취소로 남긴다(지난 기록·학원비 계산이 회차 단위라서)
    const { error } = await supabase.rpc("set_session_status", {
      p_session_id: input.id,
      p_version: input.version,
      p_status: "cancelled",
    });
    refreshPages(input.id);
    if (error) return rpcFailure("set_session_status", error);
    return success("이번 수업을 취소했습니다.");
  }

  if (session.kind !== "regular") return failure(ERROR_MESSAGES.only_regular_session);
  const today = todayInSeoul();
  const { error } = await supabase.rpc("remove_rule_from", {
    p_session_id: input.id,
    p_version: input.version,
    p_from: session.session_date > today ? session.session_date : today,
  });
  refreshPages(input.id);
  if (error) return rpcFailure("remove_rule_from", error);
  return success("앞으로 매주 이 시간 수업을 없앴습니다.");
}
