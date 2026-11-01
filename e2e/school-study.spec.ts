import { expect, test } from "@playwright/test";
import { addChild, card, field, goToTab, newPage, seoulDate, signUpWithFamily } from "./helpers";

test("school exam with supplies and score, and a study log with progress", async ({ browser }) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "임씨네", "엄마");
  await addChild(page, "첫째");

  // 학교: 사흘 뒤 시험, 준비물 두 가지
  await goToTab(page, "교육");
  await page.getByRole("navigation", { name: "교육 메뉴" }).getByRole("link", { name: "학교" }).click();
  await page.getByRole("combobox", { name: "종류" }).selectOption("exam");
  await field(page, "내용").fill("수학 단원평가");
  await page.getByRole("textbox", { name: "날짜" }).fill(seoulDate(3));
  await field(page, "과목 (선택)").fill("수학");
  await field(page, "준비물 (선택)").fill("컴퓨터용 사인펜, 수정테이프");
  await page.getByRole("button", { name: "학교 일정 등록" }).click();
  await expect(page.getByRole("status").filter({ hasText: "'수학 단원평가'을(를) 등록했습니다." })).toBeVisible();
  await expect(card(page, "다가오는 학교 일정").getByText("준비물 2")).toBeVisible();

  // 준비물 챙기고 점수 기록
  await card(page, "다가오는 학교 일정").getByRole("link").filter({ hasText: "수학 단원평가" }).click();
  await card(page, "준비물").locator("li").filter({ hasText: "수정테이프" }).getByRole("button", { name: "챙김" }).click();
  await expect(card(page, "준비물").locator("li").filter({ hasText: "수정테이프" }).getByRole("button", { name: "취소" })).toBeVisible();
  await field(page, "점수").fill("92");
  await page.getByRole("button", { name: "점수 저장" }).click();
  await expect(page.getByRole("status").filter({ hasText: "점수를 저장했습니다." })).toBeVisible();

  // 홈과 캘린더에 보인다
  await goToTab(page, "홈");
  await expect(card(page, "다가오는 학교 일정").getByText("수학 단원평가")).toBeVisible();
  await page.goto(`/calendar?date=${seoulDate(3)}`);
  await expect(page.getByText("첫째 · 수학 단원평가").filter({ visible: true })).toBeVisible();

  // 학습: 과목 추가 후 진도 기록
  await goToTab(page, "교육");
  await page.getByRole("navigation", { name: "교육 메뉴" }).getByRole("link", { name: "학습" }).click();
  await field(page, "과목").fill("수학");
  await field(page, "교재 (선택)").fill("디딤돌 기본");
  await page.getByRole("button", { name: "과목 추가" }).click();
  await expect(page.getByRole("status").filter({ hasText: "수학 과목을 추가했습니다." })).toBeVisible();

  await field(page, "시간 (분)").fill("40");
  await field(page, "진도 단원").fill("3단원 분수");
  await field(page, "진도 %").fill("30");
  await page.getByRole("button", { name: "학습 기록" }).click();
  await expect(page.getByRole("status").filter({ hasText: "학습 기록을 남겼습니다." })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "수학 진도" })).toHaveAttribute("aria-valuenow", "30");
  await expect(card(page, "과목별 진도").getByText("최근 진도 3단원 분수 30%")).toBeVisible();
});
