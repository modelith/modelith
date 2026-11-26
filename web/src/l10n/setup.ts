// アプリとテストの起動時に、辞書を入れる（ADR-0027）。ほかのモジュールより先に読み込む（モジュールの先頭で t を呼ぶものがあるため）。
// 0.3.0 の間は日本語の辞書だけ。0.4.0 で英語の辞書と、言語の選び方（F-L10N-1）を足す。
import JA from "../locales/ja.ftl?raw";
import { installTranslator } from "./index";
import { createTranslator } from "./translator";

/**
 * 辞書の誤りを知らせる。開発中とテストでは止め、配った版では記録だけにする（画面を止めない）。
 *
 * @param problem 誤りの中身（`キー: 理由`）
 * @throws 開発中とテストのとき
 * @example
 * reportProblem("files-x: not in the dictionary") // 開発中は例外。配った版はコンソールに出すだけ
 */
function reportProblem(problem: string): void {
  if (import.meta.env.DEV) throw new Error(`l10n: ${problem}`);
  console.error(`l10n: ${problem}`);
}

installTranslator(createTranslator([{ locale: "ja", source: JA }], reportProblem));
