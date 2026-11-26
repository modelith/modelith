// 画面に出す種類の名前（ADR-0014、docs/development/ui-writing.md）。
// 利用者は SysML v2 の構文を覚えていないので、画面では図の言葉を使い、キーワードは補足にする。

import type { Entry } from "../core/types.ts";
import { t } from "../l10n/index.ts";
import { stdViewLabel } from "../core/views.ts";

const KIND_LABEL: Record<string, string> = {
  "part def": t("render-kind-part-def"), part: t("render-kind-part"), "attribute def": t("render-kind-attribute-def"), attribute: t("render-kind-attribute"), "port def": t("render-kind-port-def"), port: t("render-kind-port"),
  "item def": t("render-kind-item-def"), item: t("render-kind-item"), "requirement def": t("render-kind-requirement-def"), requirement: t("render-kind-requirement"), "concern def": t("render-kind-concern-def"), concern: t("render-kind-concern"),
  "verification def": t("render-kind-verification-def"), verification: t("render-kind-verification"), "analysis def": t("render-kind-analysis-def"), analysis: t("render-kind-analysis"), "constraint def": t("render-kind-constraint-def"), constraint: t("render-kind-constraint"),
  "calc def": t("render-kind-calc-def"), calc: t("render-kind-calc"), "state def": t("render-kind-state-def"), state: t("render-kind-state"), "action def": t("render-kind-action-def"), action: t("render-kind-action"),
  "exhibit state": t("render-kind-exhibit-state"), "perform action": t("render-kind-perform-action"),
  "occurrence def": t("render-kind-occurrence-def"), occurrence: t("render-kind-occurrence"), "interface def": t("render-kind-interface-def"), "connection def": t("render-kind-connection-def"),
  "allocation def": t("render-kind-allocation-def"), allocation: t("render-kind-allocation"), connection: t("render-kind-connection"), binding: t("render-kind-binding"),
  "flow def": t("render-kind-flow-def"), flow: t("render-kind-flow"),
  "use case def": t("render-kind-use-case-def"), "enum def": t("render-kind-enum-def"), "metadata def": t("render-kind-metadata-def"), "view def": t("render-kind-view-def"), view: t("render-kind-view"),
  package: t("render-kind-package"),
  // alpha.7 で読むようにした種類（ツリーとツールチップに出る）
  "case def": t("render-kind-case-def"), case: t("render-kind-case"), actor: t("render-kind-actor"), "include use case": t("render-kind-include-use-case"), enum: t("render-kind-enum"),
  "event occurrence": t("render-kind-event-occurrence"), timeslice: t("render-kind-timeslice"), snapshot: t("render-kind-snapshot"), variant: t("render-kind-variant"),
  "viewpoint def": t("render-kind-viewpoint-def"), viewpoint: t("render-kind-viewpoint"), "rendering def": t("render-kind-rendering-def"), rendering: t("render-kind-rendering"),
  def: t("render-kind-def"), usage: t("render-kind-usage"),
  // alpha.8 で読むようにした種類
  comment: t("render-kind-comment"),
  // alpha.9 で読むようにした種類（アクションの流れ、8.2.2.17）
  fork: t("render-kind-fork"), join: t("render-kind-join"), decide: t("render-kind-decide"), merge: t("render-kind-merge"),
  send: t("render-kind-send"), accept: t("render-kind-accept"), assign: t("render-kind-assign"), terminate: t("render-kind-terminate"),
  if: t("render-kind-if"), while: t("render-kind-while"), loop: t("render-kind-loop"), for: t("render-kind-for"),
  start: t("render-kind-start"), done: t("render-kind-done"), "succession flow": t("render-kind-succession-flow"),
};

/**
 * 要素の種類の、画面での名前を返す（ADR-0014）。知らない種類は SysML v2 のキーワードのまま返す。
 *
 * @param kind 要素の種類（SysML v2 のキーワード。`part def`・`requirement`・`package` など）
 * @returns 画面に出す名前。表に無い種類なら kind そのもの
 * @example
 * kindLabel("part def")  // → "部品定義"
 * kindLabel("view")      // → "作成した図"
 * kindLabel("flow def")  // → "流れの定義"
 * kindLabel("send")      // → "送信"
 * kindLabel("bogus")     // → "bogus"（表に無い種類）
 */
export const kindLabel = (kind: string): string => KIND_LABEL[kind] ?? kind;

/**
 * 図の種類に当たる SysML v2 の標準ビューを、補足の一言にする（ui-writing の決まり 9）。
 * 画面の名前がその標準ビューの名前と同じなら標準ビューの名前だけを、Modelith 独自の図なら「〜で描く図」と書く。
 *
 * @param label 図の種類の、画面での名前（「アクティビティ図」・「トレーサビリティ」など）
 * @param std 当たる標準ビュー定義の名前（`ActionFlowView`・`GeneralView` など）
 * @returns 補足の一言
 * @example
 * v2ViewNote("アクティビティ図", "ActionFlowView") // → "SysML v2 では ActionFlowView"
 * v2ViewNote("トレーサビリティ", "GeneralView")     // → "SysML v2 では GeneralView で描く図"（独自の図）
 */
export const v2ViewNote = (label: string, std: string): string =>
  stdViewLabel(std) === label ? t("render-v2-view", { std }) : t("render-v2-view-drawn", { std });

/**
 * 図の種類のツールチップ。画面の名前に、SysML v2 の標準ビューの補足を括弧で添える（ui-writing の決まり 3・9）。
 *
 * @param label 図の種類の、画面での名前
 * @param std 当たる標準ビュー定義の名前
 * @returns ツールチップの文
 * @example
 * viewHint("アクティビティ図", "ActionFlowView") // → "アクティビティ図（SysML v2 では ActionFlowView）"
 * viewHint("すべて", "GeneralView")              // → "すべて（SysML v2 では GeneralView で描く図）"
 */
export const viewHint = (label: string, std: string): string => t("render-view-hint", { label, note: v2ViewNote(label, std) });

/**
 * 作成した図（テキストの view）の種類のツールチップ。型の無い view は一般ビュー（GeneralView）として描くので、そう書く。
 *
 * @param std view の標準ビュー定義の名前。型の無い view は null
 * @returns ツールチップの文
 * @example
 * savedViewHint("InterconnectionView") // → "内部ブロック図（SysML v2 では InterconnectionView）"
 * savedViewHint(null)                  // → "一般ビュー（SysML v2 では GeneralView）"（型の無い view）
 */
export const savedViewHint = (std: string | null): string => viewHint(stdViewLabel(std), std ?? "GeneralView");

/**
 * タブのツールチップ。タブの名前が図の種類の名前と同じなら補足つきの文だけを、違えば（対象や工程が付く、作成した図）
 * タブの名前の下の行に補足つきの文を出す。
 *
 * @param name タブの名前（「ibd Vehicle」・「作成した図「概要」」など）
 * @param label 図の種類の、画面での名前（「すべて」・「内部ブロック図」など）
 * @param hint 図の種類のツールチップ（viewHint・savedViewHint）
 * @returns タブのツールチップの文
 * @example
 * tabTitle("すべて", "すべて", "すべて（SysML v2 では GeneralView で描く図）")  // → "すべて（SysML v2 では GeneralView で描く図）"
 * tabTitle("ibd Vehicle", "内部ブロック図", "内部ブロック図（SysML v2 では InterconnectionView）")
 * // → "ibd Vehicle\n内部ブロック図（SysML v2 では InterconnectionView）"
 */
export const tabTitle = (name: string, label: string, hint: string): string => (name === label ? hint : `${name}\n${hint}`);

/**
 * 要素の名前（と型の名前）を、画面に出す形にする。引用名の中のエスケープ（`\'`・`\"`・`\\`。KerML 8.2.2.1）を、表す文字に戻す（#297）。
 * コアが返す名前は、テキストに書いたままのエスケープを持つ（要素を探すキーと同じ形）。表示のためだけに使い、要素を探す・比べるのには使わない。
 * 改行やタブを表すエスケープ（`\n`・`\t` など）は、1 行の名前として見せられないので、書いたままにする。
 *
 * @param name コアが返した名前（引用符は外れている）
 * @returns 画面に出す名前
 * @example
 * shownName("a\\'b")    // → "a'b"（テキストでは 'a\'b'）
 * shownName("x\\\\y")   // → "x\\y"（テキストでは 'x\\y'）
 * shownName("a\\nb")    // → "a\\nb"（改行のエスケープは書いたまま）
 * shownName("電気 ケトル") // → "電気 ケトル"
 * shownName("")          // → ""
 */
export const shownName = (name: string): string => name.replace(/\\(['"\\])/g, "$1");

/**
 * 線のラベルを、画面に出す形にする。部品として持つ線（comp）のラベルは部品の名前なので、要素の名前と同じく shownName を通す。
 * ほかの線のラベル（遷移のトリガ・ガード、流れるものなど）は式を含むことがあるので、コアが返したまま出す。
 *
 * @param e 線（種類とラベル）
 * @returns 画面に出すラベル（無ければ空文字列）
 * @example
 * shownEdgeLabel({ kind: "comp", label: "q\\'r" })             // → "q'r"
 * shownEdgeLabel({ kind: "transition", label: "Go [x == '\\\\']" }) // → "Go [x == '\\\\']"（そのまま）
 */
export const shownEdgeLabel = (e: { kind: string; label: string }): string => (e.kind === "comp" ? shownName(e.label) : e.label);

/**
 * 宣言の型を、図やツリーに出す文にする。型が複数あれば、書いた順にカンマでつなぐ。
 *
 * @param e 宣言（型と、2 つめ以降の型）
 * @returns 表示する文。型が無ければ空文字列
 * @example
 * typeText({ type: "A" })                                  // → "A"
 * typeText({ type: "A", moreTypes: [{ name: "B" }] })      // → "A, B"
 * typeText({ type: "a\\'b" })                             // → "a'b"（引用名のエスケープを戻す）
 * typeText({ type: "" })                                   // → ""
 */
export function typeText(e: Pick<Entry, "type" | "moreTypes">): string {
  return [e.type, ...(e.moreTypes ?? []).map((t) => t.name)].filter((t) => t !== "").map(shownName).join(", ");
}

/**
 * 属性 1 つを `名前 : 型 = 値` の形の文にする（値の書き方 `:=`・`default` はそのまま）。
 *
 * @param a 属性（解析結果の項目）
 * @returns 表示する文
 * @example
 * attrText({ name: "mass", type: "Real", value: "1500", … })               // → "mass : Real = 1500"
 * attrText({ name: "t", type: "Real", value: "0", valueOp: ":=", … })     // → "t : Real := 0"
 * attrText({ name: "重さ", type: "", … })                                  // → "重さ"
 */
export function attrText(a: Pick<Entry, "name" | "type"> & { value?: string | undefined; valueOp?: string | undefined }): string {
  return `${a.name}${a.type ? ` : ${a.type}` : ""}${a.value ? ` ${a.valueOp ?? "="} ${a.value}` : ""}`;
}

/**
 * 説明を書き換えたときのトーストの文。テキストに書けない「*\/」を「* /」にしたときは、そのことも知らせる（F-EDIT-12、#244）。
 *
 * @param name 要素の名前
 * @param label 説明の呼び方（「説明」・「要求の文章」）
 * @param text 書いた説明の文（空なら消した）
 * @returns トーストの文
 * @example
 * docChangedMessage("R", "要求の文章", "3 分で沸かす") // → "「R」の要求の文章を変えました"
 * docChangedMessage("A", "説明", "")                   // → "「A」の説明を消しました"
 * docChangedMessage("A", "説明", "a *\/ b")            // → "「A」の説明を変えました。「*\/」はテキストに書けないため「* /」にしました"
 */
export function docChangedMessage(name: string, label: string, text: string): string {
  if (!text.trim()) return t("render-doc-removed", { name, label });
  return t(text.includes("*/") ? "render-doc-changed-escaped" : "render-doc-changed", { name, label });
}
