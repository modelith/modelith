// 利用状況の報告を受け口へ送る（ADR-0026 の 3）。Cookie などの認証情報と、どのページから送ったか（Referer）は付けない。

import type { UsageReport } from "../plugins/generated/protocol";

/** fetch のうち、使う形だけ。 */
export type Fetch = (url: string, init: RequestInit) => Promise<unknown>;

/**
 * 報告を 1 つ、受け口へ POST する。結果は待たず、失敗しても何もしない（利用状況が届かなくても、アプリの動きは変えない）。
 *
 * @param endpoint 受け口の URL
 * @param report 送る報告
 * @param fetchFn 送るのに使う fetch
 * @example
 * postReport("https://telemetry.example/v1/events", { kind: "startup", … }, fetch)
 * // → 報告の JSON を POST する（認証情報なし・Referer なし・ページを離れても送り切る）
 */
export function postReport(endpoint: string, report: UsageReport, fetchFn: Fetch): void {
  try {
    void fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fetch が使えない環境でも、アプリは止めない
  }
}

/**
 * 報告の中身を、「項目：値」の行に並べる（設定の画面で、送る中身を見せるため）。入れ子は「.」でつなぐ。
 *
 * @param value 報告（またはその一部）
 * @param empty 中身の無い配列・まとまりの値として出す文字
 * @param prefix 項目の名前の前に付ける名前（入れ子の外側）
 * @returns 項目の名前と値（文字にしたもの）の並び。配列は要素ごとに番号を付ける
 * @example
 * flatten({ kind: "daily", edits: { rename: 2 }, onboarding: ["saved"] }, "-")
 * // → [["kind", "daily"], ["edits.rename", "2"], ["onboarding.0", "saved"]]
 * flatten({ onboarding: [] }, "-") // → [["onboarding", "-"]]
 */
export function flatten(value: unknown, empty: string, prefix = ""): [string, string][] {
  if (typeof value !== "object" || value === null) return [[prefix, String(value)]];
  const entries = Object.entries(value);
  if (!entries.length) return [[prefix, empty]];
  return entries.flatMap(([key, v]) => flatten(v, empty, prefix ? `${prefix}.${key}` : key));
}
