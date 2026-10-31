import { formatDotDate } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

type FamilyRole = Database["public"]["Enums"]["family_role"];

const ROLE_LABELS: Record<FamilyRole, string> = {
  owner: "가족 대표",
  parent: "부모",
};

export function roleLabel(role: FamilyRole): string {
  return ROLE_LABELS[role];
}

/** 2018-03-02 → 2018. 3. 2. */
export function formatBirthDate(isoDate: string | null): string | null {
  return isoDate ? formatDotDate(isoDate) : null;
}

/**
 * 초대 만료 시각을 "11월 7일 오후 3:00까지" 형태로.
 * Node 의 ICU 버전에 따라 ko-KR 오전/오후 표기가 "PM" 으로 나오기도 해서 숫자만 받아 직접 조합한다.
 */
export function formatExpiry(isoDateTime: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoDateTime));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);

  const hour = part("hour");
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minute = String(part("minute")).padStart(2, "0");
  return `${part("month")}월 ${part("day")}일 ${period} ${hour12}:${minute}까지`;
}
