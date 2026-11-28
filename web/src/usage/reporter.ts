// 利用状況の送信の段取り（ADR-0026、F-TEL-1）。送る段階の設定、最初の知らせ、回数の足し込み、日に 1 回のまとめ、エラーの報告をまとめる。
// 保存領域・送信・時計・環境は外から渡す（ここはブラウザに直接触れない）。
// 最初の知らせを見せるまでは、何も数えず、何も送らない。

import type { ErrorKind, OnboardingStep, UsageReport } from "../plugins/generated/protocol";
import { dailyReport, errorReport, startupReport, type Environment, type SenderInfo } from "./report";
import { addCheck, addOnboarding, addParseTime, bump, readState, rollover, type Counter, type UsageState } from "./state";

/** 送る段階（すべて送る・エラーだけ・送らない）。 */
export type UsageLevel = "all" | "errorsOnly" | "off";

/** 送る段階を残すキー。 */
export const LEVEL_KEY = "modelith-usage-level";
/** 最初の知らせを見せたら "1" を残すキー。 */
export const NOTICE_KEY = "modelith-usage-notice";
/** まだ送っていない集計を残すキー。 */
export const STATE_KEY = "modelith-usage-state";

/** ブラウザの保存領域のうち、使うものだけ。 */
export interface UsageStore {
  /** キーの値を読む（無ければ null）。 */
  get(key: string): string | null;
  /** キーに値を書く。 */
  set(key: string, value: string): unknown;
}

/** 送信の段取りが使うもの（外から渡す）。 */
export interface ReporterDeps {
  store: UsageStore;
  /** 報告を 1 つ送る（結果は待たない。失敗しても画面には出さない）。 */
  send: (report: UsageReport) => void;
  /** 今の時刻。 */
  now: () => Date;
  /** 今の環境。 */
  env: () => Environment;
  /** 送り手（版と系列）。 */
  sender: SenderInfo;
  /** アプリを配信している URL（末尾は `/`）。 */
  base: string;
}

/**
 * 保存した文字列を、送る段階にする。
 *
 * @param raw 保存した文字列（無ければ null）
 * @returns 送る段階。無い・知らない値なら既定の "all"
 * @example
 * levelOf("errorsOnly") // → "errorsOnly"
 * levelOf(null)         // → "all"
 * levelOf("x")          // → "all"
 */
export function levelOf(raw: string | null): UsageLevel {
  return raw === "errorsOnly" || raw === "off" ? raw : "all";
}

/** 利用状況の送信の段取り。 */
export class UsageReporter {
  private state: UsageState | null = null;

  /**
   * 送信の段取りを作る（作っただけでは何も読まず、何も送らない）。
   *
   * @param deps 保存領域・送信・時計・環境・送り手・配信している URL
   */
  constructor(private readonly deps: ReporterDeps) {}

  /**
   * 今の送る段階。
   *
   * @returns 送る段階（設定していなければ "all"）
   * @example
   * reporter.level() // → "all"
   */
  level(): UsageLevel {
    return levelOf(this.deps.store.get(LEVEL_KEY));
  }

  /**
   * 送る段階を変える。「すべて送る」でなくしたら、まだ送っていない集計を捨てる。
   *
   * @param level 新しい段階
   * @example
   * reporter.setLevel("off") // → 以後は何も数えず、何も送らない。足し込んでいた回数も消える
   */
  setLevel(level: UsageLevel): void {
    this.deps.store.set(LEVEL_KEY, level);
    if (level !== "all") {
      this.state = null;
      this.deps.store.set(STATE_KEY, "");
    }
  }

  /**
   * 最初の知らせを、まだ見せていないか。
   *
   * @returns まだ見せていなければ true
   * @example
   * reporter.noticeNeeded() // → true（初めて使うとき）
   */
  noticeNeeded(): boolean {
    return this.deps.store.get(NOTICE_KEY) !== "1";
  }

  /**
   * 最初の知らせを見せたことを残す（以後、数え始め、送り始める）。
   *
   * @example
   * reporter.noticeShown() // → reporter.noticeNeeded() が false になる
   */
  noticeShown(): void {
    this.deps.store.set(NOTICE_KEY, "1");
  }

  /**
   * 起動したことを報告する。前の日の集計が残っていれば、先に日に 1 回のまとめとして送る。
   * 「すべて送る」で、最初の知らせを見せた後でなければ何もしない。
   *
   * @param ms 起動にかかった時間（ミリ秒）
   * @example
   * reporter.started(850) // → 起動の報告を送る（前の日の集計があれば、そのまとめも送る）
   */
  started(ms: number): void {
    if (!this.counting()) return;
    this.current();
    this.deps.send(startupReport(ms, this.deps.sender));
  }

  /**
   * 回数を 1 つ足す。
   *
   * @param counter 足す先（`edits.rename`・`exports.svg`・`pluginUses` など）
   * @example
   * reporter.count("edits.rename") // → 今日の名前の変更の回数が 1 増える
   */
  count(counter: Counter): void {
    this.change((s) => bump(s.counts, counter));
  }

  /**
   * チェックの実行を足す。
   *
   * @param problems 見つかった問題の数
   * @example
   * reporter.check(3) // → チェックの回数と「1〜9 件」の回数が 1 増える
   */
  check(problems: number): void {
    this.change((s) => addCheck(s.counts, problems));
  }

  /**
   * 解析にかかった時間を足す。
   *
   * @param size テキストの大きさ（文字数）
   * @param ms かかった時間（ミリ秒）
   * @example
   * reporter.parseTime(1200, 35) // → 「10 KB 未満・100 ミリ秒未満」の回数が 1 増える
   */
  parseTime(size: number, ms: number): void {
    this.change((s) => addParseTime(s.counts, size, ms));
  }

  /**
   * 使い始めの段階を残す（その日に初めて起きたときだけ）。
   *
   * @param step 起きた段階
   * @example
   * reporter.step("saved") // → 今日の段階に "saved" が入る
   */
  step(step: OnboardingStep): void {
    this.change((s) => addOnboarding(s, step));
  }

  /**
   * エラーをすぐに報告する（「すべて送る」と「エラーだけ」のとき。最初の知らせを見せる前は送らない）。
   *
   * @param error 受け取った例外
   * @param kind エラーの種類
   * @example
   * reporter.error(new TypeError("x"), "uncaughtError") // → エラーの報告を送る（エラーの文は送らない）
   */
  error(error: unknown, kind: ErrorKind): void {
    const level = this.level();
    if (level === "off" || this.noticeNeeded()) return;
    this.deps.send(errorReport(error, kind, level, this.deps.base, this.deps.sender));
  }

  /**
   * いま送るとしたら何を送るかを返す（設定の画面で、送る中身を見せるため）。何も送らない。
   *
   * @returns 「すべて送る」なら、今日の集計から作った日に 1 回のまとめ。ほかの段階なら null（エラーが起きたときだけ送る・何も送らない）
   * @example
   * reporter.preview() // → { kind: "daily", edits: { rename: 2, … }, … }
   */
  preview(): UsageReport | null {
    if (this.level() !== "all") return null;
    const state = this.state ?? readState(this.deps.store.get(STATE_KEY), this.deps.now());
    return dailyReport(state, this.deps.env(), this.deps.sender);
  }

  /**
   * 数えて送ってよい状態か（「すべて送る」で、最初の知らせを見せた後）。
   *
   * @returns 数えてよければ true
   * @example
   * this.counting() // → false（最初の知らせの前、または「エラーだけ」「送らない」）
   */
  private counting(): boolean {
    return this.level() === "all" && !this.noticeNeeded();
  }

  /**
   * 今日の集計を返す。保存した集計を読み、日付が変わっていれば、前の日のまとめを送って今日の集計を始める。
   *
   * @returns 今日の集計
   * @example
   * this.current() // → { day: 今日, counts: …, … }（昨日の集計が残っていれば、そのまとめを送る）
   */
  private current(): UsageState {
    const now = this.deps.now();
    const loaded = this.state ?? readState(this.deps.store.get(STATE_KEY), now);
    const { state, due } = rollover(loaded, now);
    if (due) this.deps.send(dailyReport(due, this.deps.env(), this.deps.sender));
    if (due || !this.state) this.deps.store.set(STATE_KEY, JSON.stringify(state));
    this.state = state;
    return state;
  }

  /**
   * 今日の集計を書き換えて、保存する。数えてよい状態でなければ何もしない。
   *
   * @param fn 集計を書き換える関数
   * @example
   * this.change((s) => bump(s.counts, "pluginUses")) // → 今日の集計を変えて保存する
   */
  private change(fn: (state: UsageState) => void): void {
    if (!this.counting()) return;
    const state = this.current();
    fn(state);
    this.deps.store.set(STATE_KEY, JSON.stringify(state));
  }
}
