import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "family-hub-1234";

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

async function signUp(page: Page, email: string): Promise<void> {
  // 링크로 넘어온 경우 이전 화면(로그인) 폼에 입력하지 않도록 회원가입 화면을 기다린다
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
  await page.getByRole("textbox", { name: "이메일", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "비밀번호", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "가입하기" }).click();
}

test("parents share a family: invite, join, edit, and detect conflicting edits", async ({ browser }) => {
  const dad = await (await browser.newContext()).newPage();
  const mom = await (await browser.newContext()).newPage();

  // 아빠: 가입 → 가족 만들기
  await dad.goto("/");
  await expect(dad).toHaveURL(/\/login$/);
  await dad.getByRole("link", { name: "회원가입" }).click();
  await signUp(dad, uniqueEmail("dad"));
  await expect(dad).toHaveURL(/\/onboarding$/);
  await dad.getByRole("textbox", { name: "가족 이름", exact: true }).fill("김씨네");
  await dad.getByRole("textbox", { name: "나의 호칭", exact: true }).fill("아빠");
  await dad.getByRole("button", { name: "가족 만들기" }).click();
  await expect(dad.getByRole("heading", { name: "김씨네" })).toBeVisible();

  // 아빠: 자녀 등록, 초대 링크 만들기
  await dad.getByRole("link", { name: "가족", exact: true }).click();
  await dad.getByRole("textbox", { name: "이름", exact: true }).fill("첫째");
  await dad.getByRole("button", { name: "자녀 등록" }).click();
  await expect(dad.getByRole("status").filter({ hasText: "첫째을(를) 등록했습니다." })).toBeVisible();
  await dad.getByRole("button", { name: "초대 링크 만들기" }).click();
  const inviteUrl = await dad.getByRole("textbox", { name: "초대 링크", exact: true }).inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[0-9a-f]{32}$/);

  // 엄마: 초대 링크 → 로그인 화면 → 가입 → 초대 화면으로 돌아와 합류
  await mom.goto(new URL(inviteUrl).pathname);
  await expect(mom).toHaveURL(/\/login\?next=/);
  await mom.getByRole("link", { name: "회원가입" }).click();
  await signUp(mom, uniqueEmail("mom"));
  await expect(mom.getByText("아빠님이")).toBeVisible();
  await mom.getByRole("textbox", { name: "나의 호칭", exact: true }).fill("엄마");
  await mom.getByRole("button", { name: "김씨네에 합류하기" }).click();
  await expect(mom.getByRole("heading", { name: "김씨네" })).toBeVisible();
  await expect(mom.getByText("첫째")).toBeVisible();

  // 아빠: 오래된 화면에서 수정 폼을 열어 둔다
  await dad.reload();
  await dad.getByRole("button", { name: "수정" }).click();

  // 엄마: 먼저 수정
  await mom.goto("/family");
  await mom.getByRole("button", { name: "수정" }).click();
  await mom.getByRole("listitem").getByRole("textbox", { name: "이름", exact: true }).fill("김첫째");
  await mom.getByRole("button", { name: "저장" }).click();
  await expect(mom.getByText("김첫째")).toBeVisible();

  // 아빠: 옛 version 으로 저장하면 덮어쓰지 않고 충돌을 알린다
  await dad.getByRole("listitem").getByRole("textbox", { name: "이름", exact: true }).fill("덮어쓰기");
  await dad.getByRole("button", { name: "저장" }).click();
  await expect(
    dad.getByRole("alert").filter({ hasText: "다른 가족 구성원이 먼저 수정했습니다" }),
  ).toBeVisible();
  await expect(dad.getByText("김첫째")).toBeVisible();
  await expect(dad.getByText("덮어쓰기")).toHaveCount(0);

  // 부모 두 명이 다 찼으므로 초대 영역이 사라진다
  await expect(dad.getByText("부모 두 명이 모두 등록되었습니다.")).toBeVisible();
});

test("an invite link cannot be reused by a third person", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  const spouse = await (await browser.newContext()).newPage();
  const stranger = await (await browser.newContext()).newPage();

  await owner.goto("/signup");
  await signUp(owner, uniqueEmail("owner"));
  await owner.getByRole("textbox", { name: "가족 이름", exact: true }).fill("박씨네");
  await owner.getByRole("textbox", { name: "나의 호칭", exact: true }).fill("엄마");
  await owner.getByRole("button", { name: "가족 만들기" }).click();
  await owner.goto("/family");
  await owner.getByRole("button", { name: "초대 링크 만들기" }).click();
  const invitePath = new URL(await owner.getByRole("textbox", { name: "초대 링크", exact: true }).inputValue()).pathname;

  await spouse.goto(`/signup?next=${encodeURIComponent(invitePath)}`);
  await signUp(spouse, uniqueEmail("spouse"));
  await spouse.getByRole("textbox", { name: "나의 호칭", exact: true }).fill("아빠");
  await spouse.getByRole("button", { name: "박씨네에 합류하기" }).click();
  await expect(spouse.getByRole("heading", { name: "박씨네" })).toBeVisible();

  await stranger.goto(`/signup?next=${encodeURIComponent(invitePath)}`);
  await signUp(stranger, uniqueEmail("stranger"));
  await expect(stranger.getByText("이미 사용된 초대입니다.")).toBeVisible();
});

test("signed-out visitors cannot open family pages", async ({ page }) => {
  await page.goto("/family");
  await expect(page).toHaveURL(/\/login\?next=%2Ffamily$/);
});
