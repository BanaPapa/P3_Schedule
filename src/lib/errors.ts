export const ERROR_MESSAGES = {
  // DB RPC (supabase/migrations 의 raise exception 코드와 같은 이름)
  not_authenticated: "로그인이 필요합니다. 다시 로그인해 주세요.",
  not_in_family: "먼저 가족을 만들거나 초대를 수락해 주세요.",
  already_in_family: "이미 가족에 속해 있습니다.",
  invalid_family_name: "가족 이름은 1~50자로 입력해 주세요.",
  invalid_display_name: "호칭은 1~30자로 입력해 주세요.",
  family_full: "부모 두 명이 이미 모두 등록되어 있습니다.",
  invitation_not_found: "초대를 찾을 수 없습니다. 링크를 다시 확인해 주세요.",
  invitation_revoked: "취소된 초대입니다. 새 초대 링크를 요청해 주세요.",
  invitation_used: "이미 사용된 초대입니다.",
  invitation_expired: "만료된 초대입니다. 새 초대 링크를 요청해 주세요.",
  invalid_subject: "과목은 1~30자로 입력해 주세요.",
  invalid_period: "수강 기간을 확인해 주세요. 종료일은 시작일 이후여야 합니다.",
  invalid_schedule: "수업 요일과 시간을 확인해 주세요.",
  child_not_found: "자녀를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.",
  academy_not_found: "학원을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.",
  enrollment_not_found: "수강 과목을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.",
  enrollment_has_history: "지난 수업 기록이 있어 삭제할 수 없습니다. 대신 수강을 종료해 주세요.",
  range_too_far: "1년 넘게 먼 날짜의 일정은 볼 수 없습니다.",
  too_many_enrollments: "진행 중인 수강 과목은 30개까지 등록할 수 있습니다. 끝난 과목은 수강 종료해 주세요.",
  session_not_found: "수업을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.",
  invalid_status: "이 수업에는 그 상태를 쓸 수 없습니다.",
  replacement_exists: "이미 보강이나 변경된 수업이 잡혀 있습니다. 그 수업을 먼저 취소해 주세요.",
  makeup_not_allowed: "결석하거나 휴강한 수업에만 보강을 잡을 수 있습니다.",
  session_not_changeable: "예정된 수업만 날짜·시간을 바꿀 수 있습니다.",
  too_many_schedule_changes: "이 과목은 일정을 너무 많이 바꿨습니다. 수강을 종료하고 새로 등록해 주세요.",
  invalid_policy: "요금 정책을 확인해 주세요. 계산 방식에 맞는 금액이 필요합니다.",
  policy_required: "먼저 요금 정책을 설정해 주세요.",
  invoice_exists: "이 달은 이미 청구를 확정했습니다.",
  amount_required: "청구액을 입력해 주세요.",
  invalid_amount: "금액을 확인해 주세요.",
  invalid_item: "추가·할인 항목의 이름과 금액을 확인해 주세요.",
  invoice_not_found: "청구서를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.",
  invoice_has_payments: "납부 기록이 있는 청구는 취소할 수 없습니다. 납부 기록을 먼저 지워 주세요.",
  too_many_items: "추가·할인 항목은 청구서마다 20개까지 넣을 수 있습니다.",
  too_many_payments: "납부 기록은 청구서마다 50개까지 넣을 수 있습니다.",
  invalid_trip_day: "여행 기간 안의 날짜를 골라 주세요.",
  trip_items_outside: "바꾼 기간 밖에 일정이 남아 있습니다. 그 일정을 먼저 옮기거나 지워 주세요.",
  // 앱
  academy_in_use: "수강 과목이 등록된 학원은 삭제할 수 없습니다. 먼저 수강 과목을 정리해 주세요.",
  child_in_use: "수강 과목이 등록된 자녀는 삭제할 수 없습니다. 먼저 수강 과목을 정리해 주세요.",
  forbidden: "이 가족의 정보에 접근할 수 없습니다.",
  conflict: "다른 가족 구성원이 먼저 수정했습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.",
  invalid_input: "입력한 내용을 확인해 주세요.",
  // 인증
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  email_taken: "이미 가입된 이메일입니다. 로그인해 주세요.",
  weak_password: "비밀번호는 8자 이상으로 입력해 주세요.",
  rate_limited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  unknown: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

const RPC_ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  "not_authenticated",
  "not_in_family",
  "already_in_family",
  "invalid_family_name",
  "invalid_display_name",
  "family_full",
  "invitation_not_found",
  "invitation_revoked",
  "invitation_used",
  "invitation_expired",
  "invalid_subject",
  "invalid_period",
  "invalid_schedule",
  "child_not_found",
  "academy_not_found",
  "enrollment_not_found",
  "enrollment_has_history",
  "range_too_far",
  "too_many_enrollments",
  "session_not_found",
  "invalid_status",
  "replacement_exists",
  "makeup_not_allowed",
  "session_not_changeable",
  "too_many_schedule_changes",
  "invalid_policy",
  "policy_required",
  "invoice_exists",
  "amount_required",
  "invalid_amount",
  "invalid_item",
  "invoice_not_found",
  "invoice_has_payments",
  "too_many_items",
  "too_many_payments",
  "invalid_trip_day",
  "trip_items_outside",
]);

/** 회차를 읽은 뒤 다른 사람이 먼저 바꿨을 때 RPC 가 던지는 코드. 화면은 conflict() 로 처리한다. */
export const SESSION_CONFLICT = "session_conflict";

/** 참조 중인 행을 지우려 할 때(외래키 위반) */
export const FOREIGN_KEY_VIOLATION = "23503";

const AUTH_ERROR_CODES: Readonly<Record<string, ErrorCode>> = {
  invalid_credentials: "invalid_credentials",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
};

interface DbError {
  code?: string;
  message?: string;
}

/** PostgREST 오류를 사용자에게 보여줄 한국어 메시지로 바꾼다. */
export function dbErrorMessage(error: DbError | null | undefined): string {
  if (error?.code === "P0001" && error.message && RPC_ERROR_CODES.has(error.message)) {
    return ERROR_MESSAGES[error.message as ErrorCode];
  }
  if (error?.code === "42501") return ERROR_MESSAGES.forbidden;
  return ERROR_MESSAGES.unknown;
}

/** Supabase Auth 오류 코드를 한국어 메시지로 바꾼다. */
export function authErrorMessage(error: { code?: string } | null | undefined): string {
  const code = error?.code ? AUTH_ERROR_CODES[error.code] : undefined;
  return ERROR_MESSAGES[code ?? "unknown"];
}
