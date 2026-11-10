// 問題一覧に出す行の数を決める（F-EDIT-5）。

/** 問題一覧にボタンとして出す行の上限。多すぎると描き直しが重くなるため。 */
export const MAX_PROBLEM_ROWS = 200;

/**
 * 問題一覧に出す行を、上限までに切る。切った分があれば、そのことを示す行を最後に足す（#236）。
 *
 * @param rows 出したい行（HTML。並べる順）
 * @param max 出す行の上限
 * @returns 出す行（HTML）。上限以下ならそのまま
 * @example
 * problemRows(["<button>a</button>"], 200)        // → ["<button>a</button>"]
 * problemRows(["<b>1</b>", "<b>2</b>", "<b>3</b>"], 2)
 * // → ["<b>1</b>", "<b>2</b>", '<div class="more">ほかに 1 件あります。上の問題を直すと表示します</div>']
 */
export function problemRows(rows: readonly string[], max: number): string[] {
  if (rows.length <= max) return [...rows];
  const rest = rows.length - max;
  return [...rows.slice(0, max), `<div class="more">ほかに ${rest} 件あります。上の問題を直すと表示します</div>`];
}
