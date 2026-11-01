import { expect, test } from "@playwright/test";
import { card, field, goToTab, newPage, seoulDate, signUpWithFamily } from "./helpers";

test("a family trip with itinerary, budget and spending shows up in the calendar and monthly costs", async ({
  browser,
}) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "최씨네", "엄마");

  // 여행 만들기 (2주 뒤 3일)
  await goToTab(page, "여행");
  await field(page, "여행 이름").fill("제주 여름 여행");
  await field(page, "여행지 (선택)").fill("제주");
  await page.getByRole("textbox", { name: "떠나는 날" }).fill(seoulDate(14));
  await page.getByRole("textbox", { name: "돌아오는 날" }).fill(seoulDate(16));
  await field(page, "전체 예산 (선택, 원)").fill("1,000,000");
  await page.getByRole("button", { name: "여행 만들기" }).click();
  await expect(page.getByRole("heading", { name: "제주 여름 여행" })).toBeVisible();
  await expect(page.getByText("D-14")).toBeVisible();

  // 2일차 일정
  await page.getByText("+ 일정 추가").click();
  await page.getByRole("combobox", { name: "날짜" }).selectOption(seoulDate(15));
  await field(page, "일정").fill("성산일출봉");
  await page.getByRole("textbox", { name: "시작 (선택)" }).fill("10:00");
  await page.getByRole("button", { name: "일정 넣기" }).click();
  await expect(card(page, "일정표").getByText("성산일출봉", { exact: true })).toBeVisible();

  // 예산과 오늘 지출(숙소 예약)
  await page.getByText("분류별 예산 정하기").click();
  await card(page, "예산과 지출").getByRole("combobox", { name: "분류" }).selectOption("lodging");
  await field(page, "예산 (원)").fill("600,000");
  await page.getByRole("button", { name: "예산 저장" }).click();
  await expect(page.getByRole("status").filter({ hasText: "예산을 저장했습니다." })).toBeVisible();

  const expenses = card(page, "지출 기록");
  await expenses.getByRole("combobox", { name: "분류" }).selectOption("lodging");
  await field(page, "금액 (원)").fill("550,000");
  await field(page, "내용 (선택)").fill("호텔 예약");
  await page.getByRole("button", { name: "지출 기록" }).click();
  await expect(expenses.getByText("호텔 예약")).toBeVisible();
  await expect(page.getByText("남은 예산 450,000원")).toBeVisible();

  // 통합 캘린더: 2일차 일정
  await page.goto(`/calendar?date=${seoulDate(15)}`);
  await expect(page.getByText("✈ 제주 여름 여행 · 2일차").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("성산일출봉", { exact: true }).filter({ visible: true })).toBeVisible();

  // 월별 비용: 이번 달 여행비
  await goToTab(page, "비용");
  await expect(card(page, "여행비").getByText("550,000원")).toBeVisible();
});
