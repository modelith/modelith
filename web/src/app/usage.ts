// 利用状況の送信（ADR-0026、F-TEL-1）を画面につなぐ。最初の知らせ、「ヘルプ」の設定、送る中身の表示、エラーの受け口。
// 受け口の URL（__USAGE_ENDPOINT__）が埋め込まれていないビルド（手元のビルドなど）では、何も送らず、知らせも設定も出さない。
// ほかの画面の部品は、usage() で回数を足す（送信が無いビルドでは何もしない）。

import { hasFsAccess } from "../files/local-folder";
import { t } from "../l10n";
import type { Channel, ErrorKind, OnboardingStep } from "../plugins/generated/protocol";
import { environment } from "../usage/report";
import { UsageReporter, type UsageLevel } from "../usage/reporter";
import type { Counter } from "../usage/state";
import { flatten, postReport } from "../usage/transport";
import { ask } from "./dialog";
import { $, store } from "./dom";
import { toast } from "./sync";

/** 画面の部品が使う、回数を足す口（UsageReporter のうち、数える操作だけ）。 */
export interface UsageCounter {
  count(counter: Counter): void;
  check(problems: number): void;
  parseTime(size: number, ms: number): void;
  step(step: OnboardingStep): void;
  error(error: unknown, kind: ErrorKind): void;
}

/** 送信が無いビルドで使う、何もしない口。 */
const SILENT: UsageCounter = { count() {}, check() {}, parseTime() {}, step() {}, error() {} };

let reporter: UsageReporter | null = null;

/**
 * 回数を足す口を返す。送信が無いビルド・まだ初期化していないときは、何もしない口を返す。
 *
 * @returns 回数を足す口
 * @example
 * usage().count("edits.rename") // → 今日の名前の変更の回数が 1 増える（「すべて送る」で、最初の知らせの後のとき）
 */
export function usage(): UsageCounter {
  return reporter ?? SILENT;
}

/**
 * ビルドに埋め込まれた系列の名前を、契約の系列にする。
 *
 * @param channel 系列の名前（`__APP_CHANNEL__`）
 * @returns rc・preview はそのまま、ほかは stable
 * @example
 * channelOf("preview") // → "preview"
 * channelOf("")        // → "stable"
 */
export function channelOf(channel: string): Channel {
  return channel === "rc" || channel === "preview" ? channel : "stable";
}

/**
 * 利用状況の送信を始める。最初の知らせをまだ見せていなければ見せ、起動を報告し、「ヘルプ」の設定とエラーの受け口をつなぐ。
 * 受け口の URL が埋め込まれていないビルドでは、設定の項目を隠したまま何もしない。
 *
 * @param startupMs 起動にかかった時間（ミリ秒）
 * @param endpoint 受け口の URL（既定はビルドに埋め込んだもの。空なら送らない）
 * @returns 最初の知らせを閉じ、起動を報告し終えたら解決する Promise
 * @example
 * await initUsage(performance.now()) // → 初めてなら知らせを出し、閉じた後に起動を報告する
 */
export async function initUsage(startupMs: number, endpoint: string = __USAGE_ENDPOINT__): Promise<void> {
  if (!endpoint) return;
  reporter = new UsageReporter({
    store,
    send: (report) => postReport(endpoint, report, (url, init) => fetch(url, init)),
    now: () => new Date(),
    env: () => environment(navigator.userAgent, window.innerWidth, document.documentElement.lang, hasFsAccess(window)),
    sender: { appVersion: __APP_VERSION__, channel: channelOf(__APP_CHANNEL__) },
    base: new URL(import.meta.env.BASE_URL, location.href).href,
  });
  const r = reporter;
  window.addEventListener("error", (ev) => r.error(ev.error ?? ev.message, "uncaughtError"));
  window.addEventListener("unhandledrejection", (ev) => r.error(ev.reason, "unhandledRejection"));
  const button = $<HTMLButtonElement>("#btnUsage");
  button.hidden = false;
  button.onclick = () => {
    $<HTMLDetailsElement>("#helpMenu").open = false;
    void openSettings(r);
  };
  if (r.noticeNeeded()) await showNotice(r);
  r.started(startupMs);
}

/**
 * 最初の知らせを出す（ADR-0026 の 1）。どう閉じても、見せたことを残す。「設定を変える」を選んだら、続けて設定を開く。
 *
 * @param r 送信の段取り
 * @returns 知らせ（と、続けて開いた設定）を閉じたら解決する Promise
 * @example
 * await showNotice(reporter) // → 「利用状況の送信について」を出し、閉じると reporter.noticeNeeded() が false になる
 */
async function showNotice(r: UsageReporter): Promise<void> {
  const answer = await ask(t("app-usage-notice-title"), t("app-usage-notice-text"), [
    { id: "settings", label: t("app-usage-notice-settings") },
    { id: "ok", label: t("app-usage-notice-ok"), kind: "primary" },
  ]);
  // 設定を選び終えるまでは、見せたことを残さない（残した時点から数え始めるため）
  if (answer?.id === "settings") await openSettings(r);
  r.noticeShown();
}

/**
 * 送る範囲の設定を開く。選んで「決定」を押せば設定を変えて知らせ、「送る中身を見る」を押せば中身を見せてから設定に戻る。
 *
 * @param r 送信の段取り
 * @returns 設定を閉じたら解決する Promise
 * @example
 * await openSettings(reporter) // → 「送らない」を選んで「決定」を押すと、reporter.level() が "off" になる
 */
async function openSettings(r: UsageReporter): Promise<void> {
  for (;;) {
    const answer = await ask(t("app-usage-settings-title"), t("app-usage-settings-text"), [
      { id: "preview", label: t("app-usage-settings-preview") },
      { id: "cancel", label: t("app-files-button-cancel") },
      { id: "ok", label: t("app-usage-settings-save"), kind: "primary" },
    ], undefined, undefined, {
      label: t("app-usage-settings-label"),
      value: r.level(),
      options: [
        { id: "all", label: t("app-usage-level-all"), note: t("app-usage-level-all-note") },
        { id: "errorsOnly", label: t("app-usage-level-errors"), note: t("app-usage-level-errors-note") },
        { id: "off", label: t("app-usage-level-off"), note: t("app-usage-level-off-note") },
      ],
    });
    if (answer?.id === "preview") {
      await showPreview(r);
      continue;
    }
    if (answer?.id === "ok") {
      const level = answer.option as UsageLevel;
      r.setLevel(level);
      toast(level === "all" ? t("app-usage-saved-all") : level === "errorsOnly" ? t("app-usage-saved-errors") : t("app-usage-saved-off"));
    }
    return;
  }
}

/**
 * いまの設定で送る中身を見せる（ADR-0026 の 1「確かめ方」）。何も送らない。
 *
 * @param r 送信の段取り
 * @returns 閉じたら解決する Promise
 * @example
 * await showPreview(reporter) // → 「すべて送る」なら、次に送るまとめの項目と値を並べて見せる
 */
async function showPreview(r: UsageReporter): Promise<void> {
  const report = r.preview();
  const close = [{ id: "close", label: t("app-usage-preview-close"), kind: "primary" as const }];
  if (!report) {
    await ask(t("app-usage-preview-title"), r.level() === "off" ? t("app-usage-preview-none-off") : t("app-usage-preview-none-errors"), close);
    return;
  }
  const items = flatten(report, t("app-usage-preview-empty")).map(([name, value]) => t("app-usage-preview-item", { name, value }));
  await ask(t("app-usage-preview-title"), t("app-usage-preview-text"), close, undefined, { items });
}
