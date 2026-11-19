// キーボード操作の判断（Q-8）。DOM には触れず、要素の数と位置から、次に入力を移す位置を決める。

/**
 * ダイアログの中で Tab を押したときに、入力を移す先を決める。端から外へ出ようとしたときだけ、反対の端へ回す。
 * それ以外はブラウザの順のままにする（null）。
 *
 * @param count ダイアログの中の、入力を受け取れる要素の数
 * @param current 今入力を受け取っている要素の位置（0 から。ダイアログの外にあれば -1）
 * @param backward Shift+Tab（前へ戻る）なら true
 * @returns 入力を移す要素の位置。ブラウザに任せてよいとき・要素が無いときは null
 * @example
 * wrapFocus(3, 2, false) // → 0（最後から次へ：先頭へ回す）
 * wrapFocus(3, 0, true)  // → 2（先頭から前へ：最後へ回す）
 * wrapFocus(3, 1, false) // → null（途中はブラウザの順のまま）
 * wrapFocus(3, -1, true) // → 2（外にあれば、向きに合わせて端へ入れる）
 * wrapFocus(0, -1, false) // → null（受け取れる要素が無い）
 */
export function wrapFocus(count: number, current: number, backward: boolean): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  if (current < 0 || current > last) return backward ? last : 0;
  if (!backward && current === last) return 0;
  if (backward && current === 0) return last;
  return null;
}

/**
 * ツリーの行のうち、Tab で入る行（tabindex="0" にする 1 行）を決める。選んでいる行があればその行、無ければ先頭の行にする（ARIA のツリーの型）。
 *
 * @param selected 行ごとの、選んでいるか（上から順）
 * @returns Tab で入る行の位置（0 から）。行が無ければ -1
 * @example
 * rovingStop([false, true, false]) // → 1（選んでいる行）
 * rovingStop([false, false])       // → 0（選んでいなければ先頭）
 * rovingStop([])                   // → -1（行が無い）
 */
export function rovingStop(selected: readonly boolean[]): number {
  if (!selected.length) return -1;
  return Math.max(0, selected.indexOf(true));
}

/**
 * 横に並んだタブで、矢印キー・Home・End を押したときに移る先を決める。左右の端では反対の端へ回る。
 *
 * @param count タブの数
 * @param current 今入力を受け取っているタブの位置（0 から）
 * @param key 押したキー（KeyboardEvent.key）
 * @returns 移る先のタブの位置。タブを移すキーでない・タブが無い・今の位置がタブの外なら null
 * @example
 * nextTabIndex(3, 0, "ArrowRight") // → 1
 * nextTabIndex(3, 2, "ArrowRight") // → 0（右端から先頭へ回る）
 * nextTabIndex(3, 0, "ArrowLeft")  // → 2（左端から最後へ回る）
 * nextTabIndex(3, 1, "End")        // → 2
 * nextTabIndex(3, 1, "Enter")      // → null（タブを移すキーでない）
 */
export function nextTabIndex(count: number, current: number, key: string): number | null {
  if (count <= 0 || current < 0 || current >= count) return null;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * メニューバー（ファイル・編集・表示…）でメニューを開いている間に、左右の矢印キーを押したときに移る先のメニューを決める（Q-9）。
 * 両端では反対の端へ回る。
 *
 * @param count メニューの数
 * @param current 今開いているメニューの位置（0 から）
 * @param key 押したキー（KeyboardEvent.key）
 * @returns 移る先のメニューの位置。左右の矢印キーでない・メニューが無い・今の位置がメニューの外なら null
 * @example
 * nextMenuIndex(6, 0, "ArrowRight") // → 1
 * nextMenuIndex(6, 5, "ArrowRight") // → 0（右端から先頭へ回る）
 * nextMenuIndex(6, 0, "ArrowLeft")  // → 5（左端から最後へ回る）
 * nextMenuIndex(6, 2, "Home")       // → null（メニューを移すキーでない）
 */
export function nextMenuIndex(count: number, current: number, key: string): number | null {
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  return nextTabIndex(count, current, key);
}

/**
 * 開いているメニューの中で、上下の矢印キーを押したときに移る先の項目を決める（Q-9）。押せない項目は飛ばし、両端では反対の端へ回る。
 *
 * @param usable 項目ごとの、押せるか（上から順。無効・隠れている項目は false）
 * @param current 今入力を受け取っている項目の位置（0 から。メニューの見出しにあれば -1）
 * @param key 押したキー（KeyboardEvent.key）
 * @returns 移る先の項目の位置。上下の矢印キーでない・押せる項目が無いなら null
 * @example
 * nextMenuItem([true, false, true], 0, "ArrowDown") // → 2（押せない項目を飛ばす）
 * nextMenuItem([true, true, true], 2, "ArrowDown")  // → 0（最後から先頭へ回る）
 * nextMenuItem([true, true, true], -1, "ArrowUp")   // → 2（見出しから上へ：最後の項目）
 * nextMenuItem([false, false], -1, "ArrowDown")     // → null（押せる項目が無い）
 */
export function nextMenuItem(usable: readonly boolean[], current: number, key: string): number | null {
  if (key !== "ArrowDown" && key !== "ArrowUp") return null;
  const count = usable.length;
  const step = key === "ArrowDown" ? 1 : -1;
  // 見出しから下へは先頭の項目から、上へは最後の項目から探す
  const start = current < 0 || current >= count ? (step > 0 ? -1 : count) : current;
  for (let i = 1; i <= count; i++) {
    const at = (((start + step * i) % count) + count) % count;
    if (usable[at]) return at;
  }
  return null;
}

/**
 * Space キーを、図を手のひらで動かす操作にするか（#235）。図の上か、どこにも入力が当たっていないときだけにし、
 * ボタン・メニュー・入力欄などでは、その部品の Space（押す・文字を打つ）を残す（Q-8）。
 *
 * @param tag 入力を受け取っている要素のタグ名（大文字。"BODY"・"BUTTON" など）
 * @param inCanvas その要素が図の領域の中か
 * @returns 図を動かす操作にするなら true
 * @example
 * spaceKeyPans("BODY", false)   // → true（どこにも入力が当たっていない）
 * spaceKeyPans("DIV", true)     // → true（図の上）
 * spaceKeyPans("BUTTON", false) // → false（ボタンを押す）
 * spaceKeyPans("SUMMARY", false) // → false（メニューを開く）
 */
export function spaceKeyPans(tag: string, inCanvas: boolean): boolean {
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return false;
  return inCanvas || tag === "BODY";
}

/**
 * 画面全体の近道（Ctrl+Z・Ctrl+Y・Ctrl+S・Ctrl+O・Ctrl+A）を、今の入力先で動かしてよいか（Q-8。#234）。
 * ダイアログを開いている間は、裏の画面を操作しないので動かさない。元に戻す・やり直す・すべて選ぶは、
 * 入力欄（テキストの入力・選択肢・複数行の欄）の中ではその欄のものなので動かさない。
 *
 * @param key 押したキー（小文字。"z"・"s" など）
 * @param inField 入力先が入力欄か
 * @param modal ダイアログを開いているか
 * @returns 画面全体の近道として動かすなら true
 * @example
 * globalShortcut("z", false, false) // → true（図の上で Ctrl+Z）
 * globalShortcut("z", true, false)  // → false（説明の入力欄の中。欄の中の取り消しにする）
 * globalShortcut("s", true, false)  // → true（テキスト欄でも保存はする）
 * globalShortcut("s", false, true)  // → false（ダイアログを開いている）
 */
export function globalShortcut(key: string, inField: boolean, modal: boolean): boolean {
  if (modal) return false;
  return !(inField && (key === "z" || key === "y" || key === "a"));
}

/**
 * 1 つの入力欄の中の、元に戻す・やり直すの記録（Q-8。#266）。
 * ブラウザの取り消しは、欄の中に戻すものが無いとページの別の欄（テキスト欄）の入力まで戻すため、欄の中の取り消しはこの記録で行う。
 *
 * @example
 * const h = new FieldHistory("a");
 * h.record("ab"); h.record("abc");
 * h.undo() // → "ab"
 * h.undo() // → "a"
 * h.undo() // → null（もう戻すものが無い。何もしない）
 * h.redo() // → "ab"
 */
export class FieldHistory {
  private past: string[] = [];
  private future: string[] = [];

  /**
   * 記録を、欄の最初の値で始める。
   *
   * @param current 欄の今の値
   */
  constructor(private current: string) {}

  /**
   * 欄の値が変わったことを記録する（同じ値なら記録しない）。やり直しの記録は捨てる。
   *
   * @param value 変わった後の値
   * @example
   * new FieldHistory("a").record("ab") // → 戻すと "a" になる
   */
  record(value: string): void {
    if (value === this.current) return;
    this.past.push(this.current);
    this.current = value;
    this.future = [];
  }

  /**
   * 1 つ前の値に戻す。
   *
   * @returns 戻した後の値。戻すものが無ければ null
   * @example
   * new FieldHistory("a").undo() // → null
   */
  undo(): string | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(this.current);
    this.current = prev;
    return prev;
  }

  /**
   * 戻した値をやり直す。
   *
   * @returns やり直した後の値。やり直すものが無ければ null
   * @example
   * new FieldHistory("a").redo() // → null
   */
  redo(): string | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.current);
    this.current = next;
    return next;
  }
}
