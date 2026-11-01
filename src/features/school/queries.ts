import "server-only";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { SchoolKind } from "./format";

export interface SchoolEvent {
  id: string;
  version: number;
  kind: SchoolKind;
  eventDate: string;
  endDate: string | null;
  title: string;
  subject: string | null;
  memo: string | null;
  done: boolean;
  score: number | null;
  maxScore: number | null;
  itemCount: number;
  uncheckedCount: number;
  child: { id: string; name: string; color: string };
}

export interface SupplyItem {
  id: string;
  label: string;
  checked: boolean;
}

function loadFailed(what: string, code: string | undefined): never {
  logger.error(`failed to load ${what}`, { code });
  throw new Error("학교 일정을 불러오지 못했습니다.");
}

const COLUMNS = `id, version, kind, event_date, end_date, title, subject, memo, done, score, max_score,
  item_count, unchecked_count, child:children!inner (id, name, color)`;

interface EventRow {
  id: string | null;
  version: number | null;
  kind: SchoolKind | null;
  event_date: string | null;
  end_date: string | null;
  title: string | null;
  subject: string | null;
  memo: string | null;
  done: boolean | null;
  score: number | null;
  max_score: number | null;
  item_count: number | null;
  unchecked_count: number | null;
  child: { id: string; name: string; color: string };
}

function toEvent(row: EventRow): SchoolEvent {
  return {
    id: row.id as string,
    version: row.version as number,
    kind: row.kind as SchoolKind,
    eventDate: row.event_date as string,
    endDate: row.end_date,
    title: row.title as string,
    subject: row.subject,
    memo: row.memo,
    done: Boolean(row.done),
    score: row.score === null ? null : Number(row.score),
    maxScore: row.max_score === null ? null : Number(row.max_score),
    itemCount: Number(row.item_count ?? 0),
    uncheckedCount: Number(row.unchecked_count ?? 0),
    child: row.child,
  };
}

/** 기간과 겹치는 학교 일정 (여러 날 일정 포함) */
export async function getSchoolEventsBetween(from: string, to: string): Promise<SchoolEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_event_summaries")
    .select(COLUMNS)
    .lte("event_date", to)
    .or(`end_date.gte.${from},and(end_date.is.null,event_date.gte.${from})`)
    .order("event_date");
  if (error) loadFailed("school events", error.code);
  return (data as unknown as EventRow[]).map(toEvent);
}

export async function getSchoolEvent(id: string): Promise<{ event: SchoolEvent; items: SupplyItem[] } | null> {
  const supabase = await createClient();
  const [event, items] = await Promise.all([
    supabase.from("school_event_summaries").select(COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("school_event_items").select("id, label, checked").eq("event_id", id).order("created_at"),
  ]);
  if (event.error) loadFailed("school event", event.error.code);
  if (!event.data) return null;
  if (items.error) loadFailed("school event items", items.error.code);
  return { event: toEvent(event.data as unknown as EventRow), items: items.data };
}
