import "server-only";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export interface StudySubject {
  id: string;
  name: string;
  textbook: string | null;
  goal: string | null;
  latestUnit: string | null;
  latestPercent: number | null;
  latestStudiedOn: string | null;
  totalMinutes: number;
  child: { id: string; name: string; color: string };
}

export interface StudyLog {
  id: string;
  studiedOn: string;
  minutes: number | null;
  unit: string | null;
  progressPercent: number | null;
  content: string | null;
  subject: { id: string; name: string; childName: string };
}

function loadFailed(what: string, code: string | undefined): never {
  logger.error(`failed to load ${what}`, { code });
  throw new Error("학습 기록을 불러오지 못했습니다.");
}

export async function getStudySubjects(): Promise<StudySubject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_subject_summaries")
    .select(
      "id, name, textbook, goal, latest_unit, latest_percent, latest_studied_on, total_minutes, child:children!inner (id, name, color)",
    )
    .order("name");
  if (error) loadFailed("study subjects", error.code);
  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    textbook: row.textbook,
    goal: row.goal,
    latestUnit: row.latest_unit,
    latestPercent: row.latest_percent,
    latestStudiedOn: row.latest_studied_on,
    totalMinutes: Number(row.total_minutes ?? 0),
    child: row.child as { id: string; name: string; color: string },
  }));
}

/** 최근 학습 기록 */
export async function getStudyLogs(limit: number): Promise<StudyLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_logs")
    .select(
      "id, studied_on, minutes, unit, progress_percent, content, subject:study_subjects!inner (id, name, child:children!inner (name))",
    )
    .order("studied_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) loadFailed("study logs", error.code);
  return data.map((row) => ({
    id: row.id,
    studiedOn: row.studied_on,
    minutes: row.minutes,
    unit: row.unit,
    progressPercent: row.progress_percent,
    content: row.content,
    subject: { id: row.subject.id, name: row.subject.name, childName: row.subject.child.name },
  }));
}
