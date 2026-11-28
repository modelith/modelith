// 公式のサンプル集（F-FILE-20）。「サンプルを開く」で一覧から選んで開く。
import { expect, openApp, test } from "./fixtures";

test("F-FILE-20: 「サンプルを開く」で一覧が出て、選んだサンプルが保存先の無いファイルとして開く", async ({ page }) => {
  // Arrange
  await openApp(page);
  // Act
  await page.locator("#fileMenu > summary").click();
  await page.locator("#btnSample").click();
  // Assert（入門を先に、5 つ並ぶ）
  await expect(page.locator("#dialogPick input")).toHaveCount(5);
  await expect(page.locator("#dialogPick")).toContainText("入門：構造と接続（卓上扇風機）");
  // Act
  await page.locator('#dialogPick input[value="intro-structure"]').check();
  await page.locator('#dialogButtons [data-id="ok"]').click();
  // Assert
  await expect(page.locator("#docName")).toHaveText("intro-structure.sysml");
  await expect(page.locator("#gNodes .node").first()).toBeVisible();
  await expect(page.locator("#problems")).not.toContainText("エラー");
});

test("F-FILE-20: 選び直さずに「開く」を押すと、一覧の最初のサンプルが開く（境界値: 既定の選択）", async ({ page }) => {
  // Arrange
  await openApp(page);
  await page.locator("#fileMenu > summary").click();
  await page.locator("#btnSample").click();
  // Act
  await page.locator('#dialogButtons [data-id="ok"]').click();
  // Assert
  await expect(page.locator("#docName")).toHaveText("intro-requirements.sysml");
});

test("F-FILE-20: 一覧で「やめる」を押すと、何も開かない（異常系）", async ({ page }) => {
  // Arrange
  await openApp(page);
  await page.locator("#fileMenu > summary").click();
  await page.locator("#btnSample").click();
  // Act
  await page.locator('#dialogButtons [data-id="cancel"]').click();
  // Assert
  await expect(page.locator("#docName")).toHaveText("electric-kettle.sysml");
  await expect(page.locator("#explorer [data-doc]")).toHaveCount(1);
});
