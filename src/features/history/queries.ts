import "server-only";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { requireFamily } from "@/features/family/queries";
import { describeEntry, type AuditEntry, type HistoryContext } from "./describe";

export interface HistoryItem {
  id: number;
  actorName: string;
  /** 내가 한 변경인지 (배우자 변경을 강조할 때 쓴다) */
  mine: boolean;
  text: string;
  createdAt: string;
}

/** 이력 문장에서 숨기는 기록(자동 생성 등)이 많아 넉넉히 읽은 뒤 거른다 */
const FETCH_MULTIPLIER = 4;
/** 한 번의 작업(트랜잭션)에서 나온 기록으로 보는 시간 차 */
const SAME_MOMENT_MS = 1000;

function loadFailed(what: string, code: string | undefined): never {
  logger.error(`failed to load ${what}`, { code });
  throw new Error("변경 이력을 불러오지 못했습니다.");
}

type Json = Record<string, unknown> | null;

/** 최근 변경 이력. RLS 로 내 가족 기록만 읽는다. */
export async function getHistory(limit: number): Promise<HistoryItem[]> {
  const { user, members } = await requireFamily();
  const supabase = await createClient();
  const [logs, children, academies, enrollments, invoices] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id, table_name, action, actor_id, old_data, new_data, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit * FETCH_MULTIPLIER),
    supabase.from("children").select("id, name"),
    supabase.from("academies").select("id, name"),
    supabase.from("enrollments").select("id, child_id, academy:academies!inner (name)"),
    supabase.from("tuition_invoices").select("id, enrollment_id, billing_month"),
  ]);
  if (logs.error) loadFailed("audit logs", logs.error.code);
  if (children.error) loadFailed("children", children.error.code);
  if (academies.error) loadFailed("academies", academies.error.code);
  if (enrollments.error) loadFailed("enrollments", enrollments.error.code);
  if (invoices.error) loadFailed("invoices", invoices.error.code);

  const context: HistoryContext = {
    children: new Map(children.data.map((child) => [child.id, child.name])),
    academies: new Map(academies.data.map((academy) => [academy.id, academy.name])),
    enrollments: new Map(
      enrollments.data.map((row) => [row.id, { academyName: row.academy.name, childId: row.child_id }]),
    ),
    invoices: new Map(
      invoices.data.map((row) => [row.id, { enrollmentId: row.enrollment_id, billingMonth: row.billing_month }]),
    ),
  };
  const names = new Map(members.map((member) => [member.user_id, member.display_name]));

  const items: HistoryItem[] = [];
  for (const row of logs.data) {
    const entry: AuditEntry = {
      id: row.id,
      tableName: row.table_name,
      action: row.action as AuditEntry["action"],
      actorId: row.actor_id,
      oldData: row.old_data as Json,
      newData: row.new_data as Json,
      createdAt: row.created_at,
    };
    const text = describeEntry(entry, context);
    if (!text) continue;
    // 한 번의 작업으로 같은 문장이 여러 줄 생긴 경우만 합친다(같은 사람, 같은 순간).
    // 같은 금액 납부를 두 번 기록한 것처럼 시간이 다른 반복은 그대로 둔다.
    const previous = items.at(-1);
    if (
      previous &&
      previous.text === text &&
      previous.mine === (row.actor_id === user.id) &&
      Math.abs(Date.parse(previous.createdAt) - Date.parse(row.created_at)) < SAME_MOMENT_MS
    ) {
      continue;
    }
    items.push({
      id: row.id,
      actorName: (row.actor_id && names.get(row.actor_id)) || "알 수 없음",
      mine: row.actor_id === user.id,
      text,
      createdAt: row.created_at,
    });
    if (items.length >= limit) break;
  }
  return items;
}
