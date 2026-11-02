import "server-only";
import { cache } from "react";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

export type Academy = Pick<
  Tables["academies"]["Row"],
  "id" | "name" | "phone" | "contact_name" | "memo" | "version"
>;

export type ClassRule = Pick<
  Tables["class_rules"]["Row"],
  "id" | "weekday" | "start_time" | "end_time" | "effective_from" | "effective_until"
>;

export interface Enrollment {
  id: string;
  /** 비고. 과목명은 따로 두지 않고 학원 이름으로 부른다. */
  memo: string | null;
  startDate: string;
  endDate: string | null;
  version: number;
  child: { id: string; name: string; color: string };
  academy: { id: string; name: string };
  rules: ClassRule[];
}

function loadFailed(what: string, code: string | undefined): never {
  logger.error(`failed to load ${what}`, { code });
  throw new Error("교육 정보를 불러오지 못했습니다.");
}

/** RLS 로 내 가족 학원만 돌아온다 */
export const getAcademies = cache(async (): Promise<Academy[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academies")
    .select("id, name, phone, contact_name, memo, version")
    .order("name");
  if (error) loadFailed("academies", error.code);
  return data;
});

export const getEnrollments = cache(async (): Promise<Enrollment[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `id, memo, start_date, end_date, version,
       child:children!inner (id, name, color),
       academy:academies!inner (id, name),
       rules:class_rules (id, weekday, start_time, end_time, effective_from, effective_until)`,
    )
    .order("start_date", { ascending: false });
  if (error) loadFailed("enrollments", error.code);

  return data.map((row) => ({
    id: row.id,
    memo: row.memo,
    startDate: row.start_date,
    endDate: row.end_date,
    version: row.version,
    child: row.child,
    academy: row.academy,
    rules: [...row.rules].sort(
      (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
    ),
  }));
});
