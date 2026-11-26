// 画面の骨組み（index.html）の文言を、辞書から埋める（ADR-0027）。判断だけの純粋関数で、ビルドへの組み込みは vite.config.ts が行う。
// index.html には文を書かず、キーだけを書く：
//   <button data-l10n="shell-save"></button>                  … 要素の中身（中身は空にしておく）
//   <button data-l10n-title="shell-undo-hint"></button>       … title 属性（aria-label・placeholder も同じ）
// ビルドのときに元の言語の文で埋めるので、スクリプトを読み込む前から文が見える。キーは残すので、後から別の言語に入れ替えられる。

/** 辞書から埋める属性。`data-l10n-<名前>="キー"` と書く。 */
const ATTRIBUTES = ["title", "aria-label", "placeholder"];

/**
 * 文を、HTML の文字と属性の値として安全な形にする。
 *
 * @param text 文
 * @returns `&`・`<`・`>`・`"` を文字参照にした文
 * @example
 * escapeHtml('a < b & "c"') // → "a &lt; b &amp; &quot;c&quot;"
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * HTML の `data-l10n`・`data-l10n-<属性>` を、辞書の文で埋める。
 *
 * @param html index.html の中身
 * @param translate キーから文を作る関数
 * @returns 文を埋めた HTML。キーの属性は残す
 * @throws `data-l10n` を書いた要素の中身が空でないとき（埋める場所が決まらない）
 * @example
 * fillHtml('<b data-l10n="a"></b>', () => "保存")                // → '<b data-l10n="a">保存</b>'
 * fillHtml('<i data-l10n-title="a"></i>', () => "元に戻す")      // → '<i data-l10n-title="a" title="元に戻す"></i>'
 */
export function fillHtml(html: string, translate: (key: string) => string): string {
  let filled = 0;
  let out = html.replace(/(<[^<>]*\sdata-l10n="([a-z0-9-]+)"[^<>]*>)(<\/)/g, (_all, open: string, key: string, close: string) => {
    filled++;
    return `${open}${escapeHtml(translate(key))}${close}`;
  });
  const written = [...html.matchAll(/\sdata-l10n="/g)].length;
  if (filled !== written) throw new Error(`data-l10n を書いた要素のうち ${written - filled} 個は、中身が空でないので埋められません（中身を空にしてください）`);
  for (const name of ATTRIBUTES) {
    out = out.replace(new RegExp(`\\sdata-l10n-${name}="([a-z0-9-]+)"`, "g"), (all, key: string) => `${all} ${name}="${escapeHtml(translate(key))}"`);
  }
  return out;
}

/**
 * HTML に直接書かれた文（日本語を含む行）を探す。コメント（`<!-- … -->`）は見ない。
 *
 * @param html HTML の中身
 * @returns 文が直接書かれた行（1 始まり）と、その行
 * @example
 * hardcodedHtmlText('<b>保存</b>\n<!-- 説明 -->\n<b data-l10n="a"></b>') // → [{ line: 1, message: "<b>保存</b>" }]
 */
export function hardcodedHtmlText(html: string): { line: number; message: string }[] {
  const code = html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "));
  return code.split("\n").flatMap((text, k) => (/[ぁ-ゖァ-ヺ一-鿿、。「-』！-～]/.test(text) ? [{ line: k + 1, message: text.trim() }] : []));
}
