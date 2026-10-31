import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { buildInviteUrl, requestOrigin } from "@/lib/invite-url";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

export interface CurrentUser {
  id: string;
  email: string | null;
}

export type Family = Pick<Tables["families"]["Row"], "id" | "name" | "version">;
export type FamilyMember = Pick<
  Tables["family_members"]["Row"],
  "id" | "user_id" | "role" | "display_name" | "created_at"
>;
export type Child = Pick<
  Tables["children"]["Row"],
  "id" | "name" | "birth_date" | "color" | "sort_order" | "version"
>;

export interface FamilyContext {
  user: CurrentUser;
  family: Family;
  me: FamilyMember;
  members: FamilyMember[];
  children: Child[];
}

export interface ActiveInvitation {
  id: string;
  code: string;
  expiresAt: string;
}

export interface InvitationPreview {
  familyName: string;
  inviterName: string | null;
  status: "valid" | "expired" | "used" | "revoked";
}

/** 로그인한 사용자. proxy 가 막지만 직접 호출돼도 안전하도록 여기서도 확인한다. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) redirect(ROUTES.login);
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: sub, email };
});

/** 내 가족 정보. 아직 가족이 없으면 null. RLS 덕분에 내 가족 행만 돌아온다. */
export const getFamilyContext = cache(async (): Promise<FamilyContext | null> => {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [families, members, children] = await Promise.all([
    supabase.from("families").select("id, name, version").maybeSingle(),
    supabase
      .from("family_members")
      .select("id, user_id, role, display_name, created_at")
      .order("created_at"),
    supabase
      .from("children")
      .select("id, name, birth_date, color, sort_order, version")
      .order("sort_order")
      .order("created_at"),
  ]);

  if (families.error || members.error || children.error) {
    const error = families.error ?? members.error ?? children.error;
    // details 에는 행 데이터가 섞일 수 있어 남기지 않는다
    logger.error("failed to load family context", {
      userId: user.id,
      code: error?.code,
      message: error?.message,
    });
    throw new Error("가족 정보를 불러오지 못했습니다.");
  }
  if (!families.data) return null;

  const me = members.data.find((member) => member.user_id === user.id);
  if (!me) return null;

  return {
    user,
    family: families.data,
    me,
    members: members.data,
    children: children.data,
  };
});

/** 가족이 있어야 하는 화면에서 쓴다. 없으면 가족 만들기로 보낸다. */
export async function requireFamily(): Promise<FamilyContext> {
  const context = await getFamilyContext();
  if (!context) redirect(ROUTES.onboarding);
  return context;
}

export async function getActiveInvitation(familyId: string): Promise<ActiveInvitation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_invitations")
    .select("id, code, expires_at")
    .eq("family_id", familyId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("failed to load invitation", { familyId, code: error.code });
    throw new Error("초대 정보를 불러오지 못했습니다.");
  }
  return data ? { id: data.id, code: data.code, expiresAt: data.expires_at } : null;
}

/** 초대 링크 전체 주소 */
export async function getInviteUrl(code: string): Promise<string> {
  const origin = requestOrigin(await headers(), process.env.NEXT_PUBLIC_SITE_URL);
  return buildInviteUrl(origin, code);
}

export async function getInvitationPreview(code: string): Promise<InvitationPreview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitation", { p_code: code }).maybeSingle();
  if (error) {
    logger.error("failed to load invitation preview", { code: error.code });
    throw new Error("초대 정보를 불러오지 못했습니다.");
  }
  if (!data) return null;
  return {
    familyName: data.family_name,
    inviterName: data.inviter_name,
    status: data.status as InvitationPreview["status"],
  };
}
