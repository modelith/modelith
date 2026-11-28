// 他のアプリでのファイルの変更の知らせ（F-FILE-8・F-FILE-18）。知らせる文を決めるだけの純粋関数。
// 変更を確かめるのは Workspace、トーストとダイアログを出すのは files.ts が行う。

import { t } from "../l10n";

/** 知らせに名前を並べるファイルの数の上限（超えた分は「ほか N 件」にまとめる）。 */
export const MAX_NAMES = 3;

/**
 * ファイル名を「」で囲んで並べる。上限を超えた分は「ほか N 件」にまとめる。
 *
 * @param names ファイル名
 * @param max 並べる数の上限
 * @returns 並べた文字列
 * @example
 * nameList(["a.sysml", "b.sysml"])                        // → "「a.sysml」「b.sysml」"
 * nameList(["a.sysml", "b.sysml", "c.sysml", "d.sysml"]) // → "「a.sysml」「b.sysml」「c.sysml」ほか 1 件"
 */
export function nameList(names: readonly string[], max = MAX_NAMES): string {
  const shown = names.slice(0, max).map((n) => t("app-files-quoted-name", { name: n })).join("");
  return names.length > max ? t("app-files-names-and-more", { names: shown, count: String(names.length - max) }) : shown;
}

/**
 * 画面に戻ったときに、他のアプリで変わった・消されたファイルをまとめて知らせる文（F-FILE-8）。表示中のファイルに限らず、開いているファイルすべてが対象。
 *
 * @param reloaded 読み直したファイルの名前（未保存の変更が無かったもの）
 * @param stale 今回初めて印を付けたファイルの名前（未保存の変更があり、読み直していないもの）
 * @param removed 消されていたファイルの名前（内容を残して、保存先の無いファイルにしたもの）
 * @returns 知らせる文（読み直した・印を付けた・消されたの順に「。」でつなぐ）。どれも無ければ null
 * @example
 * externalNotice(["a.sysml"], [], [])  // → "他のアプリで変更された「a.sysml」を読み直しました"
 * externalNotice([], ["b.sysml"], [])  // → "「b.sysml」は他のアプリで変更されています。未保存の変更があるため読み直していません。保存するときに選べます"
 * externalNotice([], [], ["c.sysml"])  // → "「c.sysml」は他のアプリで削除されたか、移動されました。内容は画面に残しています。残すには保存してください"
 * externalNotice([], [], [])           // → null
 */
export function externalNotice(reloaded: readonly string[], stale: readonly string[], removed: readonly string[]): string | null {
  const parts = [
    reloaded.length ? t("app-files-external-reloaded", { names: nameList(reloaded) }) : null,
    stale.length ? t("app-files-external-stale", { names: nameList(stale) }) : null,
    removed.length ? t("app-files-external-removed", { names: nameList(removed) }) : null,
  ].filter((p) => p !== null);
  return parts.length ? parts.reduce((first, next) => t("app-files-external-joined", { first, next })) : null;
}

/**
 * 編集し始めたファイルが他のアプリで変わっていたときに、どうするかを尋ねる文（F-FILE-18）。
 *
 * @param name ファイル名
 * @returns ダイアログの本文
 * @example
 * editStartText("a.sysml")
 * // → "「a.sysml」は開いた後に他のアプリで変更されています。ファイルの内容を読み込みますか？ 読み込むと、いま入力した変更は消えます。このまま編集すると、保存するときに上書きするかを選べます。"
 */
export function editStartText(name: string): string {
  return t("app-files-edit-start-text", { name });
}
