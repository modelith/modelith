// 利用状況の回数を、手元で日ごとに足し込む（ADR-0026 の 5、F-TEL-1）。足し込んだものを、日に 1 回まとめて送る。
// ここは集計だけを行う純粋関数で、保存（ブラウザの保存領域）と送信は reporter.ts が行う。
// 端末を見分ける ID は持たない。持つのは、回数・その日に初めて起きた段階・使った週の数・初めて使った四半期だけ。

import type {
  AutoViews, Checks, CreatedViews, DailyReport, Edits, Exports, Layout, OnboardingStep, ParseDurationClass, Saves, SizeClass,
} from "../plugins/generated/protocol";
import { dayOf, parseDurationClass, quarterOf, sizeClass, weekOf } from "./classes";

/** 1 日分の回数（日に 1 回のまとめのうち、足し込む部分）。 */
export type DayCounts = Pick<
  DailyReport,
  "autoViews" | "createdViews" | "edits" | "layout" | "saves" | "exports" | "checks" | "pluginUses" | "aiRewrites" | "parseTimes" | "wasmLoadFailures" | "workerRestarts"
>;

/** 回数を 1 つ足す先（まとまり.項目、またはまとまりを持たない項目）。 */
export type Counter =
  | `autoViews.${keyof AutoViews}`
  | `createdViews.${keyof CreatedViews}`
  | `edits.${keyof Edits}`
  | `layout.${keyof Layout}`
  | `saves.${keyof Saves}`
  | `exports.${keyof Exports}`
  | "pluginUses"
  | "aiRewrites"
  | "wasmLoadFailures"
  | "workerRestarts";

/** ブラウザに残す、利用状況の集計（まだ送っていない 1 日分と、続けて使っているかを測る数）。 */
export interface UsageState {
  /** 集計している日（UTC。`YYYY-MM-DD`）。 */
  day: string;
  counts: DayCounts;
  /** その日に起きた、使い始めの段階（同じ段階は 1 回だけ）。 */
  onboarding: OnboardingStep[];
  /** このブラウザで使った週の数。 */
  weeks: number;
  /** 最後に使った週の番号（`weekOf`）。週が変わったら weeks を 1 つ増やす。 */
  lastWeek: number;
  /** このブラウザで初めて使った四半期（`YYYY-Qn`）。 */
  firstQuarter: string;
}

/**
 * 回数がすべて 0 の、1 日分の集計を作る。
 *
 * @returns すべての項目が 0（解析の時間は空）の集計
 * @example
 * emptyCounts().edits.rename // → 0
 * emptyCounts().parseTimes   // → []
 */
export function emptyCounts(): DayCounts {
  return {
    autoViews: { trace: 0, structure: 0, control: 0, ibd: 0, behavior: 0, seq: 0, afv: 0, stm: 0, all: 0 },
    createdViews: { general: 0, interconnection: 0, actionFlow: 0, stateTransition: 0, sequence: 0, other: 0 },
    edits: {
      addNode: 0, addUsage: 0, rename: 0, delete: 0, deleteEdge: 0, connect: 0, addMessage: 0, updateMessage: 0, moveMessage: 0,
      setPhase: 0, initPhases: 0, makePort: 0, setPortDir: 0, deletePort: 0, saveView: 0, addToView: 0, removeFromView: 0,
      renameView: 0, deleteView: 0, setAttribute: 0, removeAttribute: 0, setDoc: 0, undo: 0, redo: 0,
    },
    layout: { move: 0, adjustEdge: 0, align: 0 },
    saves: { draft: 0, download: 0, folder: 0 },
    exports: { svg: 0, png: 0, jpeg: 0, drawio: 0, clipboard: 0 },
    checks: { runs: 0, noProblems: 0, problems1To9: 0, problems10To99: 0, problems100OrMore: 0 },
    pluginUses: 0,
    aiRewrites: 0,
    parseTimes: [],
    wasmLoadFailures: 0,
    workerRestarts: 0,
  };
}

/**
 * 初めて使ったときの集計を作る（今日の日付・回数 0・使った週は 1・初めて使った四半期は今）。
 *
 * @param now 今の時刻
 * @returns 新しい集計
 * @example
 * newState(new Date("2026-11-28T10:00:00Z"))
 * // → { day: "2026-11-28", counts: すべて 0, onboarding: [], weeks: 1, lastWeek: 2969, firstQuarter: "2026-Q4" }
 */
export function newState(now: Date): UsageState {
  return { day: dayOf(now), counts: emptyCounts(), onboarding: [], weeks: 1, lastWeek: weekOf(now), firstQuarter: quarterOf(now) };
}

/**
 * 回数を 1 つ足す（集計を書き換える）。契約に無い項目は足さない。
 *
 * @param counts 1 日分の集計
 * @param counter 足す先（`edits.rename`・`pluginUses` など）
 * @example
 * bump(counts, "edits.rename") // → counts.edits.rename が 1 増える
 * bump(counts, "pluginUses")   // → counts.pluginUses が 1 増える
 */
export function bump(counts: DayCounts, counter: Counter): void {
  const [group, item] = counter.split(".") as [keyof DayCounts, string | undefined];
  const all = counts as unknown as Record<string, number | Record<string, number>>;
  const target = all[group];
  if (item === undefined) {
    if (typeof target === "number") all[group] = target + 1;
    return;
  }
  if (typeof target !== "object") return;
  const value = target[item];
  if (typeof value === "number") target[item] = value + 1;
}

/**
 * チェックの実行を 1 回足し、見つかった問題の数の区分にも足す。
 *
 * @param counts 1 日分の集計
 * @param problems 見つかった問題の数
 * @example
 * addCheck(counts, 0)   // → runs と noProblems が 1 増える
 * addCheck(counts, 9)   // → runs と problems1To9 が 1 増える
 * addCheck(counts, 100) // → runs と problems100OrMore が 1 増える
 */
export function addCheck(counts: DayCounts, problems: number): void {
  const c: Checks = counts.checks;
  c.runs += 1;
  if (problems <= 0) c.noProblems += 1;
  else if (problems < 10) c.problems1To9 += 1;
  else if (problems < 100) c.problems10To99 += 1;
  else c.problems100OrMore += 1;
}

/**
 * 解析にかかった時間を、テキストの大きさの区分ごとに足す（同じ組があれば回数を足し、無ければ組を足す）。
 *
 * @param counts 1 日分の集計
 * @param size テキストの大きさ（文字数）
 * @param ms 解析にかかった時間（ミリ秒）
 * @example
 * addParseTime(counts, 500, 20) // → parseTimes に { fileSize: "lt10kb", duration: "lt100ms", count: 1 } が入る
 * addParseTime(counts, 600, 30) // → 同じ組の count が 2 になる
 */
export function addParseTime(counts: DayCounts, size: number, ms: number): void {
  const fileSize = sizeClass(size);
  const duration = parseDurationClass(ms);
  const found = counts.parseTimes.find((p) => p.fileSize === fileSize && p.duration === duration);
  if (found) found.count += 1;
  else counts.parseTimes.push({ fileSize, duration, count: 1 });
}

/**
 * 使い始めの段階を、その日に初めて起きたときだけ残す。
 *
 * @param state 集計
 * @param step 起きた段階
 * @example
 * addOnboarding(state, "saved") // → state.onboarding が ["saved"] になる。もう一度呼んでも増えない
 */
export function addOnboarding(state: UsageState, step: OnboardingStep): void {
  if (!state.onboarding.includes(step)) state.onboarding.push(step);
}

/**
 * 日付が変わっていたら、前の日の集計を送る分として取り出し、今日の集計を始める。週が変わっていたら、使った週の数を 1 つ増やす。
 *
 * @param state 今の集計
 * @param now 今の時刻
 * @returns 続きの集計（state）と、送る前の日の集計（due。日付が変わっていなければ null）
 * @example
 * rollover(state（day "2026-11-27"）, new Date("2026-11-28T01:00:00Z"))
 * // → { state: { day: "2026-11-28", counts: すべて 0, onboarding: [], … }, due: 前の state }
 * rollover(state（day "2026-11-28"）, new Date("2026-11-28T23:00:00Z")) // → { state, due: null }
 */
export function rollover(state: UsageState, now: Date): { state: UsageState; due: UsageState | null } {
  const today = dayOf(now);
  if (state.day === today) return { state, due: null };
  const week = weekOf(now);
  const next: UsageState = {
    day: today,
    counts: emptyCounts(),
    onboarding: [],
    weeks: week === state.lastWeek ? state.weeks : state.weeks + 1,
    lastWeek: week,
    firstQuarter: state.firstQuarter,
  };
  return { state: next, due: state };
}

/**
 * ブラウザに残した集計を読む。無い・壊れている・形が違うときは、初めて使ったものとして始める（古い集計は捨てる）。
 * 読んだ回数は、今の版の項目に合わせる（知らない項目は捨て、足りない項目は 0 にする）。
 *
 * @param raw 保存した文字列（無ければ null）
 * @param now 今の時刻
 * @returns 集計
 * @example
 * readState(null, now)            // → newState(now)
 * readState("{", now)             // → newState(now)（壊れている）
 * readState(JSON.stringify(s), now) // → s（今の版の項目に合わせたもの）
 */
export function readState(raw: string | null, now: Date): UsageState {
  const fresh = newState(now);
  if (raw === null) return fresh;
  let v: Partial<UsageState>;
  try {
    v = JSON.parse(raw) as Partial<UsageState>;
  } catch {
    return fresh;
  }
  if (typeof v !== "object" || v === null || typeof v.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.day)) return fresh;
  const steps = fresh.onboarding;
  return {
    day: v.day,
    counts: mergeCounts(fresh.counts, v.counts),
    onboarding: Array.isArray(v.onboarding) ? v.onboarding.filter((s): s is OnboardingStep => ONBOARDING.includes(s)) : steps,
    weeks: typeof v.weeks === "number" && v.weeks >= 1 ? Math.floor(v.weeks) : 1,
    lastWeek: typeof v.lastWeek === "number" ? v.lastWeek : fresh.lastWeek,
    firstQuarter: typeof v.firstQuarter === "string" && /^\d{4}-Q[1-4]$/.test(v.firstQuarter) ? v.firstQuarter : fresh.firstQuarter,
  };
}

/** 契約にある、テキストの大きさの区分と、解析の時間の区分。 */
const SIZES: readonly SizeClass[] = ["lt10kb", "10to100kb", "100kbTo1mb", "ge1mb"];
const DURATIONS: readonly ParseDurationClass[] = ["lt100ms", "100to300ms", "300msTo1s", "1to3s", "ge3s"];

/** 契約にある、使い始めの段階。 */
const ONBOARDING: readonly OnboardingStep[] = ["sampleOpened", "textWritten", "diagramOpened", "edited", "viewCreated", "saved", "folderOpened"];

/**
 * 読んだ回数を、今の版の項目に合わせる。項目ごとに、0 以上の数だけを受け取る。
 *
 * @param base すべて 0 の集計（今の版の項目）
 * @param read 読んだ集計（形は信用しない）
 * @returns base の項目に、read の同じ項目の数を入れたもの
 * @example
 * mergeCounts(emptyCounts(), { edits: { rename: 2, unknown: 9 }, pluginUses: -1 })
 * // → edits.rename が 2、ほかは 0（知らない項目と負の数は捨てる）
 */
function mergeCounts(base: DayCounts, read: unknown): DayCounts {
  if (typeof read !== "object" || read === null) return base;
  const src = read as Record<string, unknown>;
  const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const out = base as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(base)) {
    const got = src[key];
    if (typeof value === "number") out[key] = count(got);
    else if (!Array.isArray(value) && typeof got === "object" && got !== null) {
      const table = value as Record<string, number>;
      for (const item of Object.keys(table)) table[item] = count((got as Record<string, unknown>)[item]);
    }
  }
  if (Array.isArray(src["parseTimes"])) {
    for (const p of src["parseTimes"] as { fileSize?: unknown; duration?: unknown; count?: unknown }[]) {
      const fileSize = SIZES.find((x) => x === p?.fileSize);
      const duration = DURATIONS.find((x) => x === p?.duration);
      if (fileSize && duration && count(p.count) > 0) base.parseTimes.push({ fileSize, duration, count: count(p.count) });
    }
  }
  return base;
}
