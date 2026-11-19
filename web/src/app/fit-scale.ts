// 図を開いたとき・「全体」を押したときの拡大率の決め方（F-VIEW-4）。画面に触れない計算だけを置く。

/** 図全体を収めるときの拡大率の上限。 */
const FIT_MAX = 1.1;
/** 文字が読める大きさで開く図（アクティビティ図・状態遷移図・シーケンス図）で、収まらない図を開くときの拡大率。 */
export const READABLE_MIN = 0.8;
/** 文字が読める大きさで開く図でも、ここまでの縮小で全体が収まるなら収める（端だけが切れた図にしない。#297）。 */
export const READABLE_FIT_MIN = 0.7;

/**
 * 図の拡大率を決める。ふつうは、全体が収まる拡大率（上限 1.1、下限 floor）。
 * 文字が読める大きさで開く図（readable）は、全体が収まる拡大率が 0.7 以上ならその拡大率で収め、
 * 0.7 より小さくしないと収まらない大きな図だけを、0.8（と floor の大きいほう）で開く（収まらない分は、動かすか「全体」で見る）。
 *
 * @param whole 図全体（余白を含む）が枠に収まる拡大率（枠の幅 ÷ 図の幅 と 枠の高さ ÷ 図の高さ の小さいほう）
 * @param floor 拡大率の下限（狭い画面は 0.45、ほかは 0.25）
 * @param readable 文字が読める大きさで開く図を、タブを開いたときに合わせるなら true
 * @returns 拡大率
 * @example
 * fitScale(2, 0.25, false)    // → 1.1（上限）
 * fitScale(0.5, 0.25, false)  // → 0.5（全体を収める）
 * fitScale(0.1, 0.25, false)  // → 0.25（下限）
 * fitScale(0.73, 0.25, true)  // → 0.73（少し縮めれば収まるので、収める）
 * fitScale(0.5, 0.25, true)   // → 0.8（大きな図は、読める大きさで開く）
 */
export function fitScale(whole: number, floor: number, readable: boolean): number {
  const least = readable && whole < READABLE_FIT_MIN ? Math.max(floor, READABLE_MIN) : floor;
  return Math.max(least, Math.min(FIT_MAX, whole));
}
