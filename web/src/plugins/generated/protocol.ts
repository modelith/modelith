// plugin-sdk の packages/typescript/src/generated/protocol.ts のコピー。編集しないこと。
// 取得元: git+https://github.com/modelith/plugin-sdk?rev=ec82cf626994648ffc4d9564a7ed44b9bd209c2d#ec82cf626994648ffc4d9564a7ed44b9bd209c2d
// 更新: Cargo.toml の plugin-sdk の rev を変えてから node web/tools/plugin-protocol-cli.ts sync（scripts/check.sh が古さを検出する）

// 生成物。編集しないこと。定義元: crates/modelith-plugin-protocol
// 再生成: UPDATE_GENERATED=1 cargo test -p modelith-plugin-protocol --test generated

export const API_VERSION = "0";
export const PLUGIN_ID_PATTERN = "^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)+$";
export const RULE_ID_PATTERN = "^[a-z0-9][a-z0-9-]*$";
export const USAGE_SCHEMA_VERSION = 1;
export const COUNT_MAX = 10000;

export type PluginId = string;

export type Position = { line: number, character: number, };

export type Range = { start: Position, end: Position, };

export type TextEdit = { range: Range, newText: string, };

export type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

export type Diagnostic = { range: Range, severity: DiagnosticSeverity, message: string, 
/**
 * ルール ID など。
 */
code?: string, 
/**
 * 報告元のプラグイン ID など。
 */
source?: string, };

export type Runtime = "rules" | "browser" | "wasm-component";

export type Permission = "model:read" | "edits:propose" | "network" | "storage";

export type Importer = { id: string, label: string, 
/**
 * 対応する拡張子（例: `.reqif`）。
 */
extensions: Array<string>, };

export type Exporter = { id: string, label: string, 
/**
 * 出力ファイルの拡張子（例: `.drawio`）。
 */
extension: string, };

export type View = { id: string, label: string, };

export type PaletteItem = { id: string, label: string, 
/**
 * 配置時に挿入する SysML v2 テキストの雛形。
 */
snippet: string, };

export type Command = { id: string, title: string, };

export type Contributes = { 
/**
 * 検査ルールのファイル（YAML）。
 */
rules?: Array<string>, importers?: Array<Importer>, exporters?: Array<Exporter>, views?: Array<View>, palette?: Array<PaletteItem>, commands?: Array<Command>, };

export type Engines = { 
/**
 * Modelith の版の範囲。比べる記号と版をカンマで区切って並べる（Cargo の版の指定と同じ書き方。例: `">=0.1.0, <0.3.0"`・`"^0.2"`・`"0.2.x"`・`"*"`）。
 * 桁を `x`・`X`・`*` にすると、その桁から後ろを書かなかったのと同じ。版に付けたプレリリースとビルドの印（`-beta.1`・`+b5`）は比べるときに外す。
 * 本体も、自分の版からプレリリースの印を外して比べる（`0.2.0-beta.1` の本体は `0.2.0` として扱う）。
 */
modelith: string, };

export type PluginManifest = { id: PluginId, 
/**
 * 表示名。
 */
name: string, 
/**
 * プラグイン自身のバージョン（SemVer）。
 */
version: string, 
/**
 * 対象とするプラグイン API のメジャーバージョン（plugin-sdk のメジャーバージョン）。
 */
apiVersion: string, runtime: Runtime, description?: string, 
/**
 * 作者の名前。権限を許可する画面などに出す。
 */
author?: string, 
/**
 * SPDX ライセンス式。
 */
license: string, 
/**
 * 動く本体の版の範囲。書かなければ、どの版の本体でも動かす。
 */
engines?: Engines, 
/**
 * エントリポイント。`rules` では不要。
 * - `browser`: 1 つのファイルにまとめた従来型のスクリプト（例: ESM を IIFE にまとめたもの）。
 *   モジュール形式（`import` / `export` を含むもの）は Chromium のサンドボックス化した iframe の中で動かせない（ADR-0018 §3.1）。
 * - `wasm-component`: .wasm ファイル。
 */
main?: string, 
/**
 * 要求する権限。宣言していない操作はホストが拒否する。
 */
permissions?: Array<Permission>, contributes?: Contributes, };

export type Publisher = { name: string, 
/**
 * GitHub のユーザー名または組織名。
 */
github: string, };

export type Pricing = "free" | "paid";

export type RegistryVersion = { version: string, 
/**
 * 配布物の URL。
 */
url: string, 
/**
 * 配布物の SHA-256（16 進小文字）。
 */
sha256: string, 
/**
 * 配布物の署名。
 */
signature?: string, };

export type RegistryEntry = { id: PluginId, name: string, publisher: Publisher, 
/**
 * ソースリポジトリの URL。
 */
repository: string, apiVersion: string, runtime: Runtime, 
/**
 * SPDX ライセンス式。
 */
license: string, pricing: Pricing, versions: Array<RegistryVersion>, };

export type RuleId = string;

export type OneOrMany = string | Array<string>;

export type CountRange = { min?: number, max?: number, };

export type Requirement = { 
/**
 * この種類の関係（例: `satisfy`）を 1 本以上受ける。並びはいずれかでよい。
 */
incoming?: OneOrMany, 
/**
 * この種類の関係（例: `derivation`）を 1 本以上出す。並びはいずれかでよい。
 */
outgoing?: OneOrMany, 
/**
 * 要素名がこの正規表現に当たる。
 */
name?: string, 
/**
 * `true` なら工程（`@Phase`）を持つ、`false` なら持たない。
 */
phase?: boolean, 
/**
 * ポートの数。
 */
ports?: CountRange, 
/**
 * 同じ形の条件の否定（満たさないこと）。
 */
not?: Requirement, };

export type ElementMatch = { 
/**
 * 要素の種類（例: `requirement def`）。並びはいずれかに当たればよい。
 */
kind: OneOrMany, 
/**
 * 工程（`@Phase`）の名前（例: `SystemRequirements`）。
 */
phase?: string, 
/**
 * 要素名の正規表現。
 */
name?: string, };

export type Rule = { 
/**
 * プラグインの中で一意な ID。診断の `code` になる。
 */
id: RuleId, severity: DiagnosticSeverity, 
/**
 * 診断のメッセージ。`{name}`（要素名）と `{kind}`（要素の種類）を差し込める。
 */
message: string, 
/**
 * ルールを当てる要素。
 */
match: ElementMatch, 
/**
 * 当たった要素が満たすべき条件。
 */
require: Requirement, };

export type RuleSet = { rules: Array<Rule>, };

export type PortDirection = "in" | "out" | "inout";

export type ModelPort = { name: string, 
/**
 * ポートの型の名前。型を書いていなければ省く。
 */
type?: string, 
/**
 * 向き。書いていなければ省く。
 */
direction?: PortDirection, };

export type ModelElement = { 
/**
 * 要素を指す鍵。`ModelRelation` の `from` / `to` はこの値を使う。
 */
key: string, name: string, 
/**
 * 要素の種類（例: `part def`）。検査ルールの `match.kind` と同じ言葉。
 */
kind: string, 
/**
 * 工程（`@Phase`）の名前。
 */
phase?: string, ports: Array<ModelPort>, 
/**
 * テキスト上の位置。
 */
range: Range, };

export type RelationKind = "satisfy" | "verify" | "frame" | "derivation" | "flow";

export type ModelRelation = { id: string, kind: RelationKind, 
/**
 * 出る側の要素の `key`。
 */
from: string, 
/**
 * 受ける側の要素の `key`。
 */
to: string, };

export type ModelSnapshot = { elements: Array<ModelElement>, relations: Array<ModelRelation>, };

export type NotifyLevel = "info" | "warning" | "error";

export type HostMessage = { "type": "activate", apiVersion: string, pluginId: PluginId, 
/**
 * プロジェクトの設定（`modelith.json` の `plugins.<id>.settings`）。形はプラグインが決める。無ければ省く。
 */
settings?: unknown, } | { "type": "didChange", 
/**
 * テキストの版。診断や変更案は、どの版に対するものかをこの値で示す。
 */
version: number, text: string, 
/**
 * 解析結果。マニフェストで `model:read` を宣言したときだけ送る。
 */
model?: ModelSnapshot, } | { "type": "runCommand", requestId: number, command: string, } | { "type": "import", requestId: number, importer: string, fileName: string, 
/**
 * ファイルの中身（base64）。
 */
base64: string, } | { "type": "export", requestId: number, exporter: string, 
/**
 * 表示中の図の名前。無ければモデル全体。
 */
view?: string, } | { "type": "storageResult", requestId: number, 
/**
 * `storageGet` で読んだ値。無ければ省く。
 */
value?: unknown, };

export type PluginMessage = { "type": "ready" } | { "type": "diagnostics", version: number, items: Array<Diagnostic>, } | { "type": "proposeEdits", version: number, edits: Array<TextEdit>, 
/**
 * 「元に戻す」に出す名前。
 */
label?: string, } | { "type": "commandDone", requestId: number, } | { "type": "imported", requestId: number, fileName: string, text: string, } | { "type": "exported", requestId: number, fileName: string, mediaType: string, 
/**
 * ファイルの中身（base64）。
 */
base64: string, } | { "type": "failed", requestId: number, message: string, } | { "type": "storageGet", requestId: number, key: string, } | { "type": "storageSet", requestId: number, key: string, value: unknown, } | { "type": "notify", level: NotifyLevel, message: string, };

export type ProjectFile = { 
/**
 * プロジェクトのフォルダからのパス（`/` 区切り）。
 */
path: string, };

export type ElementSummary = { 
/**
 * 修飾名（例: `Shop::Cart`）。
 */
qualifiedName: string, name: string, 
/**
 * 短い名前（`<C1>`）。書いていなければ省く。
 */
shortName?: string, 
/**
 * 要素の種類（例: `part def`）。[`crate::ModelElement`] の `kind` と同じ言葉。
 */
kind: string, 
/**
 * 要素を書いたファイル（[`ProjectFile`] の `path`）。
 */
file: string, 
/**
 * テキスト上の位置。
 */
range: Range, };

export type RelationDirection = "outgoing" | "incoming";

export type ElementRelation = { 
/**
 * 関係の種類。今の言葉は次の 13 個（一般の図に出る関係）。
 * - [`crate::RelationKind`] と同じもの: `satisfy`・`verify`・`frame`・`derivation`・`flow`
 * - それ以外: `composition`（部品として持つ）・`definedBy`（用法 → その型の定義）・`allocate`・
 *   `dependency`・`specialize`・`subset`・`redefine`・`reference`
 *
 * 送り手が種類を足しても古い受け手が拒まないよう、列挙にせず文字列のままにする。
 * 受け手は、知らない言葉の関係を「そのほかの関係」として扱う。
 */
kind: string, direction: RelationDirection, 
/**
 * 相手の要素の修飾名。
 */
other: string, };

export type ElementDetail = { 
/**
 * 説明（`doc`）。書いていなければ省く。
 */
doc?: string, 
/**
 * 型の名前（書かれたまま）。書いていなければ省く。
 */
type?: string, 
/**
 * 工程（`@Phase`）の名前。
 */
phase?: string, 
/**
 * 直下の要素（属性・部品・ポートなど）。
 */
members: Array<ElementSummary>, ports: Array<ModelPort>, 
/**
 * この要素から出る関係と、この要素に入る関係。
 */
relations: Array<ElementRelation>, 
/**
 * 修飾名（例: `Shop::Cart`）。
 */
qualifiedName: string, name: string, 
/**
 * 短い名前（`<C1>`）。書いていなければ省く。
 */
shortName?: string, 
/**
 * 要素の種類（例: `part def`）。[`crate::ModelElement`] の `kind` と同じ言葉。
 */
kind: string, 
/**
 * 要素を書いたファイル（[`ProjectFile`] の `path`）。
 */
file: string, 
/**
 * テキスト上の位置。
 */
range: Range, };

export type DiagramSummary = { name: string, qualifiedName: string, 
/**
 * 図の種類。view の型の名前（例: `GeneralView`・`InterconnectionView`）。
 */
kind: string, file: string, range: Range, };

export type ProjectOutline = { files: Array<ProjectFile>, 
/**
 * 定義と用法（入れ子の要素も含む）。
 */
elements: Array<ElementSummary>, 
/**
 * テキストに書いた図（view）。
 */
diagrams: Array<DiagramSummary>, };

export type ProblemReport = { 
/**
 * 問題のあるファイル。
 */
file: string, diagnostic: Diagnostic, };

export type EditRequest = { "type": "addElement", 
/**
 * 要素の種類（例: `part def`）。[`crate::ElementSummary`] の `kind` と同じ言葉。
 */
kind: string, name: string, 
/**
 * 入れる先の要素の修飾名（package に限らない。受けない先は、書く側が断る）。
 */
parent: string, } | { "type": "addRelation", 
/**
 * 関係の種類。[`crate::ElementRelation`] の `kind` と同じ言葉。
 */
kind: string, 
/**
 * 関係が出る側の要素の修飾名（[`crate::RelationDirection::Outgoing`] の側）。
 */
from: string, 
/**
 * 関係が入る側の要素の修飾名。
 */
to: string, } | { "type": "rename", element: string, name: string, } | { "type": "delete", element: string, } | { "type": "setDoc", element: string, doc: string, } | { "type": "replaceText", 
/**
 * プロジェクトのフォルダからのパス（`/` 区切り）。
 */
file: string, text: string, };

export type FileChange = { 
/**
 * プロジェクトのフォルダからのパス（`/` 区切り）。
 */
file: string, 
/**
 * `edits` が前提にするテキストの版。中身は決めない文字列で、作った側が書き込むときに今の版と比べる。
 */
baseVersion: string, 
/**
 * 当てる編集（位置は `baseVersion` のテキストのもの）。
 */
edits: Array<TextEdit>, };

export type EditProposal = { 
/**
 * ファイルごとの差分。
 */
changes: Array<FileChange>, 
/**
 * 提案を当てたあとの、プロジェクトの問題の一覧。
 */
problems: Array<ProblemReport>, };

export type Count = number;

export type Channel = "stable" | "rc" | "preview";

export type Client = "web" | "server";

export type Sender = { client: Client, 
/**
 * 送り手の版（SemVer。例: `0.2.0-rc.1`）。
 */
appVersion: string, channel: Channel, };

export type SendLevel = "all" | "errorsOnly";

export type Browser = "chrome" | "edge" | "firefox" | "safari" | "other";

export type Os = "windows" | "macos" | "linux" | "android" | "ios" | "other";

export type ScreenClass = "phone" | "tablet" | "desktop";

export type Language = "ja" | "en" | "other";

export type OnboardingStep = "sampleOpened" | "textWritten" | "diagramOpened" | "edited" | "viewCreated" | "saved" | "folderOpened";

export type DurationClass = "lt1s" | "1to3s" | "3to10s" | "ge10s";

export type SizeClass = "lt10kb" | "10to100kb" | "100kbTo1mb" | "ge1mb";

export type WeeksClass = "1" | "2to4" | "5to12" | "ge13";

export type AmountClass = "0" | "1" | "2to10" | "11to100" | "101to1000" | "ge1001";

export type StorageClass = "lt100mb" | "100mbTo1gb" | "1to10gb" | "ge10gb";

export type Deployment = "docker" | "binary";

export type LoginMethods = { 
/**
 * 管理者が作るアカウント（OIDC と併せた非常用の管理者を含む）。
 */
accounts: boolean, oidc: boolean, };

export type ParseDurationClass = "lt100ms" | "100to300ms" | "300msTo1s" | "1to3s" | "ge3s";

export type ErrorName = "error" | "typeError" | "rangeError" | "referenceError" | "syntaxError" | "notAllowedError" | "quotaExceededError" | "abortError" | "securityError" | "notFoundError" | "otherDomException" | "panic" | "other";

export type ErrorKind = "uncaughtError" | "unhandledRejection" | "wasmPanic";

export type AutoViews = { 
/**
 * トレーサビリティ。
 */
trace: Count, 
/**
 * ブロック定義図。
 */
structure: Count, 
/**
 * 制御ループ。
 */
control: Count, 
/**
 * 内部ブロック図。
 */
ibd: Count, 
/**
 * 振る舞い。
 */
behavior: Count, 
/**
 * シーケンス図。
 */
seq: Count, 
/**
 * アクティビティ図。
 */
afv: Count, 
/**
 * 状態遷移図。
 */
stm: Count, 
/**
 * すべて。
 */
all: Count, };

export type CreatedViews = { 
/**
 * GeneralView。
 */
general: Count, 
/**
 * InterconnectionView（内部ブロック図）。
 */
interconnection: Count, 
/**
 * ActionFlowView（アクティビティ図）。
 */
actionFlow: Count, 
/**
 * StateTransitionView（状態遷移図）。
 */
stateTransition: Count, 
/**
 * SequenceView（シーケンス図）。
 */
sequence: Count, 
/**
 * そのほかの view。
 */
other: Count, };

export type Edits = { addNode: Count, addUsage: Count, rename: Count, delete: Count, deleteEdge: Count, connect: Count, addMessage: Count, updateMessage: Count, moveMessage: Count, setPhase: Count, initPhases: Count, makePort: Count, setPortDir: Count, deletePort: Count, saveView: Count, addToView: Count, removeFromView: Count, renameView: Count, deleteView: Count, setAttribute: Count, removeAttribute: Count, setDoc: Count, undo: Count, redo: Count, };

export type Layout = { 
/**
 * 要素の移動。
 */
move: Count, 
/**
 * 線の調整。
 */
adjustEdge: Count, 
/**
 * 整列。
 */
align: Count, };

export type Saves = { 
/**
 * ブラウザの下書き。
 */
draft: Count, 
/**
 * ダウンロード。
 */
download: Count, 
/**
 * 手元のフォルダ（File System Access）。
 */
folder: Count, };

export type Exports = { svg: Count, png: Count, jpeg: Count, drawio: Count, 
/**
 * 画像のコピー。
 */
clipboard: Count, };

export type Checks = { runs: Count, 
/**
 * 問題が 0 件だった回数。
 */
noProblems: Count, 
/**
 * 1〜9 件だった回数。
 */
problems1To9: Count, 
/**
 * 10〜99 件だった回数。
 */
problems10To99: Count, 
/**
 * 100 件以上だった回数。
 */
problems100OrMore: Count, };

export type ParseTime = { fileSize: SizeClass, duration: ParseDurationClass, count: Count, };

export type StackFrame = { 
/**
 * 配信しているアプリのファイル（例: `assets/index-3f2a.js`）。利用者のファイルの名前は入らない。
 */
module: string, 
/**
 * 関数の名前（wasm の中のコアの関数。例: `modelith_core::edit::ops::rename`）。縮めた JS の関数名は送らない。
 */
function?: string, 
/**
 * 行（取れないときは省く）。
 */
line?: number, 
/**
 * 列（取れないときは省く）。
 */
column?: number, };

export type StartupReport = { schemaVersion: number, 
/**
 * 環境（任意）。環境は日に 1 回のまとめ（[`DailyReport`]）で送り、起動の報告では送らなくてよい。
 */
browser?: Browser, os?: Os, 
/**
 * 画面の幅の区分。
 */
screen?: ScreenClass, 
/**
 * 画面の表示の言語（BCP 47 の言語の部分）。
 */
language?: Language, 
/**
 * 手元のフォルダを開けるブラウザか（File System Access）。
 */
folderAccess?: boolean, 
/**
 * 起動にかかった時間の区分。
 */
startupTime: DurationClass, client: Client, 
/**
 * 送り手の版（SemVer。例: `0.2.0-rc.1`）。
 */
appVersion: string, channel: Channel, };

export type DailyReport = { schemaVersion: number, 
/**
 * 環境。日に 1 回なので、起動の回数ではなく使われた端末の数に近い分母になる（環境はここで送る）。
 * 型の上では任意（受け口は欠けた項目を読み飛ばす）。
 */
browser?: Browser, os?: Os, screen?: ScreenClass, language?: Language, folderAccess?: boolean, 
/**
 * その日に初めて起きた、使い始めの段階（同じ段階は 1 回だけ）。
 */
onboarding: Array<OnboardingStep>, 
/**
 * 自動の図の種類ごとの表示の回数。表示の回数は、図のタブを開いた・切り替えた回数（描き直しのたびではない）。
 */
autoViews: AutoViews, 
/**
 * 作成した図（テキストの view）の種類ごとの表示の回数。数え方は `auto_views` と同じ。view の名前は送らない。
 */
createdViews: CreatedViews, 
/**
 * 編集の意図（modelith-core の `Intent` の op）ごとの回数と、元に戻す・やり直す。
 */
edits: Edits, 
/**
 * 図の見た目だけを変える操作の回数（モデルは変わらない）。
 */
layout: Layout, 
/**
 * 保存先ごとの保存の回数。
 */
saves: Saves, 
/**
 * エクスポートの形式ごとの回数。
 */
exports: Exports, 
/**
 * チェックの実行。
 */
checks: Checks, 
/**
 * プラグインの機能（チェック・コマンド・エクスポートなど）を使った回数。どのプラグインかは送らない
 * （公開の登録簿ができるまで名前を入れない。入れるときは任意の項目として足す）。
 */
pluginUses: Count, 
/**
 * AI による書き換え（MCP）の回数。アプリが数えられるのは modelith 0.4.0 から。
 */
aiRewrites: Count, 
/**
 * 解析にかかった時間の区分ごとの回数（ファイルの大きさの区分ごと）。同じ組が 2 度あれば、受け口は足し合わせる。
 */
parseTimes: Array<ParseTime>, 
/**
 * wasm を読み込めなかった回数。
 */
wasmLoadFailures: Count, 
/**
 * コアを動かす Worker が止まり、作り直した回数。
 */
workerRestarts: Count, 
/**
 * このブラウザで使った週の数の区分（ID を持たずに、続けて使われているかを測る）。
 */
weeksUsed?: WeeksClass, 
/**
 * このブラウザで初めて使った四半期（`YYYY-Qn`。例: `2026-Q4`）。端末の手がかりにならないよう、月より粗くする。
 */
firstQuarter?: string, client: Client, 
/**
 * 送り手の版（SemVer。例: `0.2.0-rc.1`）。
 */
appVersion: string, channel: Channel, };

export type ErrorReport = { schemaVersion: number, 
/**
 * 送る段階（「すべて送る」と「エラーだけ」の比を数える）。
 */
level: SendLevel, errorKind: ErrorKind, 
/**
 * 例外の種類（JS のエラーの名前、DOMException の名前）。
 */
errorName: ErrorName, 
/**
 * スタックトレース（内側から外側へ）。送り手は、自分たちの配信物（アプリの `assets/` の JS と wasm）の段だけを入れ、
 * プラグインやブラウザの拡張など、ほかのコードの段は送らない（受け口は `module` の形しか確かめられない）。
 */
frames: Array<StackFrame>, client: Client, 
/**
 * 送り手の版（SemVer。例: `0.2.0-rc.1`）。
 */
appVersion: string, channel: Channel, };

export type ServerDailyReport = { schemaVersion: number, 
/**
 * 起動ごとに作るランダムな ID（UUID）。サーバに残す ID ではない。
 */
instanceId: string, os: Os, deployment: Deployment, 
/**
 * 有効なログインの方式（両方を有効にできる）。
 */
login: LoginMethods, 
/**
 * 利用者の数の区分。
 */
users: AmountClass, 
/**
 * 7 日以内に使った人の数の区分。
 */
activeUsers7d: AmountClass, 
/**
 * プロジェクトの数の区分。
 */
projects: AmountClass, 
/**
 * 保存容量の区分。
 */
storage: StorageClass, 
/**
 * プラグインの数の区分。
 */
plugins: AmountClass, client: Client, 
/**
 * 送り手の版（SemVer。例: `0.2.0-rc.1`）。
 */
appVersion: string, channel: Channel, };

export type UsageReport = { "kind": "startup" } & StartupReport | { "kind": "daily" } & DailyReport | { "kind": "error" } & ErrorReport | { "kind": "serverDaily" } & ServerDailyReport;
