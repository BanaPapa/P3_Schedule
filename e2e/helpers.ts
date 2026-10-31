import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "family-hub-1234";

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

/** 이름이 정확히 같은 입력칸. 숨겨진 이전 화면(React Activity)의 칸은 무시된다. */
export function field(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

export async function newPage(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

export async function signUp(page: Page, email: string): Promise<void> {
  // 링크로 넘어온 경우 이전 화면(로그인) 폼에 입력하지 않도록 회원가입 화면을 기다린다
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
  await field(page, "이메일").fill(email);
  await field(page, "비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "가입하기" }).click();
}

/** 새 사용자로 가입하고 가족을 만든 뒤 홈 화면에서 멈춘다 */
export async function signUpWithFamily(page: Page, familyName: string, displayName: string): Promise<void> {
  await page.goto("/signup");
  await signUp(page, uniqueEmail("parent"));
  await field(page, "가족 이름").fill(familyName);
  await field(page, "나의 호칭").fill(displayName);
  await page.getByRole("button", { name: "가족 만들기" }).click();
  await expect(page.getByRole("heading", { name: familyName })).toBeVisible();
}

export async function addChild(page: Page, name: string): Promise<void> {
  await page.goto("/family");
  await field(page, "이름").fill(name);
  await page.getByRole("button", { name: "자녀 등록" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${name}을(를) 등록했습니다.` })).toBeVisible();
}

/** 서울 기준 오늘의 ISO 요일(1=월 … 7=일) */
export function todayIsoWeekdayInSeoul(): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(new Date());
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(short) + 1;
}

/** 아래 탭 바의 메뉴 */
export function tab(page: Page, name: "홈" | "캘린더" | "교육") {
  return page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name });
}
