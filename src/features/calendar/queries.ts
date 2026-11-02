import "server-only";
import { addDays, todayInSeoul, type IsoDate } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type SessionStatus = Database["public"]["Enums"]["class_session_status"];

/** DB ensure_sessions_until 의 한도(c_max_days_ahead)와 같다 */
const MAX_GENERATE_DAYS_AHEAD = 400;

export interface CalendarSession {
  id: string;
  date: IsoDate;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  kind: Database["public"]["Enums"]["class_session_kind"];
  academyName: string;
  child: { id: string; name: string; color: string };
}

/**
 * 기간 안의 수업 회차. 미래 날짜는 규칙에서 회차를 먼저 만든다(이미 있으면 그대로).
 * childId 가 있으면 그 자녀 수업만.
 */
export async function getSessionsBetween(
  from: IsoDate,
  to: IsoDate,
  childId: string | null = null,
): Promise<CalendarSession[]> {
  const supabase = await createClient();
  const today = todayInSeoul();

  if (to >= today) {
    // 월간 칸은 다음 달 첫 주까지 보여 줘서 DB 한도를 넘을 수 있다. 한도 안으로 자른다.
    const until = to < addDays(today, MAX_GENERATE_DAYS_AHEAD) ? to : addDays(today, MAX_GENERATE_DAYS_AHEAD);
    const { error } = await supabase.rpc("ensure_sessions_until", { p_until: until });
    // 회차를 더 만들지 못해도 이미 있는 일정은 보여 준다
    if (error) logger.error("failed to ensure sessions", { code: error.code, message: error.message });
  }

  let query = supabase
    .from("class_sessions")
    .select(
      `id, session_date, start_time, end_time, status, kind,
       enrollment:enrollments!inner (
         child_id,
         child:children!inner (id, name, color),
         academy:academies!inner (name)
       )`,
    )
    .gte("session_date", from)
    .lte("session_date", to)
    .order("session_date")
    .order("start_time");
  if (childId) query = query.eq("enrollment.child_id", childId);

  const { data, error } = await query;
  if (error) {
    logger.error("failed to load sessions", { code: error.code });
    throw new Error("일정을 불러오지 못했습니다.");
  }

  return data.map((row) => ({
    id: row.id,
    date: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    kind: row.kind,
    academyName: row.enrollment.academy.name,
    child: row.enrollment.child,
  }));
}
