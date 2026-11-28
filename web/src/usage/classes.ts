// 利用状況の報告（ADR-0026、F-TEL-1）に入れる値を、粗い区分にする純粋関数。
// 端末を見分ける手がかりにならないよう、細かい値（時間・大きさ・幅・版の番号）は送らず、契約（plugin-sdk の usage）の区分だけを送る。

import type {
  Browser, DurationClass, ErrorName, Language, Os, ParseDurationClass, ScreenClass, SizeClass, WeeksClass,
} from "../plugins/generated/protocol";

/**
 * 起動にかかった時間を区分にする。
 *
 * @param ms 時間（ミリ秒）
 * @returns 1 秒未満・1〜3 秒・3〜10 秒・10 秒以上の区分
 * @example
 * durationClass(999)   // → "lt1s"
 * durationClass(1000)  // → "1to3s"
 * durationClass(10000) // → "ge10s"
 */
export function durationClass(ms: number): DurationClass {
  if (ms < 1000) return "lt1s";
  if (ms < 3000) return "1to3s";
  return ms < 10000 ? "3to10s" : "ge10s";
}

/**
 * 解析にかかった時間を区分にする。
 *
 * @param ms 時間（ミリ秒）
 * @returns 100 ミリ秒未満・100〜300 ミリ秒・300 ミリ秒〜1 秒・1〜3 秒・3 秒以上の区分
 * @example
 * parseDurationClass(99)   // → "lt100ms"
 * parseDurationClass(300)  // → "300msTo1s"
 * parseDurationClass(3000) // → "ge3s"
 */
export function parseDurationClass(ms: number): ParseDurationClass {
  if (ms < 100) return "lt100ms";
  if (ms < 300) return "100to300ms";
  if (ms < 1000) return "300msTo1s";
  return ms < 3000 ? "1to3s" : "ge3s";
}

/**
 * テキストの大きさを区分にする。
 *
 * @param bytes 大きさ（バイト。文字数で代えてよい）
 * @returns 10 KB 未満・10〜100 KB・100 KB〜1 MB・1 MB 以上の区分
 * @example
 * sizeClass(0)         // → "lt10kb"
 * sizeClass(10_000)    // → "10to100kb"
 * sizeClass(1_000_000) // → "ge1mb"
 */
export function sizeClass(bytes: number): SizeClass {
  if (bytes < 10_000) return "lt10kb";
  if (bytes < 100_000) return "10to100kb";
  return bytes < 1_000_000 ? "100kbTo1mb" : "ge1mb";
}

/**
 * 画面の幅を区分にする。境目は契約（plugin-sdk の usage の ScreenClass）に合わせる（760 はアプリの狭い画面の境目）。
 *
 * @param width 画面（ウィンドウ）の幅（CSS ピクセル）
 * @returns スマホ（760 以下）・タブレット（760 より広く 1024 以下）・パソコン（1024 より広い）
 * @example
 * screenClass(760)  // → "phone"
 * screenClass(761)  // → "tablet"
 * screenClass(1024) // → "tablet"
 * screenClass(1025) // → "desktop"
 */
export function screenClass(width: number): ScreenClass {
  if (width <= 760) return "phone";
  return width <= 1024 ? "tablet" : "desktop";
}

/**
 * このブラウザで使った週の数を区分にする。
 *
 * @param weeks 使った週の数（1 以上）
 * @returns 1・2〜4・5〜12・13 以上の区分
 * @example
 * weeksClass(1)  // → "1"
 * weeksClass(4)  // → "2to4"
 * weeksClass(13) // → "ge13"
 */
export function weeksClass(weeks: number): WeeksClass {
  if (weeks <= 1) return "1";
  if (weeks <= 4) return "2to4";
  return weeks <= 12 ? "5to12" : "ge13";
}

/**
 * ブラウザの名乗り（User-Agent）から、ブラウザの種類を決める。版の番号は見ない。
 *
 * @param ua User-Agent の文字列
 * @returns ブラウザの種類。見分けられなければ "other"
 * @example
 * browserOf("Mozilla/5.0 … Chrome/130.0 Safari/537.36")          // → "chrome"
 * browserOf("Mozilla/5.0 … Chrome/130.0 Safari/537.36 Edg/130.0") // → "edge"
 * browserOf("Mozilla/5.0 … Version/18.0 Safari/605.1.15")        // → "safari"
 * browserOf("")                                                  // → "other"
 */
export function browserOf(ua: string): Browser {
  if (/\bEdg(e|A|iOS)?\//.test(ua)) return "edge";
  if (/\b(Firefox|FxiOS)\//.test(ua)) return "firefox";
  if (/\b(Chrome|Chromium|CriOS)\//.test(ua)) return "chrome";
  return /\bSafari\//.test(ua) ? "safari" : "other";
}

/**
 * ブラウザの名乗り（User-Agent）から、OS の種類を決める。版の番号は見ない。
 *
 * @param ua User-Agent の文字列
 * @returns OS の種類。見分けられなければ "other"
 * @example
 * osOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) …")        // → "windows"
 * osOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) …") // → "ios"
 * osOf("Mozilla/5.0 (Linux; Android 15; Pixel 9) …")         // → "android"
 * osOf("")                                                   // → "other"
 */
export function osOf(ua: string): Os {
  if (/Android/.test(ua)) return "android";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Windows/.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macos";
  return /Linux|CrOS/.test(ua) ? "linux" : "other";
}

/**
 * 画面の表示の言語を、契約の区分にする。
 *
 * @param tag 言語のタグ（BCP 47。例: "ja"・"en-US"）
 * @returns 言語の部分が ja・en ならそれ、ほかは "other"
 * @example
 * languageOf("ja")    // → "ja"
 * languageOf("en-US") // → "en"
 * languageOf("fr")    // → "other"
 */
export function languageOf(tag: string): Language {
  const lang = tag.toLowerCase().split("-")[0];
  return lang === "ja" || lang === "en" ? lang : "other";
}

/**
 * 日付の四半期（UTC）。初めて使った時期を、月より粗く送るのに使う。
 *
 * @param date 日付
 * @returns `YYYY-Qn` の形
 * @example
 * quarterOf(new Date("2026-11-28T00:00:00Z")) // → "2026-Q4"
 * quarterOf(new Date("2027-01-01T00:00:00Z")) // → "2027-Q1"
 */
export function quarterOf(date: Date): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/**
 * 日付の日（UTC）。受け口が日ごとに足し込むのに合わせ、UTC で区切る。
 *
 * @param date 日付
 * @returns `YYYY-MM-DD` の形
 * @example
 * dayOf(new Date("2026-11-28T23:59:59Z")) // → "2026-11-28"
 */
export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 日付の週の番号（UTC。1970-01-05 の月曜から数えた週）。使った週の数を数えるのに使う。
 *
 * @param date 日付
 * @returns 週の番号（月曜に変わる）
 * @example
 * weekOf(new Date("2026-11-29T23:59:59Z")) // → 2969（日曜まで同じ週）
 * weekOf(new Date("2026-11-30T00:00:00Z")) // → 2970（月曜から次の週）
 */
export function weekOf(date: Date): number {
  // 1970-01-01 は木曜なので、月曜始まりにするために 3 日ずらす
  return Math.floor((Math.floor(date.getTime() / 86_400_000) + 3) / 7);
}

const ERROR_NAMES: Readonly<Record<string, ErrorName>> = {
  Error: "error",
  TypeError: "typeError",
  RangeError: "rangeError",
  ReferenceError: "referenceError",
  SyntaxError: "syntaxError",
  NotAllowedError: "notAllowedError",
  QuotaExceededError: "quotaExceededError",
  AbortError: "abortError",
  SecurityError: "securityError",
  NotFoundError: "notFoundError",
};

/**
 * 例外の種類を、契約の区分にする。例外の文（message）は送らないので見ない。
 *
 * @param e 受け取った例外（Error でないものも来る）
 * @returns 例外の名前の区分。DOMException の知らない名前は "otherDomException"、ほかは "other"
 * @example
 * errorNameOf(new TypeError("x"))                    // → "typeError"
 * errorNameOf(new DOMException("x", "NotFoundError")) // → "notFoundError"
 * errorNameOf(new DOMException("x", "DataError"))    // → "otherDomException"
 * errorNameOf("boom")                                // → "other"
 */
export function errorNameOf(e: unknown): ErrorName {
  if (!(e instanceof Error)) return "other";
  const known = ERROR_NAMES[e.name];
  if (known) return known;
  return typeof DOMException !== "undefined" && e instanceof DOMException ? "otherDomException" : "other";
}
