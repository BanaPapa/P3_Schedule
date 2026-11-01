import { expect, test } from "@playwright/test";
import { addChild, card, enrollTodayClass, field, goToTuition, newPage, seoulDate, signUpWithFamily } from "./helpers";

test("PRD: a confirmed invoice stays fixed when the schedule changes until the parent adjusts it, and partial payments add up", async ({
  browser,
}) => {
  const page = await newPage(browser);
  await signUpWithFamily(page, "윤씨네", "엄마");
  await addChild(page, "첫째");
  await enrollTodayClass(page, "튼튼영어", "영어");

  // 요금 정책: 회차별 4만원, 결제일 5일
  await goToTuition(page);
  await page.getByRole("link").filter({ hasText: "첫째 · 영어" }).click();
  await page.getByRole("link", { name: "요금 정책 설정" }).click();
  await page.getByRole("radio", { name: /회차별/ }).check();
  await field(page, "회당 수강료 (원)").fill("40,000");
  await field(page, "결제일 (선택)").fill("5");
  await page.getByRole("button", { name: "요금 정책 저장" }).click();
  await expect(page.getByRole("status").filter({ hasText: "요금 정책을 저장했습니다." })).toBeVisible();

  // 예상액 확인 후 그대로 확정
  await page.getByRole("link", { name: "‹ 교육비" }).click();
  const estimateCard = card(page, "예상 학원비");
  await expect(estimateCard.getByText(/× 40,000원/)).toBeVisible();
  const estimate = (await estimateCard.locator("p.text-2xl").innerText()).trim();
  await page.getByRole("button", { name: "이 달 청구 확정" }).click();
  const invoiceCard = card(page, "확정 청구");
  await expect(invoiceCard.locator("div").filter({ hasText: "청구 합계" }).getByText(estimate)).toBeVisible();

  // 부분 납부 1만원
  await field(page, "금액 (원)").fill("10,000");
  await page.getByRole("button", { name: "납부 기록" }).click();
  await expect(card(page, "납부").getByText(/^일부 납부/)).toBeVisible();

  // 오늘 수업을 취소한다 → 예상액만 바뀌고 확정액은 그대로
  await page.goto(`/calendar?date=${seoulDate(0)}`);
  await page.locator("section").filter({ visible: true }).getByRole("link").filter({ hasText: "영어" }).first().click();
  await card(page, "상태 바꾸기").getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("status").filter({ hasText: "'취소'(으)로 바꿨습니다." })).toBeVisible();

  await goToTuition(page);
  await expect(page.getByText("일정이 바뀌어 예상액이 달라졌습니다")).toBeVisible();
  await page.getByRole("link").filter({ hasText: "첫째 · 영어" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "확정 뒤 일정이 바뀌어" })).toBeVisible();
  await expect(card(page, "확정 청구").locator("div").filter({ hasText: "청구 합계" }).getByText(estimate)).toBeVisible();

  // 사용자가 확인하고 조정한 뒤에야 확정액이 바뀐다
  await field(page, "조정 사유 (선택)").fill("오늘 수업 취소");
  await page.getByRole("button", { name: "확정액 조정" }).click();
  // 조정되면 경고가 사라지고, 사유가 남고, 합계가 지금 예상액으로 바뀐다
  await expect(card(page, "확정 청구").getByText("메모: 오늘 수업 취소")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "확정 뒤 일정이 바뀌어" })).toHaveCount(0);
  const newEstimate = (await card(page, "예상 학원비").locator("p.text-2xl").innerText()).trim();
  expect(newEstimate).not.toBe(estimate);
  await expect(card(page, "확정 청구").locator("div").filter({ hasText: "청구 합계" }).getByText(newEstimate)).toBeVisible();
});
