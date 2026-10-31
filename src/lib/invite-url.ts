import { ROUTES } from "./routes";

const INVITE_CODE_PATTERN = /^[0-9a-f]{32}$/;

/** DB가 만드는 초대 코드 형식(16바이트 hex)인지 확인한다. */
export function isInviteCode(value: string): boolean {
  return INVITE_CODE_PATTERN.test(value);
}

export function buildInviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}${ROUTES.invite(code)}`;
}

/** 초대 링크에 쓸 사이트 주소. 설정값이 있으면 그것을, 없으면 요청 헤더를 쓴다. */
export function requestOrigin(headers: Headers, siteUrl?: string): string {
  if (siteUrl) return siteUrl;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return "http://localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
