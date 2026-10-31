export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  onboarding: "/onboarding",
  family: "/family",
  calendar: "/calendar",
  education: "/education",
  session: (id: string) => `/sessions/${id}`,
  scheduleChange: (enrollmentId: string) => `/education/enrollments/${enrollmentId}/schedule`,
  invite: (code: string) => `/invite/${code}`,
} as const;

const AUTH_PATHS: readonly string[] = [ROUTES.login, ROUTES.signup];

export type RouteAccess = { type: "next" } | { type: "redirect"; to: string };

const PLACEHOLDER_ORIGIN = "http://next-path.invalid";
// 제어문자(탭·줄바꿈 포함)와 역슬래시. URL 파서가 지우거나 "/" 로 바꿔 다른 사이트 주소가 될 수 있다.
const UNSAFE_PATH_CHARS = /[\u0000-\u001f\u007f\\]/;

/**
 * 로그인 후 돌아갈 경로. 외부 URL로 튕겨 나가지 않도록 같은 사이트의 상대 경로만 허용한다.
 * 접두어 검사만으로는 "/\t/evil.com" 같은 값을 막지 못하므로 실제로 파싱해 출처를 비교한다.
 */
export function safeNextPath(value: string | null | undefined, fallback: string = ROUTES.home): string {
  if (!value || !value.startsWith("/") || UNSAFE_PATH_CHARS.test(value)) return fallback;

  const url = new URL(value, PLACEHOLDER_ORIGIN);
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveRouteAccess(
  pathname: string,
  search: string,
  isAuthenticated: boolean,
): RouteAccess {
  const isAuthPath = AUTH_PATHS.includes(pathname);

  if (isAuthPath) {
    if (!isAuthenticated) return { type: "next" };
    const next = new URLSearchParams(search).get("next");
    return { type: "redirect", to: safeNextPath(next) };
  }

  if (!isAuthenticated) {
    if (pathname === ROUTES.home) return { type: "redirect", to: ROUTES.login };
    const next = encodeURIComponent(`${pathname}${search}`);
    return { type: "redirect", to: `${ROUTES.login}?next=${next}` };
  }

  return { type: "next" };
}
