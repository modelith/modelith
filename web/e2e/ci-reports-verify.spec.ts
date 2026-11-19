// CI のテスト結果のページ（ci-reports.yml）が置かれるかを確かめるための、わざと失敗するテスト。マージしない。
import { expect, test } from "./fixtures";

test("Q-5 わざと失敗する（CI のテスト結果のページの確認用）", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#ci-reports-verify-missing")).toBeVisible({ timeout: 2000 });
});
