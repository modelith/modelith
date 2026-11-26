// テキストの語の説明（F-EDIT-9、ADR-0014、docs/development/ui-writing.md）。
// SysML v2 の構文を知らない人に、キーワード・標準ビューの名前・よく使う標準ライブラリの名前の意味を、短い言葉で示す。
// 語の表と、テキストの位置から語を探して説明を返す純粋な関数だけを置く（画面への出し方は word-help.ts）。

import { standardViewName, stdViewLabel } from "../core";
import { t } from "../l10n";
import { kindLabel } from "../render/labels";

/** テキストの位置にある語と、その説明。 */
export interface WordHelp {
  /** 説明する語の範囲の始まり（UTF-16 の位置）。2 語のキーワード（`part def`）なら 1 語目の始まり */
  start: number;
  /** 説明する語の範囲の終わり（含まない） */
  end: number;
  /** 説明する語（`part def` のように空白 1 つでつないだもの） */
  term: string;
  /** 見出し。画面の言葉に、テキストの語を括弧で添える（「部品定義（part def）」） */
  title: string;
  /** 説明の本文 */
  text: string;
}

/**
 * キーワードの画面の言葉のうち、種類の名前（labels.ts の kindLabel）に無いもの。
 * 言葉は ui-writing の「言葉の対応」にそろえる。
 */
const TERMS = new Map<string, string>([
  ["satisfy", t("app-glossary-term-satisfy")], ["verify", t("app-glossary-term-verify")], ["frame", t("app-glossary-term-frame")], ["connect", t("app-glossary-term-connect")], ["bind", t("app-glossary-term-bind")],
  ["allocate", t("app-glossary-term-allocate")], ["expose", t("app-glossary-term-expose")], ["filter", t("app-glossary-term-filter")], ["render", t("app-glossary-term-render")],
  ["import", t("app-glossary-term-import")], ["alias", t("app-glossary-term-alias")], ["doc", t("app-glossary-term-doc")], ["about", t("app-glossary-term-about")], ["rep", t("app-glossary-term-rep")],
  ["language", t("app-glossary-term-language")], ["dependency", t("app-glossary-term-dependency")], ["specializes", t("app-glossary-term-specializes")], ["subsets", t("app-glossary-term-subsets")],
  ["redefines", t("app-glossary-term-redefines")], ["references", t("app-glossary-term-references")], ["ref", t("app-glossary-term-ref")], ["first", t("app-glossary-term-first")], ["then", t("app-glossary-term-then")],
  ["succession", t("app-glossary-term-succession")], ["else", t("app-glossary-term-else")], ["until", t("app-glossary-term-until")], ["transition", t("app-glossary-term-transition")],
  ["entry", t("app-glossary-term-entry")], ["do", t("app-glossary-term-do")], ["exit", t("app-glossary-term-exit")], ["parallel", t("app-glossary-term-parallel")],
  ["subject", t("app-glossary-term-subject")], ["stakeholder", t("app-glossary-term-stakeholder")], ["objective", t("app-glossary-term-objective")], ["require", t("app-glossary-term-require")], ["assume", t("app-glossary-term-assume")],
  ["assert", t("app-glossary-term-assert")], ["in", t("app-glossary-term-in")], ["out", t("app-glossary-term-out")], ["inout", t("app-glossary-term-inout")], ["end", t("app-glossary-term-end")],
  ["private", t("app-glossary-term-private")], ["public", t("app-glossary-term-public")], ["abstract", t("app-glossary-term-abstract")], ["message", t("app-glossary-term-message")], ["default", t("app-glossary-term-default")],
  ["constant", t("app-glossary-term-constant")], ["individual", t("app-glossary-term-individual")], ["library", t("app-glossary-term-library")], ["metadata", t("app-glossary-term-metadata")], ["return", t("app-glossary-term-return")],
  ["interface", t("app-glossary-term-interface")], ["use case", t("app-glossary-term-use-case")], ["perform", t("app-glossary-term-perform")], ["exhibit", t("app-glossary-term-exhibit")],
  ["and", t("app-glossary-term-and")], ["or", t("app-glossary-term-or")], ["not", t("app-glossary-term-not")], ["true", t("app-glossary-term-true")], ["false", t("app-glossary-term-false")],
]);

/** キーワード（2 語・3 語のものを含む）の説明。見出しの言葉は TERMS か kindLabel から引く。 */
const KEYWORDS = new Map<string, string>([
  // 構造
  ["package", t("app-glossary-keyword-package")],
  ["part def", t("app-glossary-keyword-part-def")],
  ["part", t("app-glossary-keyword-part")],
  ["attribute def", t("app-glossary-keyword-attribute-def")],
  ["attribute", t("app-glossary-keyword-attribute")],
  ["port def", t("app-glossary-keyword-port-def")],
  ["port", t("app-glossary-keyword-port")],
  ["item def", t("app-glossary-keyword-item-def")],
  ["item", t("app-glossary-keyword-item")],
  ["enum def", t("app-glossary-keyword-enum-def")],
  ["enum", t("app-glossary-keyword-enum")],
  ["interface def", t("app-glossary-keyword-interface-def")],
  ["interface", t("app-glossary-keyword-interface")],
  ["connection def", t("app-glossary-keyword-connection-def")],
  ["connection", t("app-glossary-keyword-connection")],
  ["connect", t("app-glossary-keyword-connect")],
  ["binding", t("app-glossary-keyword-binding")],
  ["bind", t("app-glossary-keyword-bind")],
  ["flow def", t("app-glossary-keyword-flow-def")],
  ["flow", t("app-glossary-keyword-flow")],
  ["succession flow", t("app-glossary-keyword-succession-flow")],
  ["allocation def", t("app-glossary-keyword-allocation-def")],
  ["allocation", t("app-glossary-keyword-allocation")],
  ["allocate", t("app-glossary-keyword-allocate")],
  ["metadata def", t("app-glossary-keyword-metadata-def")],
  ["metadata", t("app-glossary-keyword-metadata")],
  ["individual", t("app-glossary-keyword-individual")],
  ["ref", t("app-glossary-keyword-ref")],
  ["in", t("app-glossary-keyword-in")],
  ["out", t("app-glossary-keyword-out")],
  ["inout", t("app-glossary-keyword-inout")],
  ["end", t("app-glossary-keyword-end")],
  ["default", t("app-glossary-keyword-default")],
  ["constant", t("app-glossary-keyword-constant")],
  ["abstract", t("app-glossary-keyword-abstract")],
  ["private", t("app-glossary-keyword-private")],
  ["public", t("app-glossary-keyword-public")],
  ["def", t("app-glossary-keyword-def")],
  // 関係
  ["specializes", t("app-glossary-keyword-specializes")],
  ["subsets", t("app-glossary-keyword-subsets")],
  ["redefines", t("app-glossary-keyword-redefines")],
  ["references", t("app-glossary-keyword-references")],
  ["dependency", t("app-glossary-keyword-dependency")],
  // 要求と検証
  ["requirement def", t("app-glossary-keyword-requirement-def")],
  ["requirement", t("app-glossary-keyword-requirement")],
  ["concern def", t("app-glossary-keyword-concern-def")],
  ["concern", t("app-glossary-keyword-concern")],
  ["satisfy", t("app-glossary-keyword-satisfy")],
  ["verify", t("app-glossary-keyword-verify")],
  ["frame", t("app-glossary-keyword-frame")],
  ["subject", t("app-glossary-keyword-subject")],
  ["stakeholder", t("app-glossary-keyword-stakeholder")],
  ["objective", t("app-glossary-keyword-objective")],
  ["require", t("app-glossary-keyword-require")],
  ["assume", t("app-glossary-keyword-assume")],
  ["assert", t("app-glossary-keyword-assert")],
  ["verification def", t("app-glossary-keyword-verification-def")],
  ["verification", t("app-glossary-keyword-verification")],
  ["analysis def", t("app-glossary-keyword-analysis-def")],
  ["analysis", t("app-glossary-keyword-analysis")],
  ["constraint def", t("app-glossary-keyword-constraint-def")],
  ["constraint", t("app-glossary-keyword-constraint")],
  ["calc def", t("app-glossary-keyword-calc-def")],
  ["calc", t("app-glossary-keyword-calc")],
  ["return", t("app-glossary-keyword-return")],
  ["case def", t("app-glossary-keyword-case-def")],
  ["case", t("app-glossary-keyword-case")],
  ["use case def", t("app-glossary-keyword-use-case-def")],
  ["use case", t("app-glossary-keyword-use-case")],
  ["include use case", t("app-glossary-keyword-include-use-case")],
  ["actor", t("app-glossary-keyword-actor")],
  // 振る舞い
  ["action def", t("app-glossary-keyword-action-def")],
  ["action", t("app-glossary-keyword-action")],
  ["perform action", t("app-glossary-keyword-perform-action")],
  ["perform", t("app-glossary-keyword-perform")],
  ["first", t("app-glossary-keyword-first")],
  ["then", t("app-glossary-keyword-then")],
  ["succession", t("app-glossary-keyword-succession")],
  ["fork", t("app-glossary-keyword-fork")],
  ["join", t("app-glossary-keyword-join")],
  ["decide", t("app-glossary-keyword-decide")],
  ["merge", t("app-glossary-keyword-merge")],
  ["send", t("app-glossary-keyword-send")],
  ["accept", t("app-glossary-keyword-accept")],
  ["assign", t("app-glossary-keyword-assign")],
  ["terminate", t("app-glossary-keyword-terminate")],
  ["if", t("app-glossary-keyword-if")],
  ["else", t("app-glossary-keyword-else")],
  ["while", t("app-glossary-keyword-while")],
  ["loop", t("app-glossary-keyword-loop")],
  ["until", t("app-glossary-keyword-until")],
  ["for", t("app-glossary-keyword-for")],
  ["message", t("app-glossary-keyword-message")],
  ["state def", t("app-glossary-keyword-state-def")],
  ["state", t("app-glossary-keyword-state")],
  ["exhibit state", t("app-glossary-keyword-exhibit-state")],
  ["exhibit", t("app-glossary-keyword-exhibit")],
  ["transition", t("app-glossary-keyword-transition")],
  ["entry", t("app-glossary-keyword-entry")],
  ["do", t("app-glossary-keyword-do")],
  ["exit", t("app-glossary-keyword-exit")],
  ["parallel", t("app-glossary-keyword-parallel")],
  ["occurrence def", t("app-glossary-keyword-occurrence-def")],
  ["occurrence", t("app-glossary-keyword-occurrence")],
  ["event occurrence", t("app-glossary-keyword-event-occurrence")],
  ["timeslice", t("app-glossary-keyword-timeslice")],
  ["snapshot", t("app-glossary-keyword-snapshot")],
  ["variant", t("app-glossary-keyword-variant")],
  // 図と注釈
  ["view def", t("app-glossary-keyword-view-def")],
  ["view", t("app-glossary-keyword-view")],
  ["viewpoint def", t("app-glossary-keyword-viewpoint-def")],
  ["viewpoint", t("app-glossary-keyword-viewpoint")],
  ["rendering def", t("app-glossary-keyword-rendering-def")],
  ["rendering", t("app-glossary-keyword-rendering")],
  ["expose", t("app-glossary-keyword-expose")],
  ["filter", t("app-glossary-keyword-filter")],
  ["render", t("app-glossary-keyword-render")],
  ["import", t("app-glossary-keyword-import")],
  ["alias", t("app-glossary-keyword-alias")],
  ["library", t("app-glossary-keyword-library")],
  ["doc", t("app-glossary-keyword-doc")],
  ["comment", t("app-glossary-keyword-comment")],
  ["about", t("app-glossary-keyword-about")],
  ["rep", t("app-glossary-keyword-rep")],
  ["language", t("app-glossary-keyword-language")],
  // 式
  ["and", t("app-glossary-keyword-and")],
  ["or", t("app-glossary-keyword-or")],
  ["not", t("app-glossary-keyword-not")],
  ["true", t("app-glossary-keyword-true")],
  ["false", t("app-glossary-keyword-false")],
]);

/** 図の種類（標準ビュー定義）ごとに、何を描く図か。 */
const VIEW_PURPOSE = new Map<string, string>([
  ["GeneralView", t("app-glossary-purpose-general-view")],
  ["InterconnectionView", t("app-glossary-purpose-interconnection-view")],
  ["ActionFlowView", t("app-glossary-purpose-action-flow-view")],
  ["StateTransitionView", t("app-glossary-purpose-state-transition-view")],
  ["SequenceView", t("app-glossary-purpose-sequence-view")],
  ["GeometryView", t("app-glossary-purpose-geometry-view")],
  ["GridView", t("app-glossary-purpose-grid-view")],
  ["BrowserView", t("app-glossary-purpose-browser-view")],
]);

/** よく使う標準ライブラリの名前（見出しと説明）。 */
const LIBRARY = new Map<string, [string, string]>([
  ["ScalarValues", [t("app-glossary-library-scalar-values-title"), t("app-glossary-library-scalar-values-text")]],
  ["Boolean", [t("app-glossary-library-boolean-title"), t("app-glossary-library-boolean-text")]],
  ["String", [t("app-glossary-library-string-title"), t("app-glossary-library-string-text")]],
  ["Integer", [t("app-glossary-library-integer-title"), t("app-glossary-library-integer-text")]],
  ["Natural", [t("app-glossary-library-natural-title"), t("app-glossary-library-natural-text")]],
  ["Positive", [t("app-glossary-library-positive-title"), t("app-glossary-library-positive-text")]],
  ["Rational", [t("app-glossary-library-rational-title"), t("app-glossary-library-rational-text")]],
  ["Real", [t("app-glossary-library-real-title"), t("app-glossary-library-real-text")]],
  ["Complex", [t("app-glossary-library-complex-title"), t("app-glossary-library-complex-text")]],
  ["Number", [t("app-glossary-library-number-title"), t("app-glossary-library-number-text")]],
  ["ISQ", [t("app-glossary-library-isq-title"), t("app-glossary-library-isq-text")]],
  ["SI", [t("app-glossary-library-si-title"), t("app-glossary-library-si-text")]],
  ["SIPrefixes", [t("app-glossary-library-si-prefixes-title"), t("app-glossary-library-si-prefixes-text")]],
  ["USCustomaryUnits", [t("app-glossary-library-us-customary-units-title"), t("app-glossary-library-us-customary-units-text")]],
  ["Quantities", [t("app-glossary-library-quantities-title"), t("app-glossary-library-quantities-text")]],
  ["MeasurementReferences", [t("app-glossary-library-measurement-references-title"), t("app-glossary-library-measurement-references-text")]],
  ["Time", [t("app-glossary-library-time-title"), t("app-glossary-library-time-text")]],
  ["MassValue", [t("app-glossary-library-mass-value-title"), t("app-glossary-library-mass-value-text")]],
  ["LengthValue", [t("app-glossary-library-length-value-title"), t("app-glossary-library-length-value-text")]],
  ["DurationValue", [t("app-glossary-library-duration-value-title"), t("app-glossary-library-duration-value-text")]],
  ["SpeedValue", [t("app-glossary-library-speed-value-title"), t("app-glossary-library-speed-value-text")]],
  ["ForceValue", [t("app-glossary-library-force-value-title"), t("app-glossary-library-force-value-text")]],
  ["EnergyValue", [t("app-glossary-library-energy-value-title"), t("app-glossary-library-energy-value-text")]],
  ["PowerValue", [t("app-glossary-library-power-value-title"), t("app-glossary-library-power-value-text")]],
  ["PressureValue", [t("app-glossary-library-pressure-value-title"), t("app-glossary-library-pressure-value-text")]],
  ["AreaValue", [t("app-glossary-library-area-value-title"), t("app-glossary-library-area-value-text")]],
  ["VolumeValue", [t("app-glossary-library-volume-value-title"), t("app-glossary-library-volume-value-text")]],
  ["ElectricCurrentValue", [t("app-glossary-library-electric-current-value-title"), t("app-glossary-library-electric-current-value-text")]],
  ["ThermodynamicTemperatureValue", [t("app-glossary-library-thermodynamic-temperature-value-title"), t("app-glossary-library-thermodynamic-temperature-value-text")]],
  ["start", [t("app-glossary-library-start-title"), t("app-glossary-library-start-text")]],
  ["done", [t("app-glossary-library-done-title"), t("app-glossary-library-done-text")]],
]);

/** 単位の記号（見出しと説明）。数のすぐ後の `[ ]` の中と、`SI::` の後でだけ説明する（ほかの名前と取り違えないため）。 */
const UNITS = new Map<string, [string, string]>([
  ["kg", [t("app-glossary-unit-kilogram-title"), t("app-glossary-unit-kilogram-text")]],
  ["g", [t("app-glossary-unit-gram-title"), t("app-glossary-unit-gram-text")]],
  ["m", [t("app-glossary-unit-metre-title"), t("app-glossary-unit-metre-text")]],
  ["mm", [t("app-glossary-unit-millimetre-title"), t("app-glossary-unit-millimetre-text")]],
  ["cm", [t("app-glossary-unit-centimetre-title"), t("app-glossary-unit-centimetre-text")]],
  ["km", [t("app-glossary-unit-kilometre-title"), t("app-glossary-unit-kilometre-text")]],
  ["s", [t("app-glossary-unit-second-title"), t("app-glossary-unit-second-text")]],
  ["min", [t("app-glossary-unit-minute-title"), t("app-glossary-unit-minute-text")]],
  ["h", [t("app-glossary-unit-hour-title"), t("app-glossary-unit-hour-text")]],
  ["W", [t("app-glossary-unit-watt-title"), t("app-glossary-unit-watt-text")]],
  ["kW", [t("app-glossary-unit-kilowatt-title"), t("app-glossary-unit-kilowatt-text")]],
  ["J", [t("app-glossary-unit-joule-title"), t("app-glossary-unit-joule-text")]],
  ["V", [t("app-glossary-unit-volt-title"), t("app-glossary-unit-volt-text")]],
  ["A", [t("app-glossary-unit-ampere-title"), t("app-glossary-unit-ampere-text")]],
  ["N", [t("app-glossary-unit-newton-title"), t("app-glossary-unit-newton-text")]],
  ["Pa", [t("app-glossary-unit-pascal-title"), t("app-glossary-unit-pascal-text")]],
  ["K", [t("app-glossary-unit-kelvin-title"), t("app-glossary-unit-kelvin-text")]],
  ["Hz", [t("app-glossary-unit-hertz-title"), t("app-glossary-unit-hertz-text")]],
]);

/** 語の並びのうち、いちどに説明する語の数の上限（`include use case` の 3 語）。 */
const MAX_PHRASE = 3;

/**
 * テキストを字句に分け、名前（識別子）の位置だけを返す。コメント・文字列・引用名・数の中の語は名前にしない。
 * 位置 offset の後ろは、名前を MAX_PHRASE 個まで読んだら止める。
 *
 * @param text テキスト
 * @param offset 調べる位置（UTF-16 の位置）
 * @returns 名前の範囲の並び（テキストの順）
 * @example
 * nameTokens("part def A; // part", 0) // → [{start:0,end:4},{start:5,end:8},{start:9,end:10}]（コメントの中の part は含まない）
 * nameTokens("x = 1e5;", 0)            // → [{start:0,end:1}]（数の中の e5 は名前にしない）
 */
function nameTokens(text: string, offset: number): { start: number; end: number }[] {
  const re = /\/\/\*[\s\S]*?(?:\*\/|$)|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|\d[\w.]*|([A-Za-z_]\w*)/g;
  const out: { start: number; end: number }[] = [];
  let after = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[1] === undefined) continue;
    out.push({ start: m.index, end: m.index + m[1].length });
    if (m.index > offset && ++after >= MAX_PHRASE) break;
  }
  return out;
}

/**
 * キーワードの説明を、見出しと本文にする。
 *
 * @param term キーワード（`part def` のように空白 1 つでつないだもの）
 * @returns 見出しと本文。キーワードの表に無ければ null
 * @example
 * keywordHelp("part def") // → { title: "部品定義（part def）", text: "部品の型を定義します。…" }
 * keywordHelp("satisfy")  // → { title: "満たす（satisfy）", text: "部品などが要求を満たすことを示します…" }
 * keywordHelp("bogus")    // → null
 */
function keywordHelp(term: string): { title: string; text: string } | null {
  const text = KEYWORDS.get(term);
  if (text === undefined) return null;
  return { title: t("app-glossary-title", { label: TERMS.get(term) ?? kindLabel(term), term }), text };
}

/**
 * キーワードでない 1 語の説明を、見出しと本文にする（標準ビューの名前・標準ライブラリの名前・単位）。
 * 短い名前の図の種類（`afv`）は型の位置（`:`・`:>`・`::` の後）でだけ、単位は数の後の `[ ]` の中と `SI::` の後でだけ説明する。
 *
 * @param word 語
 * @param before 語の前のテキスト（文脈を見るのに使う。語のすぐ前まで）
 * @returns 見出しと本文。どれにも当たらなければ null
 * @example
 * nameHelp("ActionFlowView", "view v : ") // → { title: "アクティビティ図（SysML v2 の標準ビュー ActionFlowView）", … }
 * nameHelp("afv", "view v : ")            // → { title: "アクティビティ図（SysML v2 の標準ビュー ActionFlowView の短い名前 afv）", … }
 * nameHelp("afv", "part ")                // → null（型の位置でない短い名前）
 * nameHelp("W", "power = 1500 [")         // → { title: "ワット（W）", … }
 */
function nameHelp(word: string, before: string): { title: string; text: string } | null {
  const std = standardViewName(word);
  if (std !== null && (std === word || /[:>]\s*$/.test(before))) {
    const label = stdViewLabel(std);
    const title = std === word ? t("app-glossary-view-title", { label, name: std }) : t("app-glossary-view-title-short", { label, name: std, short: word });
    return { title, text: VIEW_PURPOSE.get(std) ?? "" };
  }
  const lib = LIBRARY.get(word);
  if (lib) return { title: t("app-glossary-title", { label: lib[0], term: word }), text: lib[1] };
  const unit = UNITS.get(word);
  if (unit && /(\d\s*\[\s*|\bSI::)$/.test(before)) return { title: t("app-glossary-title", { label: unit[0], term: word }), text: unit[1] };
  return null;
}

/**
 * テキストの位置にある語を探し、その意味の説明を返す（F-EDIT-9）。語の始まりと終わりの位置も、その語に含める。
 * 空白だけで続くキーワードの並び（`part def`・`use case def`）は、まとめて 1 つの語として説明する。
 * コメント・文字列・引用名（`'…'`）の中の語と、表に無い語は説明しない。
 *
 * @param text テキスト
 * @param offset 位置（UTF-16 の位置。0 からテキストの長さまで）
 * @returns 語の範囲と説明。語が無い・説明の無い語・範囲外の位置なら null
 * @example
 * explainAt("part def Kettle;", 2)  // → { start: 0, end: 8, term: "part def", title: "部品定義（part def）", … }
 * explainAt("part def Kettle;", 8)  // → 同じ（語の終わりの位置）
 * explainAt("part def Kettle;", 12) // → null（利用者の付けた名前）
 * explainAt("// part", 4)           // → null（コメントの中）
 */
export function explainAt(text: string, offset: number): WordHelp | null {
  if (offset < 0 || offset > text.length) return null;
  const names = nameTokens(text, offset);
  const at = names.findIndex((w) => w.start <= offset && offset <= w.end);
  if (at < 0) return null;
  // 空白だけで隣り合う語の並びのうち、位置の語を含む最も長いキーワードを探す（同じ長さなら前から）
  const joined = (a: number, b: number): boolean =>
    names.slice(a, b).every((w, i) => /^\s+$/.test(text.slice(w.end, (names[a + i + 1] as { start: number }).start)));
  for (let len = Math.min(MAX_PHRASE, names.length); len >= 1; len--) {
    for (let a = Math.max(0, at - len + 1); a <= at && a + len <= names.length; a++) {
      if (!joined(a, a + len - 1)) continue;
      const first = names[a] as { start: number }, last = names[a + len - 1] as { end: number };
      const term = names.slice(a, a + len).map((w) => text.slice(w.start, w.end)).join(" ");
      const help = keywordHelp(term);
      if (help) return { start: first.start, end: last.end, term, ...help };
    }
  }
  const w = names[at] as { start: number; end: number };
  const word = text.slice(w.start, w.end);
  const help = nameHelp(word, text.slice(Math.max(0, w.start - 40), w.start));
  return help ? { start: w.start, end: w.end, term: word, ...help } : null;
}
