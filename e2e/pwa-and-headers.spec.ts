import { expect, test } from "@playwright/test";
import { newPage, signUpWithFamily } from "./helpers";

test("the app can be installed: manifest and icons are public", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body).toMatchObject({ name: "Family Hub", display: "standalone", start_url: "/" });

  for (const src of ["/icon/small", "/icon/large", "/apple-icon"]) {
    const icon = await request.get(src);
    expect(icon.ok(), src).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");
  }
});

test("pages are sent with security headers", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("unknown pages show a friendly not-found screen", async ({ browser }) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "안씨네", "아빠");
  // 스트리밍 중에 notFound() 가 나면 상태 코드는 200 일 수 있어 화면 문구로 확인한다
  await page.goto("/sessions/not-a-real-id");
  await expect(page.getByText("찾는 화면이 없습니다")).toBeVisible();
});
