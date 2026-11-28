// 名前を変えたときの知らせの文（F-EDIT-3。#266）。

import { t } from "../l10n";
import { nameList } from "./external-change";

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
 * @param others 参照を書き換えた、ほかのファイルの名前（ADR-0021。無ければ空）
 * @returns トーストの文。ほかのファイルも書き換えたときは、その名前と、未保存であることを示す
 * @example
 * renamedMessage("A", "B", "part def A; part a : A;", "part def B; part a : B;")
 * // → "「A」を「B」に変更しました。このファイルの中で使っている箇所も変えました"
 * renamedMessage("NewPart", "Lamp", "part def NewPart;", "part def Lamp;")
 * // → "「NewPart」を「Lamp」に変更しました"
 * renamedMessage("A", "B", "part def A;", "part def B;", ["app.sysml"])
 * // → "「A」を「B」に変更しました。「app.sysml」で使っている箇所も変えました。「app.sysml」は未保存です"
 */
export function renamedMessage(oldName: string, newName: string, before: string, after: string, others: readonly string[] = []): string {
  if (others.length) return t("app-inspect-renamed-across-files", { oldName, newName, files: nameList(others) });
  return occurrences(after, newName) - occurrences(before, newName) > 1
    ? t("app-inspect-renamed-with-uses", { oldName, newName })
    : t("app-inspect-renamed", { oldName, newName });
}
