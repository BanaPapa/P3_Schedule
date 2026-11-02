import "server-only";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type SessionStatus = Enums["class_session_status"];
export type SessionKind = Enums["class_session_kind"];

export interface SessionSummary {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  kind: SessionKind;
}

export interface SessionDetail extends SessionSummary {
  version: number;
  enrollmentId: string;
  note: string | null;
  makeupWaived: boolean;
  academyName: string;
  child: { id: string; name: string; color: string };
  /** 이 회차가 보강·변경 회차면 원 회차 */
  origin: SessionSummary | null;
  /** 이 회차를 대신하는 보강·변경 회차 (취소된 것 포함) */
  replacements: SessionSummary[];
}

export interface WaitingSession {
  id: string;
  date: string;
  startTime: string;
  status: SessionStatus;
  academyName: string;
  child: { id: string; name: string; color: string };
}

const SUMMARY_COLUMNS = "id, session_date, start_time, end_time, status, kind";

interface SummaryRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: SessionStatus;
  kind: SessionKind;
}

function toSummary(row: SummaryRow): SessionSummary {
  return {
    id: row.id,
    date: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    kind: row.kind,
  };
}

function loadFailed(what: string, code: string | undefined): never {
  logger.error(`failed to load ${what}`, { code });
  throw new Error("수업 정보를 불러오지 못했습니다.");
}

/** 회차 하나와 연결된 보강·변경 회차. 우리 가족 회차가 아니면 null (RLS). */
export async function getSessionDetail(id: string): Promise<SessionDetail | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("class_sessions")
    .select(
      `${SUMMARY_COLUMNS}, version, note, makeup_waived, origin_session_id, enrollment_id,
       enrollment:enrollments!inner (
         child:children!inner (id, name, color),
         academy:academies!inner (name)
       )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) loadFailed("session", error.code);
  if (!row) return null;

  const [origin, replacements] = await Promise.all([
    row.origin_session_id
      ? supabase.from("class_sessions").select(SUMMARY_COLUMNS).eq("id", row.origin_session_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("class_sessions").select(SUMMARY_COLUMNS).eq("origin_session_id", id).order("created_at"),
  ]);
  if (origin.error) loadFailed("origin session", origin.error.code);
  if (replacements.error) loadFailed("replacement sessions", replacements.error.code);

  return {
    ...toSummary(row),
    version: row.version,
    enrollmentId: row.enrollment_id,
    note: row.note,
    makeupWaived: row.makeup_waived,
    academyName: row.enrollment.academy.name,
    child: row.enrollment.child,
    origin: origin.data ? toSummary(origin.data) : null,
    replacements: replacements.data.map(toSummary),
  };
}

/** 결석·휴강했는데 보강이 아직 없는 회차 (오래된 것부터) */
export async function getMakeupWaitlist(): Promise<WaitingSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("makeup_waitlist")
    .select(
      `id, session_date, start_time, status,
       enrollment:enrollments!inner (
         child:children!inner (id, name, color),
         academy:academies!inner (name)
       )`,
    )
    .order("session_date")
    .order("start_time");
  if (error) loadFailed("makeup wait list", error.code);

  return data.map((row) => ({
    id: row.id as string,
    date: row.session_date as string,
    startTime: row.start_time as string,
    status: row.status as SessionStatus,
    academyName: row.enrollment.academy.name,
    child: row.enrollment.child,
  }));
}
