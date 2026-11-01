import { expect, test } from "@playwright/test";
import { addChild, card, goToTab, newPage, seoulDate, signUpWithFamily } from "./helpers";

test("AI only suggests: the parent reviews, edits and registers what they pick", async ({ browser }) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "강씨네", "엄마");
  await addChild(page, "첫째");

  await goToTab(page, "교육");
  await page.getByRole("navigation", { name: "교육 메뉴" }).getByRole("link", { name: "학교" }).click();
  await page.getByRole("link", { name: /가정통신문 사진·글로 일정 찾기/ }).click();

  // 테스트용 가짜 AI 는 글 속 날짜마다 후보를 하나 만든다
  await page.getByRole("textbox", { name: "안내문 글" }).fill(`${seoulDate(5)} 현장체험학습\n${seoulDate(6)} 학부모 상담`);
  await page.getByRole("button", { name: "일정 찾기" }).click();
  await expect(page.getByRole("heading", { name: /찾은 학교 일정 2개/ })).toBeVisible();

  // 아직 아무것도 저장되지 않았다
  await page.goto("/school");
  await expect(page.getByText("등록한 학교 일정이 없습니다.")).toBeVisible();

  // 다시 찾고, 두 번째는 빼고, 첫 번째는 준비물을 넣어 등록
  await page.goto("/assistant");
  await page.getByRole("textbox", { name: "안내문 글" }).fill(`${seoulDate(5)} 현장체험학습\n${seoulDate(6)} 학부모 상담`);
  await page.getByRole("button", { name: "일정 찾기" }).click();
  await page.getByRole("checkbox", { name: "2번째 후보 등록" }).uncheck();
  await page.getByRole("textbox", { name: "1번째 후보 준비물" }).fill("도시락, 물병");
  await page.getByRole("button", { name: "고른 1개를 학교 일정으로 등록" }).click();
  await expect(page.getByRole("status").filter({ hasText: "학교 일정 1개를 등록했습니다." })).toBeVisible();

  await page.goto("/school");
  const upcoming = card(page, "다가오는 학교 일정");
  await expect(upcoming.getByText("현장체험학습")).toBeVisible();
  await expect(upcoming.getByText("준비물 2")).toBeVisible();
  await expect(upcoming.getByText("학부모 상담")).toHaveCount(0);
});

test("cost analysis is offered on the costs page", async ({ browser }) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "백씨네", "아빠");
  await goToTab(page, "비용");
  await page.getByRole("button", { name: "AI로 최근 6개월 지출 살펴보기" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "분석할 지출이 아직 없습니다" })).toBeVisible();
});
