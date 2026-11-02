export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  onboarding: "/onboarding",
  family: "/family",
  calendar: "/calendar",
  education: "/education",
  manage: "/manage",
  academy: (id: string) => `/manage/academies/${id}`,
  session: (id: string) => `/sessions/${id}`,
  scheduleChange: (enrollmentId: string) => `/education/enrollments/${enrollmentId}/schedule`,
  tuition: "/tuition",
  history: "/history",
  travel: "/travel",
  trip: (id: string) => `/travel/${id}`,
  costs: "/costs",
  school: "/school",
  schoolEvent: (id: string) => `/school/${id}`,
  study: "/study",
  assistant: "/assistant",
  tuitionDetail: (enrollmentId: string, month: string) => `/tuition/${enrollmentId}?month=${month.slice(0, 7)}`,
  tuitionPolicy: (enrollmentId: string) => `/tuition/${enrollmentId}/policy`,
  invite: (code: string) => `/invite/${code}`,
  authConfirm: "/auth/confirm",
} as const;

const AUTH_PATHS: readonly string[] = [ROUTES.login, ROUTES.signup];
/** 로그인 여부와 상관없이 열리는 경로 (가입 확인 메일 링크) */
const OPEN_PATHS: readonly string[] = [ROUTES.authConfirm];

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
  if (OPEN_PATHS.includes(pathname)) return { type: "next" };
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
