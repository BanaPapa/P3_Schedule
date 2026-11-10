export interface AutoLoginCredentials {
  email: string;
  password: string;
}

type Env = Record<string, string | undefined>;

/**
 * 로그인 화면 없이 쓰기 위한 고정 계정(서버 전용 환경 변수).
 * 둘 다 있어야 켜진다. FAMILY_HUB_DISABLE_AUTO_LOGIN=1 이면 끈다(E2E 는 매번 새 계정으로 가입한다).
 */
export function getAutoLoginCredentials(env: Env = process.env): AutoLoginCredentials | null {
  if (env.FAMILY_HUB_DISABLE_AUTO_LOGIN === "1") return null;
  const email = env.FAMILY_HUB_LOGIN_EMAIL?.trim();
  const password = env.FAMILY_HUB_LOGIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function isAutoLoginEnabled(env: Env = process.env): boolean {
  return getAutoLoginCredentials(env) !== null;
}
