import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/** 로컬 Supabase(`supabase start`)가 떠 있어야 한다. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    // AI 는 API 를 부르지 않는 가짜 구현으로 시험한다 (운영에는 절대 설정하지 않는다)
    env: { FAMILY_HUB_FAKE_AI: "1" },
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
