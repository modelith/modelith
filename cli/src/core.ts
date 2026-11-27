// コアと、プロジェクトの読み込みの「口」（ポート）。道具（tools.ts）はこの形だけに頼り、wasm やファイルの読み方を知らない。
// 出力の型は plugin-sdk の契約（ADR-0024 の 2）。web にあるコピーを、型としてだけ使う（実行時には読み込まない）。

import type { EditProposal, EditRequest, ElementDetail, ProblemReport, ProjectOutline } from "../../web/src/plugins/generated/protocol.ts";

export type {
  DiagramSummary, EditProposal, EditRequest, ElementDetail, ElementSummary, FileChange, ProblemReport, ProjectFile, ProjectOutline, TextEdit,
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
  /** 図の配置のファイル（モデルのファイルのパス → 隣の配置ファイルのテキスト）。無いファイルは入らない。省いたら、配置は無いものとする。 */
  layouts?: Record<string, string>;
}

/** 書き出す図の指定。 */
export interface DiagramRequest {
  /** 図のあるモデルのファイル（プロジェクトのフォルダからのパス）。 */
  file: string;
  /** テキストに書いた図（view）の名前。省いたら、auto の自動の図。 */
  view?: string;
  /** 自動の図の ID（all・structure・trace・control・behavior）。view と subject を省いたときに使う。 */
  auto?: string;
  /** 対象を取る自動の図（内部ブロック図・状態遷移図・アクティビティ図・シーケンス図）の、対象の要素。 */
  subject?: {
    /** 対象の修飾名（失敗の文に使う）。 */
    qualifiedName: string;
    /** 図の ID（ibd・stm・afv・seq）。 */
    view: SubjectView;
    /** 対象の宣言の始まり（0 始まりの行と、UTF-16 の列。file の中の位置）。 */
    start: { line: number; character: number };
  };
  /** 書き出す形式。 */
  format: "svg" | "drawio";
}

/** 書き出した図。 */
export interface DiagramOutput {
  /** 図の中身（SVG、または draw.io の XML）。 */
  content: string;
  /** 配置ファイルが読めなかったときの理由（そのときは、配置なしで自動に並べている）。 */
  layoutProblem?: string;
}

/** 図を書き出す口（ADR-0024 の 3：画面と同じ配置と描画を使う）。ファイルには触れない。 */
export interface Renderer {
  /** 図を書き出す。その図が無いときは Refused を投げる。 */
  render(project: ProjectInput, request: DiagramRequest): DiagramOutput;
}

/** PNG にした図。 */
export interface PngImage {
  /** PNG のファイルの中身。 */
  data: Uint8Array;
  /** 幅（ピクセル）。 */
  width: number;
  /** 高さ（ピクセル）。 */
  height: number;
  /** 同梱のフォントに形が無く、描けなかった文字（つなげた文字列。無ければ空）。 */
  missing: string;
}

/** SVG の図を PNG の画像にする口（ADR-0029：ブラウザを使わず、同梱のフォントで描く）。ファイルには触れない。 */
export interface Rasterizer {
  /** SVG を、倍率を掛けた大きさの PNG にする（背景は白）。画像にできないときは Refused を投げる。 */
  png(svg: string, scale: number): PngImage;
}

/** コアが、編集の意図を当てられないと断ったこと（理由は message。指す要素が無い・名前が使えないなど）。 */
export class Refused extends Error {}

/** コアの操作（ADR-0024 の 1）。どれもファイルに触れない。 */
export interface Core {
  /** コアの版（本体の版と同じ。AI のクライアントに名乗る）。 */
  version(): string;
  /** プロジェクトの概要（ファイル・要素・図）。 */
  outline(files: SourceFile[]): ProjectOutline;
  /** 修飾名で指した要素の詳細。無ければ null。 */
  element(files: SourceFile[], qualifiedName: string): ElementDetail | null;
  /** 問題一覧（設定ファイル・プラグインの読み込み・モデル・チェックルール）。 */
  problems(project: ProjectInput): ProblemReport[];
  /** 編集の意図を当てた提案（差分と、当てたあとの問題一覧）。何も書かない。当てられないときは Refused を投げる。 */
  propose(project: ProjectInput, request: EditRequest): EditProposal;
}

/** プロジェクトを読む口。道具を呼ぶたびに読み直すので、ほかのアプリでの変更もその場で見える。 */
export interface ProjectReader {
  /** プロジェクトを読む。フォルダが読めなければ例外で拒否する。 */
  read(): Promise<ProjectInput>;
}

/** プロジェクトに書く口。書けるのは、プロジェクトのモデルのファイルだけ。 */
export interface ProjectWriter {
  /** モデルのファイルを書き換える。書けなければ例外で拒否する。 */
  write(path: string, text: string): Promise<void>;
}

/** 書き込みを待っている提案 1 つ（ファイルごとの、前提の版と書き込むテキスト）。 */
export interface PendingProposal {
  files: { path: string; baseVersion: string; text: string }[];
}

/** 提案を、書き込むまで覚えておく口。 */
export interface ProposalStore {
  /** 提案を覚え、あとで指すための ID を返す。 */
  add(proposal: PendingProposal): string;
  /** ID の提案を取り出して忘れる（同じ提案を 2 回書き込まない）。無ければ undefined。 */
  take(id: string): PendingProposal | undefined;
}

/** 対象を取る自動の図の ID（内部ブロック図・状態遷移図・アクティビティ図・シーケンス図）。 */
export type SubjectView = "ibd" | "stm" | "afv" | "seq";
