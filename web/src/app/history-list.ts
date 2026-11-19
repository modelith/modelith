// 元に戻す履歴の並びの扱い（F-EDIT-4）。画面に触れない部分だけを置き、単体テストで確かめる。

/**
 * 履歴に今の版を足す。今の位置より後ろの版（やり直せる版）は捨て、今の版のほかに steps 版を超えたら古いものから捨てる。
 *
 * @param list 今の履歴（古い順）
 * @param at 今の位置（list の番号）
 * @param now 足す版
 * @param steps 元に戻せる回数（今の版のほかに持つ版の数）
 * @returns 足した後の履歴と、今の位置（最後の版）
 * @example
 * pushVersion(["a", "b"], 1, "c", 200) // → { list: ["a", "b", "c"], at: 2 }
 * pushVersion(["a", "b", "c"], 0, "d", 200) // → { list: ["a", "d"], at: 1 }（やり直せた b・c は捨てる）
 * pushVersion(["a", "b", "c"], 2, "d", 2) // → { list: ["b", "c", "d"], at: 2 }（元に戻せるのは 2 回まで）
 */
export function pushVersion<T>(list: readonly T[], at: number, now: T, steps: number): { list: T[]; at: number } {
  const next = [...list.slice(0, at + 1), now];
  const kept = next.length > steps + 1 ? next.slice(next.length - (steps + 1)) : next;
  return { list: kept, at: kept.length - 1 };
}
