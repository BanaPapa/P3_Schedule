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
  // 앱
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
]);

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
