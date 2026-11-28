// 利用状況の送信（F-TEL-1、ADR-0026）。受け口は同じ配信元のパス（/__usage）にしてビルドしてあり、送った中身は横取りして確かめる（外へは送らない）。
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

test.use({ usageNotice: true });

/** 受け口への送信を横取りして、送った報告を集める。 */
async function collect(page: Page): Promise<Record<string, unknown>[]> {
  const sent: Record<string, unknown>[] = [];
  await page.route("**/__usage", async (route) => {
    sent.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 204 });
  });
  return sent;
}

/** 起動して、最初の知らせが出るまで待つ。 */
async function openWithNotice(page: Page): Promise<void> {
  await page.goto("./");
  await expect(page.locator("#dialogTitle")).toHaveText("利用状況の送信について");
}

test("F-TEL-1: 初めて使うときに一度だけ知らせ、閉じるまでは何も送らず、閉じると起動を報告する", async ({ page }) => {
  // Arrange
  const sent = await collect(page);
  // Act
  await openWithNotice(page);
  // Assert（知らせの間は何も送らない）
  await expect(page.locator("#dialogText")).toContainText("モデルの中身・要素の名前・ファイル名は送りません");
  expect(sent).toEqual([]);
  // Act
  await page.locator('#dialogButtons [data-id="ok"]').click();
  // Assert（版・系列・起動の時間の区分だけ）
  await expect.poll(() => sent.length).toBe(1);
  expect(Object.keys(sent[0] ?? {}).sort()).toEqual(["appVersion", "channel", "client", "kind", "schemaVersion", "startupTime"]);
  expect(sent[0]).toMatchObject({ kind: "startup", client: "web", schemaVersion: 1 });
  // Act（読み込み直しても、知らせは出ない）
  await page.reload();
  await page.locator("#gNodes .node").first().waitFor();
  // Assert
  await expect(page.locator("#dialog")).toBeHidden();
});

test("F-TEL-1: 知らせから設定を開いて「送らない」を選ぶと、何も送らない", async ({ page }) => {
  // Arrange
  const sent = await collect(page);
  await openWithNotice(page);
  // Act
  await page.locator('#dialogButtons [data-id="settings"]').click();
  await page.locator('#dialogPick input[value="off"]').check();
  await page.locator('#dialogButtons [data-id="ok"]').click();
  // Assert
  await expect(page.locator("#toast")).toHaveText("利用状況もエラーの情報も送らない設定にしました");
  await page.reload();
  await page.locator("#gNodes .node").first().waitFor();
  await page.evaluate(() => Promise.reject(new Error("boom")).catch(() => {}));
  expect(sent).toEqual([]);
});

test("F-TEL-1: 「ヘルプ」の設定で送る中身を確かめられ、数えた回数が入っている。モデルの名前は入らない", async ({ page }) => {
  // Arrange（知らせを閉じ、サンプルを 1 つ開く）
  const sent = await collect(page);
  await openWithNotice(page);
  await page.locator('#dialogButtons [data-id="ok"]').click();
  await page.locator("#fileMenu > summary").click();
  await page.locator("#btnSample").click();
  await page.locator('#dialogButtons [data-id="ok"]').click();
  await expect(page.locator("#docName")).toHaveText("intro-requirements.sysml");
  // Act
  await page.locator("#helpMenu > summary").click();
  await page.locator("#btnUsage").click();
  await expect(page.locator('#dialogPick input[value="all"]')).toBeChecked();
  await page.locator('#dialogButtons [data-id="preview"]').click();
  // Assert
  const detail = page.locator("#dialogDetail");
  await expect(detail).toContainText("kind：daily");
  await expect(detail).toContainText("onboarding.0：sampleOpened");
  await expect(detail).toContainText("edits.rename：0");
  await expect(detail).not.toContainText("BikeLight");
  await expect(detail).not.toContainText("intro-requirements");
  // Act（閉じると設定に戻る。「エラーだけ」にすると、まとめは送らないことを示す）
  await page.locator('#dialogButtons [data-id="close"]').click();
  await page.locator('#dialogPick input[value="errorsOnly"]').check();
  await page.locator('#dialogButtons [data-id="ok"]').click();
  await expect(page.locator("#toast")).toHaveText("エラーの情報だけを送る設定にしました");
  // Assert（送ったのは起動の報告だけ）
  expect(sent.map((r) => r["kind"])).toEqual(["startup"]);
});

test("F-TEL-1: 日付が変わった後に起動すると、前の日の回数を 1 回まとめて送る", async ({ page }) => {
  // Arrange（知らせを見せた後で、昨日の集計が残っている）
  const sent = await collect(page);
  await page.addInitScript(() => {
    if (localStorage.getItem("modelith-usage-notice") !== null) return;
    localStorage.setItem("modelith-usage-notice", "1");
    localStorage.setItem("modelith-usage-state", JSON.stringify({
      day: "2026-01-01", counts: { edits: { rename: 3 }, exports: { svg: 1 } }, onboarding: ["saved"], weeks: 2, lastWeek: 1, firstQuarter: "2025-Q4",
    }));
  });
  // Act
  await page.goto("./");
  await page.locator("#gNodes .node").first().waitFor();
  // Assert
  await expect.poll(() => sent.map((r) => r["kind"])).toEqual(["daily", "startup"]);
  expect(sent[0]).toMatchObject({ edits: { rename: 3, delete: 0 }, exports: { svg: 1 }, onboarding: ["saved"], weeksUsed: "2to4", firstQuarter: "2025-Q4" });
  expect(sent[0]).not.toHaveProperty("day");
});
