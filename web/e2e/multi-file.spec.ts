// 複数のファイルにまたがるモデル（ADR-0021、F-FILE-15）。ローカルフォルダの代わりに OPFS を使う。
import { editorText, expect, openApp, putFiles, test } from "./fixtures";
import type { Page } from "@playwright/test";

const PARTS = "package Parts {\n    part def Car;\n    part def Bus;\n}\n";
const APP = "package App {\n    import Parts::*;\n    part def Fleet {\n        part c : Car;\n    }\n}\n";

/** parts.sysml と app.sysml のフォルダを開き、app.sysml を表示して、図のタブ「ブロック定義図」を開く。 */
async function openApp2(page: Page): Promise<void> {
  await openApp(page);
  await putFiles(page, { "parts.sysml": PARTS, "app.sysml": APP });
  await page.locator('[data-cmd="openFolder"]').click();
  await page.locator('#explorer [data-file][title="app.sysml"]').click();
  await expect(page.locator("#docName")).toHaveText("app.sysml");
  await page.waitForTimeout(400); // 表示の反映で図のタブのメニューが描き直されるのを待つ
  await page.locator(".tabadd summary").click();
  await page.locator('[data-open="structure"]').click();
}

test("F-FILE-15: import したほかのファイルの定義を見つけ、参照したものだけをファイル名の札を付けて描く", async ({ page }) => {
  // Arrange・Act
  await openApp2(page);
  // Assert（Car は見つかり、取り込んだだけの Bus は描かない）
  await expect(page.locator('#gNodes .node[data-key="Car"] .filebadge text')).toHaveText("parts.sysml");
  await expect(page.locator('#gNodes .node[data-key="Bus"]')).toHaveCount(0);
  await expect(page.locator("#problems")).not.toContainText("見つかりません");
});

test("F-FILE-15: ほかのファイルの要素を選ぶと、そのファイルを開ける", async ({ page }) => {
  // Arrange
  await openApp2(page);
  // Act
  await page.locator('#gNodes .node[data-key="Car"]').click();
  await expect(page.locator("#insp")).toContainText("parts.sysml の要素");
  await page.locator('#insp [data-act="openFile"]').click();
  // Assert
  await expect(page.locator("#docName")).toHaveText("parts.sysml");
});

test("F-FILE-15: ほかのファイルの要素を図から消そうとすると、書き換えずにそのファイルを案内する", async ({ page }) => {
  // Arrange
  await openApp2(page);
  await page.locator('#gNodes .node[data-key="Car"]').click();
  // Act
  await page.keyboard.press("Delete");
  // Assert（テキストは変えず、案内からそのファイルを開ける）
  await expect(page.locator("#dialog")).toContainText("この要素は「parts.sysml」にあります");
  await page.locator('#dialogButtons [data-id="open"]').click();
  await expect(page.locator("#docName")).toHaveText("parts.sysml");
  await page.locator('#explorer [data-file][title="app.sysml"]').click();
  await expect(page.locator("#ed")).toHaveValue(APP);
});

test("F-EDIT-2・F-FILE-15: ほかのファイルの図に出している要素を削除しようとすると、理由を示してそのファイルを案内し、図から外すと削除できる（#297）", async ({ page }) => {
  // Arrange（shelf.sysml の作成した図が、表示中の stock.sysml の Item だけを出している）
  const stock = "package Stock {\n    part def Item;\n    part def Box;\n}\n";
  const shelf = "package Shelf {\n    view shelf : GeneralView {\n        expose Stock::Item;\n    }\n}\n";
  await openApp(page);
  await putFiles(page, { "stock.sysml": stock, "shelf.sysml": shelf });
  await page.locator('[data-cmd="openFolder"]').click();
  await page.locator('#explorer [data-file][title="stock.sysml"]').click();
  await expect(page.locator("#docName")).toHaveText("stock.sysml");
  await page.waitForTimeout(400); // 表示の反映で図のタブのメニューが描き直されるのを待つ
  await page.locator(".tabadd summary").click();
  await page.locator('[data-open="structure"]').click();
  await page.locator('#gNodes .node[data-key="Item"]').click();
  // Act
  await page.keyboard.press("Delete");
  // Assert（Item は表示中のファイルの要素なので、「ほかのファイルの要素です」とは言わない。テキストは変えない）
  await expect(page.locator("#dialogTitle")).toHaveText("ほかのファイルの図に出しています");
  await expect(page.locator("#dialogText")).toHaveText(
    "この要素は「shelf.sysml」の図に出しているので、削除できません。先にそのファイルを開いて、図でこの要素を右クリックし、「この図から外す」を選んでください。",
  );
  await expect(page.locator("#ed")).toHaveValue(stock);
  // 案内どおりに、そのファイルを開いて図から外すと、削除できる
  await page.locator('#dialogButtons [data-id="open"]').click();
  await expect(page.locator("#docName")).toHaveText("shelf.sysml");
  await page.locator("#sideViews").click();
  await page.locator('#diagramList [data-mv="shelf"]').click();
  await page.locator('#gNodes .node[data-key="Item"]').click({ button: "right" });
  await page.locator('#ctx button:has-text("この図から外す")').click();
  await expect(page.locator("#ed")).toHaveValue(shelf.replace("        expose Stock::Item;\n", ""));
  await page.locator("#sideFiles").click();
  await page.locator('#explorer [data-file][title="stock.sysml"]').click();
  await expect(page.locator("#docName")).toHaveText("stock.sysml");
  await page.locator('#gNodes .node[data-key="Item"]').click();
  await page.keyboard.press("Delete");
  await expect(page.locator("#ed")).toHaveValue(stock.replace("    part def Item;\n", ""));
});

test("F-FILE-15: ほかのファイルを編集すると、表示に戻ったときの図に入る", async ({ page }) => {
  // Arrange
  await openApp2(page);
  await page.locator('#explorer [data-file][title="parts.sysml"]').click();
  // ファイルを開くのは非同期。表示を待たずに打つと、まだ表示中の app.sysml の入力になる
  await expect(page.locator("#docName")).toHaveText("parts.sysml");
  // Act（Car の名前をテキストで変える）
  await page.locator("#ed").fill(PARTS.replace("Car", "Truck"));
  await page.waitForTimeout(400); // 入力の反映（0.28 秒）を待つ
  await page.locator('#explorer [data-file][title="app.sysml"]').click();
  // Assert（app.sysml の Car は見つからなくなる）
  await expect(page.locator("#problems")).toContainText("型「Car」が見つかりません");
});

const A = "package A {\n    part def X;\n}\n";
const B = "package B {\n    part def Y;\n}\n";

/** 互いに参照しない a.sysml と b.sysml のフォルダを開き、a.sysml を表示して、図のタブ「ブロック定義図」を開く。 */
async function openUnrelated(page: Page): Promise<void> {
  await openApp(page);
  await putFiles(page, { "a.sysml": A, "b.sysml": B });
  await page.locator('[data-cmd="openFolder"]').click();
  await page.locator('#explorer [data-file][title="a.sysml"]').click();
  await expect(page.locator("#docName")).toHaveText("a.sysml");
  await page.waitForTimeout(400); // 表示の反映で図のタブのメニューが描き直されるのを待つ
  await page.locator(".tabadd summary").click();
  await page.locator('[data-open="structure"]').click();
}

test("F-EDIT-3・F-FILE-15: ほかのファイルがあっても、表示中のファイルの定義の名前を図から変えられる", async ({ page }) => {
  // Arrange
  await openUnrelated(page);
  await page.locator('#gNodes .node[data-key="X"]').click();
  // Act
  await page.locator('[data-act="rename"]').click();
  await page.locator("#renameIn").fill("Z");
  await page.keyboard.press("Enter");
  // Assert（断らずに、表示中のファイルだけを書き換える）
  await expect(page.locator('#gNodes .node[data-key="Z"]')).toBeVisible();
  expect(await editorText(page)).toBe(A.replace("part def X;", "part def Z;"));
  await expect(page.locator("#dialog")).not.toContainText("b.sysml");
});

test("F-EDIT-2・F-FILE-15: ほかのファイルに同じ種類の定義があっても、パレットから表示中のファイルに定義を置ける", async ({ page }) => {
  // Arrange
  await openUnrelated(page);
  await page.locator('#palette [data-tool="part def"]').click();
  const box = (await page.locator("#wrap").boundingBox())!;
  // Act
  await page.mouse.click(box.x + 120, box.y + box.height - 120);
  // Assert（断らずに、表示中のファイルの package に置く）
  await expect(page.locator('#gNodes .node[data-key="NewPart"]')).toBeVisible();
  expect(await editorText(page)).toBe("package A {\n    part def X;\n    part def NewPart {\n    }\n}\n");
});
