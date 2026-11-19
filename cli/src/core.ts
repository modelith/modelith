// コアと、プロジェクトの読み込みの「口」（ポート）。道具（tools.ts）はこの形だけに頼り、wasm やファイルの読み方を知らない。
// 出力の型は plugin-sdk の契約（ADR-0024 の 2）。web にあるコピーを、型としてだけ使う（実行時には読み込まない）。

import type { ElementDetail, ProblemReport, ProjectOutline } from "../../web/src/plugins/generated/protocol.ts";

export type {
  DiagramSummary, ElementDetail, ElementSummary, ProblemReport, ProjectFile, ProjectOutline,
} from "../../web/src/plugins/generated/protocol.ts";

/** モデルのファイル 1 つ。 */
export interface SourceFile {
  /** プロジェクトのフォルダからのパス（`/` 区切り）。 */
  path: string;
  /** ファイルのテキスト全体。 */
  text: string;
}

/** 読めなかったファイル 1 つ（黙って飛ばさず、問題一覧で知らせる）。 */
export interface UnreadableFile {
  /** プロジェクトのフォルダからのパス（`/` 区切り）。 */
  path: string;
  /** 読めなかった理由。 */
  reason: string;
}

/** 読み込んだプロジェクト（コアに渡す材料）。 */
export interface ProjectInput {
  /** モデルのファイル（パスの順）。 */
  files: SourceFile[];
  /** 読めなかったモデルのファイル。 */
  unreadable: UnreadableFile[];
  /** プロジェクトの設定ファイル（modelith.json）のテキスト。無ければ undefined。 */
  projectFile?: string;
  /** プラグインのファイル（プラグインの ID → プラグインのフォルダからの相対パス → テキスト）。 */
  pluginFiles: Record<string, Record<string, string>>;
}

/** コアの読む操作（ADR-0024 の 1）。 */
export interface Core {
  /** プロジェクトの概要（ファイル・要素・図）。 */
  outline(files: SourceFile[]): ProjectOutline;
  /** 修飾名で指した要素の詳細。無ければ null。 */
  element(files: SourceFile[], qualifiedName: string): ElementDetail | null;
  /** 問題一覧（設定ファイル・プラグインの読み込み・モデル・チェックルール）。 */
  problems(project: ProjectInput): ProblemReport[];
}

/** プロジェクトを読む口。道具を呼ぶたびに読み直すので、ほかのアプリでの変更もその場で見える。 */
export interface ProjectReader {
  /** プロジェクトを読む。フォルダが読めなければ例外で拒否する。 */
  read(): Promise<ProjectInput>;
}
