// 利用状況の報告（ADR-0026 の 5、F-TEL-1）を、契約（plugin-sdk の usage）の形に組み立てる純粋関数。
// モデルの中身・名前・ファイル名・エラーの文は入れない。スタックトレースは、配信しているアプリのファイルの段だけにする。

import {
  USAGE_SCHEMA_VERSION, type Channel, type DailyReport, type ErrorKind, type ErrorReport, type SendLevel, type StackFrame, type StartupReport,
} from "../plugins/generated/protocol";
import { browserOf, durationClass, errorNameOf, languageOf, osOf, screenClass, weeksClass } from "./classes";
import type { UsageState } from "./state";

/** 送り手（版と系列）。どの報告にも付ける。 */
export interface SenderInfo {
  /** アプリの版（SemVer）。 */
  appVersion: string;
  /** 系列（安定版・候補版・プレビュー版）。 */
  channel: Channel;
}

/** 環境（日に 1 回のまとめで送る）。 */
export type Environment = Pick<DailyReport, "browser" | "os" | "screen" | "language" | "folderAccess">;

/** スタックトレースに入れる段の数の上限。 */
const MAX_FRAMES = 30;

/**
 * 環境を、契約の区分にする。
 *
 * @param ua ブラウザの名乗り（User-Agent）
 * @param width 画面（ウィンドウ）の幅
 * @param language 画面の表示の言語（BCP 47）
 * @param folderAccess 手元のフォルダを開けるブラウザか
 * @returns ブラウザと OS の種類・画面の幅の区分・言語・フォルダを開けるか
 * @example
 * environment("Mozilla/5.0 (Windows NT 10.0) … Chrome/130.0 Safari/537.36", 1280, "ja", true)
 * // → { browser: "chrome", os: "windows", screen: "desktop", language: "ja", folderAccess: true }
 */
export function environment(ua: string, width: number, language: string, folderAccess: boolean): Environment {
  return { browser: browserOf(ua), os: osOf(ua), screen: screenClass(width), language: languageOf(language), folderAccess };
}

/**
 * 起動の報告を作る。
 *
 * @param ms 起動にかかった時間（ミリ秒）
 * @param sender 送り手（版と系列）
 * @returns 起動の報告（版・系列・起動の時間の区分）
 * @example
 * startupReport(850, { appVersion: "0.3.0", channel: "stable" })
 * // → { kind: "startup", schemaVersion: 1, startupTime: "lt1s", client: "web", appVersion: "0.3.0", channel: "stable" }
 */
export function startupReport(ms: number, sender: SenderInfo): StartupReport & { kind: "startup" } {
  return { kind: "startup", schemaVersion: USAGE_SCHEMA_VERSION, startupTime: durationClass(ms), client: "web", ...sender };
}

/**
 * 日に 1 回のまとめを作る。
 *
 * @param state 送る日の集計
 * @param env 環境
 * @param sender 送り手（版と系列）
 * @returns 日に 1 回のまとめ（環境・その日の段階・回数・使った週の数の区分・初めて使った四半期）
 * @example
 * dailyReport(state, env, { appVersion: "0.3.0", channel: "stable" })
 * // → { kind: "daily", schemaVersion: 1, browser: "chrome", …, edits: { rename: 2, … }, weeksUsed: "1", firstQuarter: "2026-Q4", client: "web", … }
 */
export function dailyReport(state: UsageState, env: Environment, sender: SenderInfo): DailyReport & { kind: "daily" } {
  return {
    kind: "daily",
    schemaVersion: USAGE_SCHEMA_VERSION,
    ...env,
    onboarding: state.onboarding,
    ...state.counts,
    weeksUsed: weeksClass(state.weeks),
    firstQuarter: state.firstQuarter,
    client: "web",
    ...sender,
  };
}

/**
 * エラーの報告を作る。エラーの文（message）は送らない。
 *
 * @param error 受け取った例外
 * @param kind エラーの種類（捕まえられなかった例外・Promise の拒否・wasm の panic）
 * @param level 送る段階
 * @param base アプリを配信している URL（末尾は `/`。この下の `assets/` の段だけを残す）
 * @param sender 送り手（版と系列）
 * @returns エラーの報告（例外の名前の区分と、配信しているファイルの段）
 * @example
 * errorReport(new TypeError("x"), "uncaughtError", "all", "https://example.org/app/", sender)
 * // → { kind: "error", schemaVersion: 1, level: "all", errorKind: "uncaughtError", errorName: "typeError", frames: […], client: "web", … }
 */
export function errorReport(error: unknown, kind: ErrorKind, level: SendLevel, base: string, sender: SenderInfo): ErrorReport & { kind: "error" } {
  const stack = error instanceof Error && typeof error.stack === "string" ? error.stack : "";
  return {
    kind: "error",
    schemaVersion: USAGE_SCHEMA_VERSION,
    level,
    errorKind: kind,
    errorName: kind === "wasmPanic" ? "panic" : errorNameOf(error),
    frames: stackFrames(stack, base),
    client: "web",
    ...sender,
  };
}

/**
 * スタックトレースの文字列から、配信しているアプリのファイル（`assets/` の JS と wasm）の段だけを取り出す。
 * プラグインやブラウザの拡張など、ほかのコードの段と、利用者の文字が入りうる部分（エラーの文・関数に渡した値）は捨てる。
 * 関数の名前は、wasm の中のコアの関数（`modelith_core::…` の形）だけを残す（縮めた JS の関数名は送らない）。
 *
 * @param stack スタックトレース（Chrome の `at fn (URL:行:列)` と、Firefox・Safari の `fn@URL:行:列` の形）
 * @param base アプリを配信している URL（末尾は `/`）
 * @returns 段の並び（内側から外側へ。30 段まで）。取り出せる段が無ければ空
 * @example
 * stackFrames("TypeError: secret\n    at f (https://example.org/app/assets/index-3f2a.js:10:20)\n    at chrome-extension://x/y.js:1:1", "https://example.org/app/")
 * // → [{ module: "assets/index-3f2a.js", line: 10, column: 20 }]
 * stackFrames("", "https://example.org/app/") // → []
 */
export function stackFrames(stack: string, base: string): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const line of stack.split("\n")) {
    const at = line.indexOf(`${base}assets/`);
    if (at < 0) continue;
    // URL の後ろは「:行:列」か、wasm の「:wasm-function[番号]:0x位置」
    const m = /^(assets\/[A-Za-z0-9._-]+\.(?:js|wasm))(?::(\d+):(\d+))?/.exec(line.slice(at + base.length));
    if (!m?.[1]) continue;
    const fn = /(?:^|\s|\.)((?:modelith_[a-z_]+)(?:::[A-Za-z0-9_<>]+)+)/.exec(line.slice(0, at))?.[1];
    frames.push({
      module: m[1],
      ...(fn ? { function: fn } : {}),
      ...(m[2] && m[3] ? { line: Number(m[2]), column: Number(m[3]) } : {}),
    });
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames;
}
