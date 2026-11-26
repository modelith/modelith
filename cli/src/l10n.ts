// 図に描く文言の辞書を入れる（ADR-0027）。アプリと同じ描画（web/src/render）は、文を辞書から受け取る。
// 読み込むだけで辞書が入る。描画のモジュールより先に読み込む（web-render.ts の先頭）。
// 0.3.0 の間は日本語の辞書だけ。言語の選び方（引数と OS の言語の設定。F-L10N-2）は 0.4.0 で足す。
import { readFileSync } from "node:fs";
import { installTranslator } from "../../web/src/l10n/index.ts";
import { createTranslator } from "../../web/src/l10n/translator.ts";

/** 描画が使う辞書のファイル（web/src/locales/<言語>/ の下）。描画と、描画が使うコアの部分の文だけを読む。 */
export const DICTIONARY_FILES = ["render.ftl", "core.ftl"];

installTranslator(
  createTranslator(
    DICTIONARY_FILES.map((name) => ({ locale: "ja", source: readFileSync(new URL(`../../web/src/locales/ja/${name}`, import.meta.url), "utf8") })),
    (problem) => {
      throw new Error(`l10n: ${problem}`);
    },
  ),
);
