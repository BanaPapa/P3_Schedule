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
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
