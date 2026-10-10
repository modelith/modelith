// UI ⇔ コア（Web Worker 内の wasm）間のメッセージ。LSP と同じ形にそろえる（ADR-0003）。
// P2 で wasm コアと接続する。型は将来 plugin-sdk の生成物に置き換える。

/** LSP の Position と同じく 0 始まり、列は UTF-16 コード単位。 */
export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

/** 図の操作を含むすべての変更はテキスト編集として表す（ADR-0001）。 */
export interface TextEdit {
  range: Range;
  newText: string;
}

/** テキストに編集を適用する。編集同士の範囲は重ならない前提。 */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);
  const offset = ({ line, character }: Position): number => {
    const start = lineStarts[line];
    if (start === undefined) throw new RangeError(`line ${line} is out of range`);
    return start + character;
  };
  return [...edits]
    .map((e) => ({ from: offset(e.range.start), to: offset(e.range.end), text: e.newText }))
    .sort((a, b) => b.from - a.from)
    .reduce((t, e) => t.slice(0, e.from) + e.text + t.slice(e.to), text);
}
