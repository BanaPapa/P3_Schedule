import { expect, test, type Page } from "@playwright/test";
import {
  addChild,
  card,
  enrollTodayClass,
  isoWeekdayOf,
  newPage,
  seoulDate,
  signUpWithFamily,
  goToTab,
} from "./helpers";

/** 캘린더에서 그 날짜를 열고 학원 수업을 누른다 */
async function openSession(page: Page, date: string, academy: string): Promise<void> {
  await page.goto(`/calendar?view=month&date=${date}`);
  await card(page, dayTitle(date)).getByRole("link").filter({ hasText: academy }).first().click();
  await expect(page.getByRole("heading", { level: 1 }).filter({ hasText: academy })).toBeVisible();
}

function dayTitle(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  const weekday = ["월", "화", "수", "목", "금", "토", "일"][isoWeekdayOf(isoDate) - 1];
  return `${month}월 ${day}일 (${weekday})`;
}

async function fillSlot(page: Page, cardTitle: string, date: string, start: string, end: string): Promise<void> {
  const target = card(page, cardTitle);
  await target.getByLabel("날짜").fill(date);
  await target.getByLabel("시작").fill(start);
  await target.getByLabel("끝").fill(end);
}

test("PRD scenario: an absence waits for a makeup, and the makeup is linked and shown on the calendar", async ({
  browser,
}) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "한씨네", "아빠");
  await addChild(page, "첫째");
  await enrollTodayClass(page, "튼튼영어");

  // ① 다음 주 수업을 결석으로
  const missedDate = seoulDate(7);
  await openSession(page, missedDate, "튼튼영어");
  await card(page, "상태 바꾸기").getByRole("button", { name: "결석" }).click();
  await expect(page.getByRole("status").filter({ hasText: "'결석'(으)로 바꿨습니다." })).toBeVisible();

  // ② 보강 대기 목록 (홈 알림과 교육 탭)
  await goToTab(page, "홈");
  await expect(card(page, "보강 대기 1건")).toBeVisible();
  await goToTab(page, "교육");
  await card(page, "보강 대기 1건").getByRole("link").filter({ hasText: "튼튼영어" }).click();

  // ③ 보강 일정 등록
  const makeupDate = seoulDate(10);
  await fillSlot(page, "보강", makeupDate, "16:00", "17:00");
  await card(page, "보강").getByRole("button", { name: "보강 등록" }).click();
  await expect(page.getByRole("link").filter({ hasText: "보강" }).filter({ hasText: "보강 예정" })).toBeVisible();

  // ④ 통합 캘린더: 원래 수업은 결석, 보강일에는 보강 수업
  await page.goto(`/calendar?view=month&date=${missedDate}`);
  await expect(card(page, dayTitle(missedDate)).getByText("결석")).toBeVisible();
  await page.goto(`/calendar?view=month&date=${makeupDate}`);
  const makeupDay = card(page, dayTitle(makeupDate));
  await expect(makeupDay.getByText("보강", { exact: true })).toBeVisible();
  await expect(makeupDay.getByText("보강 예정")).toBeVisible();

  // 보강이 잡혔으니 대기 목록에서 빠진다
  await goToTab(page, "교육");
  await expect(card(page, "수강 과목")).toBeVisible();
  await expect(page.getByRole("heading", { name: /보강 대기/ }).filter({ visible: true })).toHaveCount(0);
});

test("a single session can move to another day, and the weekly schedule can change from a date on", async ({
  browser,
}) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "오씨네", "엄마");
  await addChild(page, "첫째");
  await enrollTodayClass(page, "생각수학");

  // 이번 수업만 다음 날 18:00 으로
  const original = seoulDate(14);
  const moved = seoulDate(15);
  await openSession(page, original, "생각수학");
  await fillSlot(page, "이번 수업만 변경", moved, "18:00", "19:00");
  await card(page, "이번 수업만 변경").getByRole("button", { name: "이번 수업만 변경" }).click();
  // 새로 생긴 변경 수업 화면으로 이동하고, 원래 수업(취소)과 연결되어 있다
  await expect(page.getByRole("link").filter({ hasText: "원래 수업" }).filter({ hasText: "취소" })).toBeVisible();
  await page.goto(`/calendar?view=month&date=${moved}`);
  await expect(card(page, dayTitle(moved)).getByText("18:00–19:00")).toBeVisible();
  await expect(card(page, dayTitle(moved)).getByText("변경", { exact: true })).toBeVisible();

  // 3주 뒤부터는 다음 날 요일 17:00 으로
  await goToTab(page, "교육");
  await page.getByRole("link", { name: "일정 변경" }).click();
  await page.getByRole("textbox", { name: "이 날부터 적용" }).fill(seoulDate(21));
  await page.getByRole("combobox", { name: "1번째 수업 요일" }).selectOption(String(isoWeekdayOf(seoulDate(22))));
  await page.getByRole("textbox", { name: "1번째 수업 시작 시각" }).fill("17:00");
  await page.getByRole("textbox", { name: "1번째 수업 종료 시각" }).fill("18:00");
  await page.getByRole("button", { name: "앞으로 전체 변경" }).click();
  await expect(page.getByRole("status").filter({ hasText: "일정을 바꿨습니다." })).toBeVisible();

  await page.goto(`/calendar?view=month&date=${seoulDate(22)}`);
  await expect(card(page, dayTitle(seoulDate(22))).getByText("17:00–18:00")).toBeVisible();
  await page.goto(`/calendar?view=month&date=${seoulDate(21)}`);
  await expect(card(page, dayTitle(seoulDate(21))).getByText("이날은 수업이 없습니다.")).toBeVisible();
  // 변경 전 수업은 그대로
  await page.goto(`/calendar?view=month&date=${seoulDate(7)}`);
  await expect(card(page, dayTitle(seoulDate(7))).getByText("16:00–17:00")).toBeVisible();
});
