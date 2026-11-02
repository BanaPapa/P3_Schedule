import { formatDayLabel, formatDotDate, formatTime } from "@/lib/dates";
import { formatWon } from "@/lib/money";
import { SESSION_STATUS_LABELS } from "@/features/education/format";
import { KIND_LABELS, type SchoolKind } from "@/features/school/format";
import { CATEGORY_LABELS, type TripCategory } from "@/features/travel/format";

type Data = Record<string, unknown>;

export interface AuditEntry {
  id: number;
  tableName: string;
  action: "insert" | "update" | "delete";
  actorId: string | null;
  oldData: Data | null;
  newData: Data | null;
  createdAt: string;
}

/** 이력 문장에 이름을 붙이는 데 쓰는 현재 데이터 */
export interface HistoryContext {
  children: Map<string, string>;
  academies: Map<string, string>;
  /** 수업은 학원 이름으로 부른다 */
  enrollments: Map<string, { academyName: string; childId: string }>;
  invoices: Map<string, { enrollmentId: string; billingMonth: string }>;
}

const MISSING_CLASS = "삭제된 과목";

function str(data: Data | null, key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
}

function num(data: Data | null, key: string): number {
  const value = data?.[key];
  return typeof value === "number" ? value : 0;
}

function changed(entry: AuditEntry, key: string): boolean {
  return JSON.stringify(entry.oldData?.[key] ?? null) !== JSON.stringify(entry.newData?.[key] ?? null);
}

function classLabel(enrollmentId: string | null, ctx: HistoryContext): string {
  const enrollment = enrollmentId ? ctx.enrollments.get(enrollmentId) : undefined;
  if (!enrollment) return MISSING_CLASS;
  const child = ctx.children.get(enrollment.childId);
  return child ? `${child} · ${enrollment.academyName}` : enrollment.academyName;
}

function monthNumber(isoDate: string | null): string {
  return isoDate ? `${Number(isoDate.slice(5, 7))}월` : "";
}

function invoiceLabel(invoiceId: string | null, ctx: HistoryContext): string {
  const invoice = invoiceId ? ctx.invoices.get(invoiceId) : undefined;
  if (!invoice) return "청구";
  return `${classLabel(invoice.enrollmentId, ctx)} ${monthNumber(invoice.billingMonth)}`;
}

function describeNamed(entry: AuditEntry, noun: string): string | null {
  const name = str(entry.newData, "name") ?? str(entry.oldData, "name") ?? "";
  if (entry.action === "insert") return `${noun} ${name}을(를) 등록했습니다`;
  if (entry.action === "delete") return `${noun} ${name}을(를) 삭제했습니다`;
  return `${noun} ${name} 정보를 수정했습니다`;
}

function describeSession(entry: AuditEntry, ctx: HistoryContext): string | null {
  const data = entry.newData ?? entry.oldData;
  const label = classLabel(str(data, "enrollment_id"), ctx);
  const date = str(data, "session_date");
  const time = formatTime(str(data, "start_time") ?? "");
  const day = date ? formatDayLabel(date) : "";

  if (entry.action === "insert") {
    const kind = str(data, "kind");
    if (kind === "makeup") return `${label} 보강을 ${day} ${time}에 잡았습니다`;
    if (kind === "rescheduled") return `${label} 수업을 ${day} ${time}(으)로 옮겼습니다`;
    return null; // 규칙에서 자동으로 만든 회차
  }
  if (entry.action === "delete") return null; // 일정 변경·종료로 정리된 회차

  const original = entry.oldData ? formatDayLabel(str(entry.oldData, "session_date") ?? date ?? "") : day;
  if (changed(entry, "status")) {
    const status = str(entry.newData, "status") as keyof typeof SESSION_STATUS_LABELS;
    return `${label} ${original} 수업을 '${SESSION_STATUS_LABELS[status] ?? status}'(으)로 바꿨습니다`;
  }
  if (changed(entry, "session_date")) return `${label} ${original} 수업을 ${day} ${time}(으)로 바꿨습니다`;
  if (changed(entry, "start_time") || changed(entry, "end_time")) {
    return `${label} ${original} 수업 시간을 ${time}(으)로 바꿨습니다`;
  }
  if (changed(entry, "note")) return `${label} ${original} 수업에 메모를 남겼습니다`;
  if (changed(entry, "makeup_waived")) {
    return entry.newData?.makeup_waived
      ? `${label} ${original} 수업을 보강 안 함으로 표시했습니다`
      : `${label} ${original} 수업을 다시 보강 대기에 올렸습니다`;
  }
  return null;
}

function describeEnrollment(entry: AuditEntry, ctx: HistoryContext): string | null {
  const data = entry.newData ?? entry.oldData;
  const childId = str(data, "child_id");
  const child = childId ? ctx.children.get(childId) : undefined;
  const academyId = str(data, "academy_id");
  // 학원이 지워졌으면 예전 기록의 과목명을 대신 쓴다
  const name = (academyId ? ctx.academies.get(academyId) : undefined) ?? str(data, "subject") ?? "학원";
  const label = `${child ? `${child} · ` : ""}${name}`;
  if (entry.action === "insert") return `${label} 수강을 등록했습니다`;
  if (entry.action === "delete") return `${label} 수강을 삭제했습니다`;
  if (changed(entry, "end_date")) {
    const end = str(entry.newData, "end_date");
    return end ? `${label} 수강 종료일을 ${formatDotDate(end)}(으)로 정했습니다` : `${label} 수강 종료일을 지웠습니다`;
  }
  if (changed(entry, "memo")) return `${label} 비고를 수정했습니다`;
  return null;
}

function describeInvoice(entry: AuditEntry, ctx: HistoryContext): string | null {
  const data = entry.newData ?? entry.oldData;
  const label = `${classLabel(str(data, "enrollment_id"), ctx)} ${monthNumber(str(data, "billing_month"))}`;
  if (entry.action === "insert") return `${label} 청구를 확정했습니다 (${formatWon(num(data, "base_amount"))})`;
  if (entry.action === "delete") return `${label} 청구 확정을 취소했습니다`;
  // 항목·납부가 바뀔 때 version 만 오른 경우는 숨긴다
  if (changed(entry, "base_amount")) {
    return `${label} 확정액을 ${formatWon(num(entry.newData, "base_amount"))}(으)로 조정했습니다`;
  }
  return null;
}

const TRIP_FIELDS = ["title", "destination", "start_date", "end_date", "budget_amount", "memo"] as const;

function describeTravel(entry: AuditEntry): string | null {
  const data = entry.newData ?? entry.oldData;
  const title = str(data, "title") ?? "";
  switch (entry.tableName) {
    case "trips":
      if (entry.action === "insert") return `여행 '${title}'을(를) 만들었습니다`;
      if (entry.action === "delete") return `여행 '${title}'을(를) 지웠습니다`;
      return TRIP_FIELDS.some((field) => changed(entry, field)) ? `여행 '${title}' 정보를 수정했습니다` : null;
    case "trip_items":
      if (entry.action === "insert") return `여행 일정 '${title}'을(를) 넣었습니다`;
      if (entry.action === "delete") return `여행 일정 '${title}'을(를) 지웠습니다`;
      return `여행 일정 '${title}'을(를) 고쳤습니다`;
    case "trip_budgets": {
      if (entry.action === "delete") return null;
      const category = CATEGORY_LABELS[str(data, "category") as TripCategory] ?? "";
      return `여행 예산(${category})을 ${formatWon(num(data, "planned_amount"))}으로 정했습니다`;
    }
    case "trip_expenses": {
      const what = str(data, "description") ?? CATEGORY_LABELS[str(data, "category") as TripCategory] ?? "";
      const amount = formatWon(num(data, "amount"));
      return entry.action === "delete" ? `여행 지출 ${amount}(${what}) 기록을 지웠습니다` : `여행 지출 ${amount}(${what})을 기록했습니다`;
    }
    default:
      return null;
  }
}

function describeSchool(entry: AuditEntry, ctx: HistoryContext): string | null {
  const data = entry.newData ?? entry.oldData;
  const childId = str(data, "child_id");
  const child = childId ? `${ctx.children.get(childId) ?? ""} ` : "";
  switch (entry.tableName) {
    case "school_events": {
      const title = str(data, "title") ?? "";
      const kind = KIND_LABELS[str(data, "kind") as SchoolKind] ?? "";
      if (entry.action === "insert") return `${child}${kind} '${title}'을(를) 등록했습니다`;
      if (entry.action === "delete") return `${child}${kind} '${title}'을(를) 지웠습니다`;
      if (changed(entry, "score")) return `${child}'${title}' 점수를 기록했습니다`;
      if (changed(entry, "done")) {
        return entry.newData?.done ? `${child}과제 '${title}'을(를) 끝냈습니다` : `${child}과제 '${title}'을(를) 다시 할 일로 돌렸습니다`;
      }
      return ["title", "event_date", "end_date", "memo", "subject", "kind"].some((field) => changed(entry, field))
        ? `${child}${kind} '${title}'을(를) 고쳤습니다`
        : null;
    }
    case "school_event_items": {
      // 준비물 추가는 일정 등록에 딸려 오므로 챙김 표시만 보여 준다
      if (entry.action !== "update" || !changed(entry, "checked")) return null;
      const label = str(data, "label") ?? "";
      return entry.newData?.checked ? `준비물 '${label}'을(를) 챙겼습니다` : `준비물 '${label}' 챙김을 취소했습니다`;
    }
    case "study_subjects":
      if (entry.action === "insert") return `${child}학습 과목 '${str(data, "name") ?? ""}'을(를) 추가했습니다`;
      if (entry.action === "delete") return `${child}학습 과목 '${str(data, "name") ?? ""}'을(를) 지웠습니다`;
      return null;
    case "study_logs": {
      if (entry.action === "delete") return "학습 기록을 지웠습니다";
      const details = [str(data, "unit"), num(data, "minutes") ? `${num(data, "minutes")}분` : null].filter(Boolean);
      return `학습 기록을 남겼습니다${details.length > 0 ? ` (${details.join(", ")})` : ""}`;
    }
    default:
      return null;
  }
}

/** 이력 한 줄을 사람이 읽는 문장으로. 보여 줄 필요가 없는 기록이면 null. */
export function describeEntry(entry: AuditEntry, ctx: HistoryContext): string | null {
  const data = entry.newData ?? entry.oldData;
  switch (entry.tableName) {
    case "families":
      if (entry.action === "insert") return "가족을 만들었습니다";
      return changed(entry, "name") ? `가족 이름을 '${str(entry.newData, "name")}'(으)로 바꿨습니다` : null;
    case "family_members": {
      const name = str(data, "display_name") ?? "";
      if (entry.action === "insert") return `${name}님이 가족에 합류했습니다`;
      if (entry.action === "delete") return `${name}님이 가족을 떠났습니다`;
      return changed(entry, "display_name") ? `호칭을 '${name}'(으)로 바꿨습니다` : null;
    }
    case "children":
      return describeNamed(entry, "자녀");
    case "academies":
      return describeNamed(entry, "학원");
    case "enrollments":
      return describeEnrollment(entry, ctx);
    case "class_rules":
      // 규칙 생성·삭제는 수강 등록·일정 변경에 딸려 온다. 기존 규칙이 끝나는 것만 일정 변경으로 보여 준다.
      return entry.action === "update" && changed(entry, "effective_until")
        ? `${classLabel(str(data, "enrollment_id"), ctx)} 정규 일정을 바꿨습니다`
        : null;
    case "class_sessions":
      return describeSession(entry, ctx);
    case "tuition_policies":
      return entry.action === "delete" ? null : `${classLabel(str(data, "enrollment_id"), ctx)} 요금 정책을 바꿨습니다`;
    case "tuition_invoices":
      return describeInvoice(entry, ctx);
    case "tuition_invoice_items": {
      const label = invoiceLabel(str(data, "invoice_id"), ctx);
      const item = `${str(data, "kind") === "discount" ? "할인" : "추가"} '${str(data, "label") ?? ""}'`;
      return entry.action === "delete"
        ? `${label} 청구에서 ${item}을(를) 뺐습니다`
        : `${label} 청구에 ${item} ${formatWon(num(data, "amount"))}을 넣었습니다`;
    }
    case "tuition_payments": {
      const label = invoiceLabel(str(data, "invoice_id"), ctx);
      return entry.action === "delete"
        ? `${label} 납부 기록(${formatWon(num(data, "amount"))})을 지웠습니다`
        : `${label} 학원비 ${formatWon(num(data, "amount"))} 납부를 기록했습니다`;
    }
    default:
      if (entry.tableName.startsWith("trip")) return describeTravel(entry);
      return describeSchool(entry, ctx);
  }
}
