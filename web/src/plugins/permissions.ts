// v1 のプラグインの権限（ADR-0018 §3・§5）の画面の言葉と、隔離用のページの選び方。入出力を持たない。

import { t } from "../l10n";
import type { Permission } from "./generated/protocol";

/** 権限の画面の言葉（画面の言葉の手引き：一般的なソフトウェアの言葉で、何ができるかを書く）。 */
export const PERMISSION_WORDS: Record<Permission, string> = {
  "model:read": t("plugins-permission-model-read"),
  "edits:propose": t("plugins-permission-edits-propose"),
  network: t("plugins-permission-network"),
  storage: t("plugins-permission-storage"),
};

/** 外部と通信できるプラグインについての注意（ADR-0018 §5。C-2 の例外を、利用者が選んだときだけにする）。 */
export const NETWORK_WARNING = t("plugins-network-warning");

/** 外部と通信できない隔離用のページ（web/public。CSP の connect-src は 'none'）。 */
export const SANDBOX_PAGE = "plugin-sandbox.html";
/** `network` を宣言したプラグインの隔離用のページ（CSP の connect-src だけが違う）。 */
export const NETWORK_SANDBOX_PAGE = "plugin-sandbox-network.html";
/** 外部と通信できない隔離用のページの CSP（ADR-0018 §3.1）。ページの meta と同じでなければならない（テストで確かめる）。 */
export const SANDBOX_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'";
/** `network` を宣言したプラグインの隔離用のページの CSP。通信（fetch・XMLHttpRequest・WebSocket）だけを許し、外のスクリプトや画像は読めないまま。 */
export const NETWORK_SANDBOX_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src http: https: ws: wss:";

/**
 * 宣言した権限から、プラグインを読み込む隔離用のページを選ぶ。
 *
 * @param permissions マニフェストで宣言した権限
 * @returns `network` を宣言していれば plugin-sandbox-network.html、そうでなければ plugin-sandbox.html
 * @example
 * sandboxPage(["model:read"])            // → "plugin-sandbox.html"
 * sandboxPage(["network", "model:read"]) // → "plugin-sandbox-network.html"
 * sandboxPage([])                        // → "plugin-sandbox.html"（境界値）
 */
export function sandboxPage(permissions: readonly Permission[]): string {
  return permissions.includes("network") ? NETWORK_SANDBOX_PAGE : SANDBOX_PAGE;
}

/**
 * 宣言した権限を、画面に出す言葉の並びにする（マニフェストに書く名前を括弧で添える）。
 *
 * @param permissions マニフェストで宣言した権限
 * @returns 言葉の並び（宣言の順）。権限が無ければ「追加の権限はありません」の 1 行
 * @example
 * permissionLines(["network"]) // → ["インターネットなど外部と通信する（network）"]
 * permissionLines([])          // → ["追加の権限はありません"]
 */
export function permissionLines(permissions: readonly Permission[]): string[] {
  return permissions.length ? permissions.map((p) => t("plugins-permission-line", { words: PERMISSION_WORDS[p], permission: p })) : [t("plugins-permission-none")];
}
