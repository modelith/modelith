// 文言を辞書（Fluent の .ftl）から作る（ADR-0027 の 2）。判断だけの純粋関数で、辞書の読み込みは呼ぶ側（setup.ts など）が行う。
// Fluent の型に触れるのはこのファイルだけ。コードは index.ts の t(キー, 値) だけを使う。
import { FluentBundle, FluentResource } from "@fluent/bundle";

/** 文に差し込む値。数は複数形の選び分けにだけ渡し、文に出す数は文字列にして渡す（Rust の実装と数の書き方が違うため）。 */
export type Values = Readonly<Record<string, string | number>>;

/** キーと値から文を作る関数。 */
export type Translate = (key: string, values?: Values) => string;

/** 1 つの言語の辞書。 */
export interface Dictionary {
  /** 言語のタグ（`ja`・`en` など）。複数形の選び分けに使う。 */
  locale: string;
  /** .ftl の中身。 */
  source: string;
}

/**
 * 辞書から、文を作る関数を作る。
 *
 * @param dictionaries 辞書。先のものを優先し、キーが無ければ次の辞書を見る（利用者の言語 → 元の言語の順に渡す）
 * @param report 辞書の誤り（キーが無い・値が足りない・.ftl が読めない）を受け取る関数。既定は何もしない
 * @returns 文を作る関数。どの辞書にもキーが無ければ、キーをそのまま返す
 * @example
 * const t = createTranslator([{ locale: "ja", source: "saved = 「{ $name }」を保存しました" }]);
 * t("saved", { name: "a.sysml" }) // → "「a.sysml」を保存しました"
 * t("missing")                    // → "missing"
 */
export function createTranslator(dictionaries: readonly Dictionary[], report: (problem: string) => void = () => {}): Translate {
  const bundles = dictionaries.map(({ locale, source }) => {
    // 値の前後に見えない記号（U+2068・U+2069）を入れない。コピーした文・入力欄・文字の検索に残るため
    const bundle = new FluentBundle(locale, { useIsolating: false });
    for (const error of bundle.addResource(new FluentResource(source))) report(`${locale}: ${error.message}`);
    return bundle;
  });
  return (key, values) => {
    for (const bundle of bundles) {
      const pattern = bundle.getMessage(key)?.value;
      if (pattern === null || pattern === undefined) continue;
      const errors: Error[] = [];
      const text = bundle.formatPattern(pattern, values, errors);
      for (const error of errors) report(`${key}: ${error.message}`);
      return text;
    }
    report(`${key}: not in the dictionary`);
    return key;
  };
}
