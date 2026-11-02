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
export function tab(page: Page, name: keyof typeof TAB_PATHS) {
  return page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name, exact: true });
}

/** 서울 기준 오늘에서 days 만큼 떨어진 날짜 "YYYY-MM-DD" */
export function seoulDate(days = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 서울 기준 날짜의 ISO 요일(1=월 … 7=일) */
export function isoWeekdayOf(isoDate: string): number {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** 제목이 정확히 같은 카드(section) */
export function card(page: Page, title: string) {
  return page
    .locator("section")
    .filter({ visible: true })
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

/** 관리 탭에서 학원을 등록하고 그 학원 화면(정보 수정·삭제)을 연다 */
export async function addAcademy(page: Page, academy: string, phone?: string): Promise<void> {
  await goToTab(page, "관리");
  await expect(page.getByRole("heading", { name: "관리", level: 1 })).toBeVisible();
  await field(page, "학원 이름").fill(academy);
  if (phone) await field(page, "전화번호 (선택)").fill(phone);
  await page.getByRole("button", { name: "학원 등록" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${academy}을(를) 등록했습니다.` })).toBeVisible();
  await card(page, "학원").getByRole("link").filter({ hasText: academy }).click();
  await expect(page.getByRole("heading", { name: academy, level: 1 })).toBeVisible();
}

/** 교육 탭의 + 로 등록된 학원의 오늘 요일 수업(16:00-17:00, 오늘 시작)을 추가한다 */
export async function enrollInAcademy(page: Page, academy: string, memo?: string): Promise<void> {
  await goToTab(page, "교육");
  await page.getByRole("link", { name: "수강 과목 추가" }).click();
  await expect(page.getByRole("heading", { name: "수강 과목 추가", level: 1 })).toBeVisible();
  await page.getByRole("combobox", { name: "학원" }).selectOption({ label: academy });
  await page.getByRole("combobox", { name: "1번째 수업 요일" }).selectOption(String(todayIsoWeekdayInSeoul()));
  await page.getByRole("textbox", { name: "1번째 수업 시작 시각" }).fill("16:00");
  await page.getByRole("textbox", { name: "1번째 수업 종료 시각" }).fill("17:00");
  if (memo) await field(page, "비고 (선택)").fill(memo);
  await page.getByRole("button", { name: "수강 과목 등록" }).click();
  await expect(page).toHaveURL(/\/education\?added=1$/);
  await expect(page.getByRole("status").filter({ hasText: "수업을 등록했습니다." })).toBeVisible();
}

/** 관리 탭에서 학원을 등록하고, 교육 탭에서 그 학원의 오늘 요일 수업을 추가한다 */
export async function enrollTodayClass(page: Page, academy: string, memo?: string): Promise<void> {
  await addAcademy(page, academy);
  await enrollInAcademy(page, academy, memo);
}

const TAB_PATHS = {
  홈: /\/$/,
  캘린더: /\/calendar/,
  교육: /\/education$/,
  여행: /\/travel$/,
  비용: /\/costs/,
  관리: /\/manage$/,
} as const;

/** 비용 탭 → 교육비 상세 목록 */
export async function goToTuition(page: Page): Promise<void> {
  await goToTab(page, "비용");
  await card(page, "교육비").getByRole("link", { name: "자세히" }).click();
  await expect(page).toHaveURL(/\/tuition/);
}

/** 탭으로 이동하고 주소가 바뀔 때까지 기다린다. 이전 화면 요소를 잡지 않기 위해서다. */
export async function goToTab(page: Page, name: keyof typeof TAB_PATHS): Promise<void> {
  await tab(page, name).click();
  await expect(page).toHaveURL(TAB_PATHS[name]);
}

/** 아빠가 가족을 만들고 엄마를 초대해 합류시킨다. 둘 다 홈 화면에서 멈춘다. */
export async function createFamilyWithSpouse(browser: Browser, familyName: string): Promise<{ dad: Page; mom: Page }> {
  const dad = await newPage(browser);
  const mom = await newPage(browser);
  await signUpWithFamily(dad, familyName, "아빠");
  await dad.goto("/family");
  await dad.getByRole("button", { name: "초대 링크 만들기" }).click();
  const invitePath = new URL(await field(dad, "초대 링크").inputValue()).pathname;

  await mom.goto(`/signup?next=${encodeURIComponent(invitePath)}`);
  await signUp(mom, uniqueEmail("mom"));
  await field(mom, "나의 호칭").fill("엄마");
  await mom.getByRole("button", { name: `${familyName}에 합류하기` }).click();
  await expect(mom.getByRole("heading", { name: familyName })).toBeVisible();
  return { dad, mom };
}
