// 名前を変えたときの知らせの文（F-EDIT-3。#266）。

/**
 * 文字列の中に、部分の文字列がいくつあるか（重ならない数え方）。
 *
 * @param s 調べる文字列
 * @param part 数える文字列（空なら 0）
 * @returns 出てくる数
 * @example
 * occurrences("a b a", "a") // → 2
 * occurrences("abc", "")    // → 0
 */
function occurrences(s: string, part: string): number {
  return part ? s.split(part).length - 1 : 0;
}

/**
 * 名前を変えたときのトーストの文。名前の宣言のほかにも書き換えた箇所があるときだけ、「使っている箇所も変えました」と添える
 * （置いた直後の仮の名前を変えたときなどに、まだ無い参照の話をしない）。
 *
 * @param oldName 変える前の名前
 * @param newName 変えた後の名前
 * @param before 変える前のテキスト
 * @param after 変えた後のテキスト
 * @returns トーストの文
 * @example
 * renamedMessage("A", "B", "part def A; part a : A;", "part def B; part a : B;")
 * // → "「A」を「B」に変更しました。このファイルの中で使っている箇所も変えました"
 * renamedMessage("NewPart", "Lamp", "part def NewPart;", "part def Lamp;")
 * // → "「NewPart」を「Lamp」に変更しました"
 */
export function renamedMessage(oldName: string, newName: string, before: string, after: string): string {
  const head = `「${oldName}」を「${newName}」に変更しました`;
  return occurrences(after, newName) - occurrences(before, newName) > 1 ? `${head}。このファイルの中で使っている箇所も変えました` : head;
}
