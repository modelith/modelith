// 画面の文言の口（ADR-0027 の 2）。コードは文を直接書かず、t(キー, 値) で辞書の文を受け取る。
// 辞書は起動時に installTranslator で入れる（アプリとテストは setup.ts）。このファイルは辞書の形（Fluent）を知らない。
import type { Translate, Values } from "./translator";

export type { Translate, Values } from "./translator";

/** 今の言語で文を作る関数。辞書を入れるまでは、キーをそのまま返す。 */
let current: Translate = (key) => key;

/**
 * 文を作る関数を入れ替える（起動時と、言語を切り替えたとき）。
 *
 * @param translate キーと値から文を作る関数
 * @example
 * installTranslator(createTranslator([{ locale: "ja", source: JA }]));
 */
export function installTranslator(translate: Translate): void {
  current = translate;
}

/**
 * 辞書の文を、今の言語で返す。
 *
 * @param key 辞書のキー（小文字の英字・数字・`-`）。検査（web/tools/l10n-cli.ts）が辞書と突き合わせるので、文字列をそのまま書く
 * @param values 文に差し込む値。文に出す数は文字列にして渡す
 * @returns 文。辞書にキーが無ければ、キーをそのまま返す
 * @example
 * t("files-name-empty")                     // → "名前を入力してください"
 * t("files-already-exists", { path: "a" })  // → "「a」は既にあります"
 */
export function t(key: string, values?: Values): string {
  return current(key, values);
}
