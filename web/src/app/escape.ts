// HTML・SVG・XML に埋め込む文字のエスケープ。DOM に触れないので、画面の外（Node）の図の書き出しからも使う。

/**
 * HTML・SVG の属性と本文に埋め込む文字列をエスケープする（& < > " の 4 文字）。文字列でない値は文字列にする。
 *
 * @param s 埋め込む値
 * @returns エスケープした文字列
 * @example
 * esc('<a href="x">&</a>') // → "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;"
 * esc(42)                  // → "42"
 * esc("'")                 // → "'"（単引用符はそのまま）
 */
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
