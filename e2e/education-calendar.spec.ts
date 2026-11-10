import { expect, test } from "@playwright/test";
import { addAcademy, addChild, card, enrollInAcademy, goToTab, newPage, signUpWithFamily } from "./helpers";

test("an enrolled class appears on today's home card and the calendar, and leaves when deleted", async ({
  browser,
}) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "최씨네", "엄마");
  await addChild(page, "첫째");

  // 관리 탭에서 학원 등록 → 교육 탭의 + 로 그 학원을 골라 수강 등록 (자녀가 한 명이면 자동 선택된다)
  await addAcademy(page, "튼튼영어", "02-123-4567");
  // 학원 화면에는 수강 과목 추가 폼이 없다
  await expect(page.getByRole("button", { name: "수강 과목 등록" })).toHaveCount(0);
  await enrollInAcademy(page, "튼튼영어", "토요일 보충 있음");
  const row = page.getByRole("listitem").filter({ hasText: "튼튼영어" }).filter({ hasText: "첫째" });
  await expect(row).toBeVisible();
  await expect(row.getByText("비고: 토요일 보충 있음")).toBeVisible();
  // 과목명 입력칸은 없다
  await page.getByRole("link", { name: "수강 과목 추가" }).click();
  await expect(page.getByRole("textbox", { name: "과목" })).toHaveCount(0);
  await page.getByRole("link", { name: "‹ 교육" }).click();

  // 수강 과목이 있는 학원은 지울 수 없다 (학원 삭제는 관리 탭에서만)
  await goToTab(page, "관리");
  await card(page, "학원").getByRole("link").filter({ hasText: "튼튼영어" }).click();
  await expect(card(page, "수강 중").getByText("첫째")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "학원 삭제" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "수강 과목이 등록된 학원은 삭제할 수 없습니다" })).toBeVisible();

  // 홈: 오늘 일정
  await goToTab(page, "홈");
  const todayCard = page.locator("section").filter({ hasText: "오늘 일정" });
  await expect(todayCard.getByText("튼튼영어", { exact: true })).toBeVisible();
  await expect(todayCard.getByText("16:00–17:00")).toBeVisible();

  // 캘린더: 기본은 주간(월요일 시작), 월간은 아래 목록
  await goToTab(page, "캘린더");
  await expect(page.getByRole("region").filter({ hasText: "오늘" }).getByText("튼튼영어", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "다음 주" }).click();
  await expect(page.getByText("튼튼영어", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "월간" }).click();
  await expect(page.getByText("튼튼영어", { exact: true }).filter({ visible: true }).first()).toBeVisible();

  // 오늘 시작해 지난 수업이 없으니 삭제할 수 있고, 캘린더에서도 빠진다
  await goToTab(page, "교육");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: "튼튼영어" })
    .filter({ hasText: "첫째" })
    .getByRole("button", { name: "삭제" })
    .click();
  await expect(page.getByText("아직 등록한 수강 과목이 없습니다.")).toBeVisible();
  await goToTab(page, "캘린더");
  await expect(page.getByRole("region").filter({ hasText: "오늘" }).getByText("수업 없음")).toBeVisible();
});

test("a family cannot filter the calendar by another family's child", async ({ browser }) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "정씨네", "아빠");
  await page.goto("/calendar?child=6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11");
  await expect(page.getByRole("region").filter({ hasText: "오늘" }).getByText("수업 없음")).toBeVisible();
});
