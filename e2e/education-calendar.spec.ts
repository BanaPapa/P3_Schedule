import { expect, test } from "@playwright/test";
import { addChild, field, newPage, signUpWithFamily, tab, todayIsoWeekdayInSeoul } from "./helpers";

test("an enrolled class appears on today's home card and the calendar, and leaves when deleted", async ({
  browser,
}) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "최씨네", "엄마");
  await addChild(page, "첫째");

  // 학원 등록
  await tab(page, "교육").click();
  await expect(page.getByRole("heading", { name: "교육", level: 1 })).toBeVisible();
  await field(page, "학원 이름").fill("튼튼영어");
  await field(page, "전화번호 (선택)").fill("02-123-4567");
  await page.getByRole("button", { name: "학원 등록" }).click();
  await expect(page.getByRole("status").filter({ hasText: "튼튼영어을(를) 등록했습니다." })).toBeVisible();

  // 오늘 요일에 수업이 있는 과목 등록 (자녀가 한 명이면 자동 선택된다)
  await page.getByRole("combobox", { name: "학원" }).selectOption({ label: "튼튼영어" });
  await field(page, "과목").fill("영어");
  await page.getByRole("combobox", { name: "1번째 수업 요일" }).selectOption(String(todayIsoWeekdayInSeoul()));
  await page.getByLabel("1번째 수업 시작 시각").fill("16:00");
  await page.getByLabel("1번째 수업 종료 시각").fill("17:00");
  await page.getByRole("button", { name: "수강 과목 등록" }).click();
  await expect(page.getByRole("status").filter({ hasText: "영어 수업을 등록했습니다." })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "첫째 · 튼튼영어" })).toBeVisible();

  // 수강 과목이 있는 학원은 지울 수 없다
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: "02-123-4567" })
    .getByRole("button", { name: "삭제" })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "수강 과목이 등록된 학원은 삭제할 수 없습니다" })).toBeVisible();

  // 홈: 오늘 일정
  await tab(page, "홈").click();
  const todayCard = page.locator("section").filter({ hasText: "오늘 일정" });
  await expect(todayCard.getByText("영어", { exact: true })).toBeVisible();
  await expect(todayCard.getByText("16:00–17:00")).toBeVisible();

  // 캘린더: 월간 아래 목록과 주간
  await tab(page, "캘린더").click();
  await expect(page.getByText("튼튼영어", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("link", { name: "주간" }).click();
  await expect(page.getByRole("region").filter({ hasText: "오늘" }).getByText("영어", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "다음 주" }).click();
  await expect(page.getByText("영어", { exact: true }).filter({ visible: true }).first()).toBeVisible();

  // 오늘 시작해 지난 수업이 없으니 삭제할 수 있고, 캘린더에서도 빠진다
  await tab(page, "교육").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: "첫째 · 튼튼영어" })
    .getByRole("button", { name: "삭제" })
    .click();
  await expect(page.getByText("아직 등록한 수강 과목이 없습니다.")).toBeVisible();
  await tab(page, "캘린더").click();
  await expect(page.getByText("이날은 수업이 없습니다.").filter({ visible: true })).toBeVisible();
});

test("a family cannot filter the calendar by another family's child", async ({ browser }) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "정씨네", "아빠");
  await page.goto("/calendar?child=6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11");
  await expect(page.getByText("이날은 수업이 없습니다.").filter({ visible: true })).toBeVisible();
});
