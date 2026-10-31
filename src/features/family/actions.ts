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
import {
  acceptInvitationSchema,
  childCreateSchema,
  childDeleteSchema,
  childUpdateSchema,
  createFamilySchema,
} from "./schemas";
import { requireFamily } from "./queries";

const CHILD_FIELDS = ["name", "birthDate", "color"] as const;

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function dbFailure(
  action: string,
  error: PostgrestLikeError,
  values?: Record<string, string>,
): FormState {
  // RPC 가 의도적으로 던진 오류(P0001)는 사용자 메시지로 충분하다. 나머지는 원인 추적용으로 남긴다.
  if (error.code !== "P0001") logger.error(`${action} failed`, { code: error.code });
  return failure(dbErrorMessage(error), values);
}

function refreshFamilyPages(): void {
  revalidatePath(ROUTES.home);
  revalidatePath(ROUTES.family);
}

export async function createFamilyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["familyName", "displayName"]);
  const parsed = createFamilySchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_family", {
    p_name: parsed.data.familyName,
    p_display_name: parsed.data.displayName,
  });
  if (error) return dbFailure("create_family", error, values);

  redirect(ROUTES.home);
}

export async function acceptInvitationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["code", "displayName"]);
  const parsed = acceptInvitationSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", {
    p_code: parsed.data.code,
    p_display_name: parsed.data.displayName,
  });
  if (error) return dbFailure("accept_invitation", error, values);

  redirect(ROUTES.home);
}

export async function createInvitationAction(): Promise<FormState> {
  await requireFamily();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_invitation");
  if (error) return dbFailure("create_invitation", error);

  revalidatePath(ROUTES.family);
  return success("새 초대 링크를 만들었습니다.");
}

export async function revokeInvitationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = formData.get("id");
  if (typeof id !== "string") return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: id });
  if (error) return dbFailure("revoke_invitation", error);

  revalidatePath(ROUTES.family);
  return success("초대 링크를 취소했습니다.");
}

export async function addChildAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, CHILD_FIELDS);
  const parsed = childCreateSchema().safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { family, children } = await requireFamily();
  const supabase = await createClient();
  const { error } = await supabase.from("children").insert({
    family_id: family.id,
    name: parsed.data.name,
    birth_date: parsed.data.birthDate,
    color: parsed.data.color,
    sort_order: children.length,
  });
  if (error) return dbFailure("add_child", error, values);

  refreshFamilyPages();
  return success(`${parsed.data.name}을(를) 등록했습니다.`);
}

export async function updateChildAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["id", "version", ...CHILD_FIELDS]);
  const parsed = childUpdateSchema().safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .update({
      name: parsed.data.name,
      birth_date: parsed.data.birthDate,
      color: parsed.data.color,
    })
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id");
  if (error) return dbFailure("update_child", error, values);

  // 0행이면 그사이 배우자가 수정했거나 삭제한 것이다. 덮어쓰지 않고 최신 내용을 다시 보여준다.
  refreshFamilyPages();
  if (data.length === 0) return conflict();
  return success("저장했습니다.");
}

export async function deleteChildAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = childDeleteSchema.safeParse(formValues(formData, ["id", "version"]));
  if (!parsed.success) return failure(ERROR_MESSAGES.invalid_input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .delete()
    .eq("id", parsed.data.id)
    .eq("version", parsed.data.version)
    .select("id");
  if (error) return dbFailure("delete_child", error);

  refreshFamilyPages();
  if (data.length === 0) return conflict();
  return success("삭제했습니다.");
}
