import { expect, test } from "@playwright/test";
import { createFamilyWithSpouse, field } from "./helpers";

test("a change by one parent appears on the other parent's screen without reloading, and in the history", async ({
  browser,
}) => {
  const { dad, mom } = await createFamilyWithSpouse(browser, "서씨네");
  await dad.goto("/family");
  await expect(dad.getByText("아직 등록한 자녀가 없습니다.")).toBeVisible();

  // 엄마가 자녀를 등록하면 아빠 화면이 저절로 바뀐다
  await mom.goto("/family");
  await field(mom, "이름").fill("둘째");
  await mom.getByRole("button", { name: "자녀 등록" }).click();
  await expect(mom.getByRole("status").filter({ hasText: "둘째을(를) 등록했습니다." })).toBeVisible();

  await expect(dad.getByRole("status").filter({ hasText: "엄마님이 내용을 바꿔 화면을 새로 고쳤습니다." })).toBeVisible({
    timeout: 15_000,
  });
  await expect(dad.getByText("둘째", { exact: true }).filter({ visible: true })).toBeVisible();

  // 변경 이력: 누가 무엇을 했는지
  await dad.goto("/history");
  const history = dad.locator("ol").filter({ visible: true });
  await expect(history.getByText("자녀 둘째을(를) 등록했습니다")).toBeVisible();
  await expect(history.locator("li").filter({ hasText: "자녀 둘째을(를) 등록했습니다" }).getByText("엄마")).toBeVisible();
  await expect(history.getByText("엄마님이 가족에 합류했습니다")).toBeVisible();
});
