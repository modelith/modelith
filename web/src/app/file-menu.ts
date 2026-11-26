// ファイルの一覧の右クリックのメニュー（F-FILE-19）。どの項目を並べるかと、削除を確かめる文を決めるだけの純粋関数。
// メニューを開き、項目の操作を行うのは files.ts。

import { t } from "../l10n";

/** メニューの項目の操作。 */
export type FileMenuAction = "open" | "newFile" | "newFolder" | "rename" | "delete" | "copyPath" | "copyRelative";

/** 右クリックしたもの（ファイル・フォルダ・開いたフォルダそのもの）。 */
export type FileMenuTarget = "file" | "dir" | "root";

/** 項目の並び（null は区切り線）。 */
const ITEMS: Record<FileMenuTarget, readonly (FileMenuAction | null)[]> = {
  file: ["open", null, "rename", "delete", null, "copyPath", "copyRelative"],
  dir: ["newFile", "newFolder", null, "rename", "delete", null, "copyPath", "copyRelative"],
  root: ["newFile", "newFolder", null, "copyPath"],
};

/** 項目の名前。 */
export const FILE_MENU_LABEL: Record<FileMenuAction, string> = {
  open: t("app-files-menu-open"),
  newFile: t("app-files-menu-new-file"),
  newFolder: t("app-files-menu-new-folder"),
  rename: t("app-files-menu-rename"),
  delete: t("app-files-menu-delete"),
  copyPath: t("app-files-menu-copy-path"),
  copyRelative: t("app-files-menu-copy-relative"),
};

/**
 * 右クリックしたものに出すメニューの項目を、並べる順に返す。開いたフォルダそのものは、名前の変更・削除・相対パスのコピーを出さない。
 *
 * @param target 右クリックしたもの
 * @returns 項目の操作（null は区切り線）
 * @example
 * fileMenuItems("file") // → ["open", null, "rename", "delete", null, "copyPath", "copyRelative"]
 * fileMenuItems("root") // → ["newFile", "newFolder", null, "copyPath"]
 */
export function fileMenuItems(target: FileMenuTarget): readonly (FileMenuAction | null)[] {
  return ITEMS[target];
}

/**
 * 未保存の変更のあるファイルも閉じ、その変更が失われることを伝える文。
 *
 * @param unsaved 未保存の変更のある、開いているファイルの名前（1 つ以上）
 * @returns 削除を確かめる文に添える文
 * @example
 * unsavedLost(["b.sysml"])            // → "未保存の変更のある「b.sysml」も閉じ、変更は失われます。"
 * unsavedLost(["a.sysml", "b.sysml"]) // → "未保存の変更のある「a.sysml」「b.sysml」も閉じ、変更は失われます。"
 */
function unsavedLost(unsaved: readonly string[]): string {
  return t("app-files-delete-unsaved-lost", { names: unsaved.map((name) => t("app-files-quoted-name", { name })).join("") });
}

/**
 * 削除を確かめる文（F-FILE-19）。消すものの名前と、元に戻せないこと、一緒に消えるもの・失われる未保存の変更を示す。
 *
 * @param name 消すものの名前
 * @param isDir フォルダなら true
 * @param unsaved 未保存の変更のある、開いているファイルの名前（消すものの中にあるもの）
 * @param layoutName 一緒に消す配置ファイルの名前（モデルのファイルで、配置ファイルがあるとき。無ければ null）
 * @returns ダイアログの本文
 * @example
 * deleteText("a.sysml", false, [], "a.layout.json")
 * // → "「a.sysml」を削除しますか？ 図の配置のファイル（a.layout.json）も削除します。削除したものは元に戻せません。"
 * deleteText("models", true, ["b.sysml"], null)
 * // → "フォルダ「models」を中身ごと削除しますか？ 未保存の変更のある「b.sysml」も閉じ、変更は失われます。削除したものは元に戻せません。"
 */
export function deleteText(name: string, isDir: boolean, unsaved: readonly string[], layoutName: string | null): string {
  const ask = isDir ? t("app-files-delete-ask-folder", { name }) : t("app-files-delete-ask-file", { name });
  const notes: string[] = [];
  if (layoutName) notes.push(t("app-files-delete-with-layout", { layout: layoutName }));
  if (unsaved.length) notes.push(unsavedLost(unsaved));
  notes.push(t("app-files-delete-irreversible"));
  return `${ask} ${notes.join("")}`;
}

/**
 * 開いているフォルダを中身ごと削除するときの、1 回目の確かめの文（F-PROJ-4）。消えるものと、元に戻せないこと、失われる未保存の変更を示す。
 *
 * @param name フォルダの名前
 * @param unsaved 未保存の変更のある、開いているファイルの名前（フォルダの中のもの）
 * @returns ダイアログの本文
 * @example
 * deleteFolderText("project", [])
 * // → "フォルダ「project」を、中のすべてのファイルごとパソコンから削除しますか？ モデルのファイル以外（画像・文書など）も消えます。削除したものは元に戻せません。"
 */
export function deleteFolderText(name: string, unsaved: readonly string[]): string {
  const lost = unsaved.length ? unsavedLost(unsaved) : "";
  return t("app-files-delete-folder-ask", { name }) + lost + t("app-files-delete-irreversible");
}
