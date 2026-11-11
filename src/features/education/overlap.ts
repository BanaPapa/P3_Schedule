import { WEEKDAY_LABELS } from "@/lib/dates";

/** 매주 반복되는 수업 시간 한 칸 (class_rules 한 행) */
export interface WeeklySlot {
  weekday: number;
  startTime: string;
  endTime: string;
}

/** 다른 수강 과목의 수업 시간. name 은 학원 이름 */
export interface NamedSlot extends WeeklySlot {
  name: string;
}

const minutes = (time: string) => {
  const [hours = "0", mins = "0"] = time.split(":");
  return Number(hours) * 60 + Number(mins);
};

const hhmm = (time: string) => time.slice(0, 5);

/** 새 수업 시간과 같은 요일에 시간이 겹치는 기존 수업(중복 없이, 요일·시작 순) */
export function overlappingSlots(newSlots: readonly WeeklySlot[], existing: readonly NamedSlot[]): NamedSlot[] {
  const hits = existing.filter((slot) =>
    newSlots.some(
      (next) =>
        next.weekday === slot.weekday &&
        minutes(next.startTime) < minutes(slot.endTime) &&
        minutes(slot.startTime) < minutes(next.endTime),
    ),
  );
  const unique = [...new Map(hits.map((slot) => [`${slot.name}|${slot.weekday}|${hhmm(slot.startTime)}`, slot])).values()];
  return unique.sort((a, b) => a.weekday - b.weekday || minutes(a.startTime) - minutes(b.startTime));
}

interface RuleRow {
  weekday: number;
  start_time: string;
  end_time: string;
  effective_until: string | null;
}

interface EnrollmentLike {
  id: string;
  endDate: string | null;
  child: { id: string; name: string };
  academy: { name: string };
  rules: readonly RuleRow[];
}

/** 오늘 이후에도 쓰이는 규칙만 (지난 규칙은 이미 끝난 시간표) */
const currentRules = (rules: readonly RuleRow[], today: string) =>
  rules.filter((rule) => rule.effective_until === null || rule.effective_until >= today);

/**
 * 수강 과목 하나의 현재 수업 시간이 같은 자녀의 다른 진행 중 수강 과목과 겹치면 안내 문장.
 * 등록·일정 변경 직후에 보여 준다(막지는 않는다).
 */
export function enrollmentOverlapNotice(
  targetId: string,
  enrollments: readonly EnrollmentLike[],
  today: string,
): string | null {
  const target = enrollments.find((enrollment) => enrollment.id === targetId);
  if (!target) return null;
  const toSlot = (rule: RuleRow): WeeklySlot => ({
    weekday: rule.weekday,
    startTime: rule.start_time,
    endTime: rule.end_time,
  });
  const others = enrollments
    .filter((enrollment) => enrollment.id !== target.id && enrollment.child.id === target.child.id)
    .filter((enrollment) => enrollment.endDate === null || enrollment.endDate >= today)
    .flatMap((enrollment) =>
      currentRules(enrollment.rules, today).map((rule) => ({ ...toSlot(rule), name: enrollment.academy.name })),
    );
  const conflicts = overlappingSlots(currentRules(target.rules, today).map(toSlot), others);
  return overlapNotice(target.child.name, conflicts);
}

/** "수호는 월 14:00–14:50 피아노 수업과 시간이 겹칩니다." 겹침이 없으면 null */
export function overlapNotice(childName: string, conflicts: readonly NamedSlot[]): string | null {
  if (conflicts.length === 0) return null;
  const list = conflicts
    .map((slot) => `${WEEKDAY_LABELS[slot.weekday]} ${hhmm(slot.startTime)}–${hhmm(slot.endTime)} ${slot.name}`)
    .join(", ");
  return `${childName}는 ${list} 수업과 시간이 겹칩니다. 시간이 맞는지 확인해 주세요.`;
}
