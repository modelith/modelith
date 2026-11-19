// 全体図（ミニマップ）の置き場所を決める（F-VIEW-4・Q-2）。測った大きさから決めるだけで、画面には触れない。

/** 全体図と、インスペクタ・拡大縮小のボタンとの間に空ける幅（px）。 */
const GAP = 8;

/** インスペクタの上の端から全体図の下の端までの幅（px）。 */
const ABOVE_INSPECTOR = 22;

/** 全体図の置き場所を決めるために測った大きさ（px。図の枠の中での位置）。 */
export interface MiniRoom {
  /** 図の枠の高さ。 */
  wrapH: number;
  /** インスペクタの高さ。インスペクタを隠していれば null。 */
  inspH: number | null;
  /** 全体図の高さ。全体図を隠していれば 0。 */
  miniH: number;
  /** 拡大縮小のボタンの列の下の端（図の枠の上の端から）。 */
  zoomBottom: number;
  /** 図の枠の右の端から、ボタンの列の左の端までの幅。 */
  zoomSpan: number;
}

/**
 * 全体図の置き場所（CSS の bottom・right）を決める。インスペクタを開いていれば、その上に全体図を持ち上げる。
 * 持ち上げた全体図が右上の拡大縮小のボタンの列にかかるとき（狭い画面）は、全体図をボタンの列の左に寄せる。
 *
 * @param r 測った大きさ
 * @returns bottom と right の値。空文字列は CSS の既定の位置のまま
 * @example
 * minimapPlace({ wrapH: 800, inspH: null, miniH: 114, zoomBottom: 160, zoomSpan: 46 }) // → { bottom: "", right: "" }
 * minimapPlace({ wrapH: 800, inspH: 200, miniH: 114, zoomBottom: 160, zoomSpan: 46 })  // → { bottom: "222px", right: "" }
 * minimapPlace({ wrapH: 600, inspH: 380, miniH: 114, zoomBottom: 160, zoomSpan: 46 })  // → { bottom: "402px", right: "54px" }（ボタンにかかる）
 */
export function minimapPlace(r: MiniRoom): { bottom: string; right: string } {
  if (r.inspH === null) return { bottom: "", right: "" };
  const bottom = r.inspH + ABOVE_INSPECTOR;
  const top = r.wrapH - bottom - r.miniH;
  const clash = r.miniH > 0 && top < r.zoomBottom + GAP;
  return { bottom: `${bottom}px`, right: clash ? `${r.zoomSpan + GAP}px` : "" };
}
