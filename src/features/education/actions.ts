"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, ERROR_MESSAGES, FOREIGN_KEY_VIOLATION } from "@/lib/errors";
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
import { todayInSeoul } from "@/lib/dates";
import { enrollmentOverlapNotice } from "./overlap";
import { getEnrollments } from "./queries";
import {
  academyCreateSchema,
  academyDeleteSchema,
  academyUpdateSchema,
  enrollmentDeleteSchema,
  enrollmentEndSchema,
  parseEnrollmentForm,
  parseScheduleChangeForm,
} from "./schemas";

const ACADEMY_FIELDS = ["name", "phone", "contactName", "memo"] as const;
const ENROLLMENT_FIELDS = ["childId", "academyId", "memo", "startDate", "endDate"] as const;

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function dbFailure(action: string, error: PostgrestLikeError, values?: Record<string, string>): FormState {
  if (error.code !== "P0001") logger.error(`${action} failed`, { code: error.code });
  return failure(dbErrorMessage(error), values);
}

function refreshEducationPages(): void {
  revalidatePath(ROUTES.education);
  revalidatePath(ROUTES.manage, "layout");
  revalidatePath(ROUTES.calendar);
  revalidatePath(ROUTES.home);
}

export async function createAcademyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ACADEMY_FIELDS);
  const parsed = academyCreateSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family } = await requireFamily();
  const supabase = await createClient();
  const { error } = await supabase.from("academies").insert({
    family_id: family.id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    contact_name: parsed.data.contactName,
    memo: parsed.data.memo,
  });
  if (error) return dbFailure("create_academy", error, values);

  refreshEducationPages();
  return success(`${parsed.data.name}을(를) 등록했습니다.`);
}

export async function updateAcademyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["id", "version", ...ACADEMY_FIELDS]);
  const parsed = academyUpdateSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academies")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone,
      contact_name: parsed.data.contactName,
      memo: parsed.data.memo,
    })
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id");
  if (error) return dbFailure("update_academy", error, values);

  refreshEducationPages();
  if (data.length === 0) return conflict();
  return success("저장했습니다.");
}

export async function deleteAcademyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = academyDeleteSchema.safeParse(formValues(formData, ["id", "version"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academies")
    .delete()
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id");
  if (error?.code === FOREIGN_KEY_VIOLATION) return failure(ERROR_MESSAGES.academy_in_use);
  if (error) return dbFailure("delete_academy", error);

  refreshEducationPages();
  if (data.length === 0) return conflict();
  // 지운 학원의 상세 화면에 남아 있지 않게 관리 화면으로 보낸다
  redirect(ROUTES.manage);
}

export async function createEnrollmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ENROLLMENT_FIELDS);
  const parsed = parseEnrollmentForm(formData);
  if (!parsed.success) return validationError(parsed.error, values);

  const { childId, academyId, memo, startDate, endDate, rules } = parsed.data;
  const supabase = await createClient();
  const { data: enrollmentId, error } = await supabase.rpc("create_enrollment", {
    p_child_id: childId,
    p_academy_id: academyId,
    // 과목명은 받지 않는다. 학원 이름이 곧 수업 이름이고, 빈 값은 DB 에서 null 로 저장된다.
    p_subject: "",
    // RPC 인자 타입은 string 이지만 SQL 은 null 을 받는다(비고 없음)
    p_memo: memo as string,
    p_start_date: startDate,
    // RPC 인자 타입은 string 이지만 SQL 은 null 을 받는다(종료일 없음)
    p_end_date: endDate as string,
    p_rules: rules.map((rule) => ({
      weekday: rule.weekday,
      start_time: rule.startTime,
      end_time: rule.endTime,
    })),
  });
  if (error) return dbFailure("create_enrollment", error, values);

  refreshEducationPages();
  // 등록 화면은 폼만 있으므로 교육 탭으로 돌아가 새 수강 과목을 보여준다.
  // id 를 넘겨 교육 탭이 같은 자녀의 다른 수업과 시간이 겹치는지 알려 준다.
  redirect(`${ROUTES.education}?added=1&id=${enrollmentId}`);
}

export async function changeScheduleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["enrollmentId", "fromDate"]);
  const parsed = parseScheduleChangeForm(formData);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_schedule_from", {
    p_enrollment_id: parsed.data.enrollmentId,
    p_from: parsed.data.fromDate,
    p_rules: parsed.data.rules.map((rule) => ({
      weekday: rule.weekday,
      start_time: rule.startTime,
      end_time: rule.endTime,
    })),
  });
  if (error) return dbFailure("change_schedule_from", error, values);

  refreshEducationPages();
  revalidatePath(ROUTES.scheduleChange(parsed.data.enrollmentId));
  // 같은 자녀의 다른 수업과 겹치면 막지 않고 알려만 준다
  const notice = enrollmentOverlapNotice(parsed.data.enrollmentId, await getEnrollments(), todayInSeoul());
  return success(`일정을 바꿨습니다. 캘린더에 새 일정이 반영되었습니다.${notice ? ` ${notice}` : ""}`);
}

export async function endEnrollmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = enrollmentEndSchema.safeParse(formValues(formData, ["id", "endDate"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_enrollment", {
    p_enrollment_id: parsed.data.id,
    p_end_date: parsed.data.endDate,
  });
  if (error) return dbFailure("end_enrollment", error);

  refreshEducationPages();
  return success("종료일을 저장했습니다. 이후 예정된 수업은 캘린더에서 빠졌습니다.");
}

export async function deleteEnrollmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = enrollmentDeleteSchema.safeParse(formValues(formData, ["id"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_enrollment", { p_enrollment_id: parsed.data.id });
  if (error) return dbFailure("delete_enrollment", error);

  refreshEducationPages();
  return success("삭제했습니다.");
}
