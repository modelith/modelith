// ビュー（図の種類）ごとに、モデルのどの要素・関係を表示するかを決める。画面の状態（S）には触れず、どの図かは ViewTarget で受け取る。
// 画面（views.ts）と、画面の外（Node）の図の書き出し（render/）で共用する（ADR-0024）。

import type { EdgeKind, Entry, Model, ModelEdge, ModelLane, ModelNode, ModelSequenceEvent, ModelView, ViewKind } from "../core";
import { defaultFlowContext, flowContentOf, flowContexts, flowLayers } from "./action-flow";
import { ibdContentOf } from "./ibd";
import { seqContentOf } from "./sequence";
import { defaultStateContext, stateContentOf, stateContexts } from "./state-machine";
import type { Layout, Pos } from "./layout";
import { withNotes } from "./notes";

export interface ViewDef {
  id: string;
  label: string;
  /** この図に当たる SysML v2 の標準ビュー定義（`GeneralView` など）。ツールチップの補足に出す（ADR-0014）。 */
  std: string;
  /** 表示する要素の種類（null はすべて）。 */
  kinds?: string[] | null;
  /** この関係でつながる要素も表示する。 */
  pull?: EdgeKind[];
  /** 表示中の要素を部品に持つ要素も表示する。 */
  pullComp?: boolean;
  edges?: EdgeKind[] | null;
  /** 所有関係の深さで段を分ける。 */
  depth?: boolean;
  /** 自動の配置で段を決める方法（あれば depth・種類の順位より優先する）。アクションの流れの図は継起の向きの最も長い道のりで決める。 */
  layer?: (list: readonly ModelNode[], edges: readonly ModelEdge[]) => Map<string, number>;
  /**
   * 「図を開く」の一覧に出さない（ツリーの「開く」と作成した図からだけ開く）。組み込みのビューの数は要求 F-VIEW-1 で決まるので、
   * それを変えずに足した図に付ける。
   */
  hidden?: boolean;
}

export interface PackageFrame {
  name: string;
  keys: string[];
  inner: number[];
}

export interface ViewContent {
  nodes: ModelNode[];
  edges: ModelEdge[];
  dim?: Set<string>;
  empty?: string;
  frame?: { kind: string; title: string };
  /** 内部ブロック図の対象そのもののポート（枠の上に描く、8.2.3.13）と、アクション定義そのもののパラメータ（8.2.3.17）。 */
  boundary?: ModelNode[];
  /** アクティビティ図の区画（8.2.3.17 の swimlane）。 */
  lanes?: ModelLane[];
  /** 図に出した package の枠（F-VIEW-9）。`inner` は、この枠の中にある枠の番号。 */
  packages?: PackageFrame[];
  ctx?: ModelNode;
  seq?: boolean;
  /** シーケンス図のライフラインの上のイベント（8.2.3.9 の sq-proxy）。 */
  events?: ModelSequenceEvent[];
  /** シーケンス図の段の数（メッセージと、メッセージの端でないイベントが 1 段ずつ使う）。 */
  rows?: number;
  /** 状態遷移の図で、中の要素を破線で区切った領域に描く並行の状態のキー（状態定義そのものが並行なら ""、8.2.3.18）。 */
  regions?: string[];
}

export const VIEWS: ViewDef[] = [
  { id: "trace", label: "トレーサビリティ", std: "GeneralView", kinds: ["concern def", "requirement def", "requirement", "verification def", "analysis def"], pull: ["satisfy"], edges: ["satisfy", "verify", "frame", "comp", "defined", "derive"] },
  { id: "structure", label: "ブロック定義図", std: "GeneralView", kinds: ["part def", "part", "attribute def"], edges: ["comp", "defined", "specialize", "subset", "redefine", "reference"], depth: true },
  { id: "control", label: "制御ループ", std: "GeneralView", kinds: ["constraint def", "calc def"], pull: ["flow"], edges: ["flow", "comp"] },
  { id: "ibd", label: "内部ブロック図", std: "InterconnectionView" },
  { id: "behavior", label: "振る舞い", std: "GeneralView", kinds: ["state def", "action def", "occurrence def"], pullComp: true, edges: ["comp"] },
  { id: "seq", label: "シーケンス図", std: "SequenceView" },
  { id: "afv", label: "アクティビティ図", std: "ActionFlowView", layer: flowLayers },
  // 状態遷移図（StateTransitionView、8.2.3.18）。組み込みのビューの一覧（F-VIEW-1）には出さない
  { id: "stm", label: "状態遷移図", std: "StateTransitionView", hidden: true },
  { id: "all", label: "すべて", std: "GeneralView", kinds: null, edges: null },
];

const PHASE_LABEL: Record<string, string> = {
  StakeholderNeeds: "利用者要求", SystemRequirements: "システム要求", Architecture: "方式設計", Verification: "検証",
};
/**
 * 工程（@Phase の値）の画面の名前を返す（F-TRACE-1）。知らない値はそのまま返す。
 *
 * @param p 工程の列挙値の名前
 * @returns 画面に出す名前
 * @example
 * phaseLabel("SystemRequirements") // → "システム要求"
 * phaseLabel("Custom")             // → "Custom"（知らない値）
 */
export const phaseLabel = (p: string): string => PHASE_LABEL[p] ?? p;

/**
 * ID からビューの定義を探す。知らない ID ならトレーサビリティのビューを返す。
 *
 * @param id ビューの ID（"trace"・"structure"・"ibd" など）
 * @returns ビューの定義
 * @example
 * viewDef("ibd").label   // → "内部ブロック図"
 * viewDef("nope").id     // → "trace"（知らない ID）
 */
export const viewDef = (id: string): ViewDef => VIEWS.find((x) => x.id === id) ?? (VIEWS[0] as ViewDef);
/** テキストの view の描き方を、それに当たる自動の図で描く（ADR-0005：標準の図の描き方は Modelith の既定で補う）。 */
const BASE_VIEW: Record<ViewKind, string> = { general: "all", interconnection: "ibd", stateTransition: "stm", sequence: "seq", actionFlow: "afv" };
/**
 * テキストの view の描き方（図の種類）を、それに当たる自動の図の ID にする。
 *
 * @param mv テキストに書かれた view
 * @returns 自動の図のビュー ID
 * @example
 * baseViewOf({ kind: "interconnection", … })  // → "ibd"
 * baseViewOf({ kind: "general", … })          // → "all"
 * baseViewOf({ kind: "actionFlow", … })       // → "afv"
 * baseViewOf({ kind: "stateTransition", … })  // → "stm"
 */
export const baseViewOf = (mv: ModelView): string => BASE_VIEW[mv.kind];


/**
 * 自動の図で表示する要素と関係を選ぶ。種類で選んだ要素に、pull の関係でつながる要素・部品の持ち主（pullComp）・
 * 配置済みの要素を加え、その間の、ビューが描く種類の関係を選ぶ。
 *
 * @param M モデル
 * @param v ビューの定義（kinds が null ならモデルのすべて）
 * @param placed この図の配置の座標（要素のキー → 左上。ここにある要素は種類が違っても出す）
 * @returns 表示する要素と関係
 * @example
 * // M に part def A・port def P と、A から P への関係がある。structure のビューで、配置が無い
 * baseContent(M, viewDef("structure"), {}) // → { nodes: [A], edges: [] }
 * baseContent(M, viewDef("all"), {})       // → { nodes: M.nodes, edges: M.edges }（すべて）
 */
function baseContent(M: Model, v: ViewDef, placed: Readonly<Record<string, Pos>>): ViewContent {
  if (!v.kinds) return { nodes: M.nodes, edges: M.edges };
  const kinds = v.kinds;
  const keys = new Set(M.nodes.filter((n) => kinds.includes(n.kind)).map((n) => n.key));
  const pull = v.pull;
  if (pull) for (const e of M.edges) if (pull.includes(e.kind)) { keys.add(e.from); keys.add(e.to); }
  if (v.pullComp) for (const e of M.edges) if (e.kind === "comp" && keys.has(e.to)) keys.add(e.from);
  for (const n of M.nodes) if (placed[n.key]) keys.add(n.key);
  const ek = v.edges ?? [];
  return { nodes: M.nodes.filter((n) => keys.has(n.key)), edges: M.edges.filter((e) => ek.includes(e.kind) && keys.has(e.from) && keys.has(e.to)) };
}

/**
 * 選んだ工程の要素だけを残す（F-TRACE-1）。それらと線でつながる他の工程の要素は、薄く（dim）表示するために残す。
 *
 * @param M モデル（工程の列挙が無ければ絞り込まない）
 * @param phase 選んだ工程（@Phase の値の名前。"" はすべての工程）
 * @param c 絞り込む前の内容
 * @returns 絞り込んだ内容。phase が "" か、モデルに工程が無ければ c をそのまま返す
 * @example
 * // R1 がシステム要求の工程、N1 が利用者要求の工程で、R1 から N1 へ線がある
 * phaseFilter(M, "SystemRequirements", { nodes: [R1, N1, X], edges: [e] }) // → { nodes: [R1, N1], edges: [e], dim: Set{"N1"} }
 * phaseFilter(M, "", c) // → c
 */
function phaseFilter(M: Model, phase: string, c: ViewContent): ViewContent {
  if (!phase || !M.phases) return c;
  const keep = new Set(c.nodes.filter((n) => n.phase === phase).map((n) => n.key));
  const dim = new Set<string>();
  for (const e of c.edges) {
    if (keep.has(e.from) && !keep.has(e.to)) dim.add(e.to);
    if (keep.has(e.to) && !keep.has(e.from)) dim.add(e.from);
  }
  const vis = new Set([...keep, ...dim]);
  return { nodes: c.nodes.filter((n) => vis.has(n.key)), edges: c.edges.filter((e) => keep.has(e.from) || keep.has(e.to)), dim };
}

/**
 * 内部ブロック図の対象にできるブロック（名前のある部品を持つ part def）を集める。
 *
 * @param M モデル
 * @returns 対象にできる part def のノード（モデルの順）。無ければ空
 * @example
 * // part def Vehicle { part engine : Engine; } と、部品の無い part def Engine がある
 * ibdContexts(M).map((n) => n.key) // → ["Vehicle"]
 */
export const ibdContexts = (M: Model): ModelNode[] =>
  M.nodes.filter((n) => n.kind === "part def" && n.entry.children.some((c) => c.kind === "part" && c.name));
/**
 * シーケンス図の対象にできるシナリオ（occurrence def）を集める。
 *
 * @param M モデル
 * @returns occurrence def のノード（モデルの順）。無ければ空
 * @example
 * // occurrence def Start がある
 * seqContexts(M).map((n) => n.key) // → ["Start"]
 */
export const seqContexts = (M: Model): ModelNode[] => M.nodes.filter((n) => n.kind === "occurrence def");
/**
 * 内部ブロック図の既定の対象（部品が最も多いブロック。同数なら先のもの）を選ぶ。
 *
 * @param M モデル
 * @returns 対象のノード。対象にできるブロックが無ければ null
 * @example
 * // Vehicle が部品を 3 つ、Engine が 1 つ持つ
 * defaultIbdContext(M)?.key // → "Vehicle"
 * // 部品を持つ part def が無い
 * defaultIbdContext(M)      // → null
 */
export function defaultIbdContext(M: Model): ModelNode | null {
  const count = (n: ModelNode): number => n.entry.children.filter((c) => c.kind === "part").length;
  return ibdContexts(M).reduce<ModelNode | null>((best, n) => (!best || count(n) > count(best) ? n : best), null);
}

/**
 * 内部ブロック図の内容を作る。対象（key）の部品と、その間の線（`ibdContentOf`）に、対象の枠を付ける。
 *
 * @param M モデル
 * @param key 対象のキー（null は対象なし）
 * @returns 部品・線・対象の枠。対象が無ければ空で、作り方の案内（empty）を付ける
 * @example
 * // Vehicle が部品 engine・wheel を持ち、engine.out から wheel.in へ flow がある
 * ibdContent(M, "Vehicle") // → { nodes: [u:engine, u:wheel], edges: [{ kind: "flow", from: "u:engine", to: "u:wheel", … }], frame: { kind: "part def", title: "Vehicle" }, ctx }
 * // 対象なし
 * ibdContent(M, null) // → { nodes: [], edges: [], empty: "中に部品を持つ部品定義がまだありません。…" }
 */
function ibdContent(M: Model, key: string | null): ViewContent {
  const ctx = ibdContexts(M).find((n) => n.key === key);
  if (!ctx) return { nodes: [], edges: [], empty: "中に部品を持つ部品定義がまだありません。「ブロック定義図」で、部品定義から別の部品定義へ線を引き、「部品として持つ」を選ぶと作れます。" };
  return { ...ibdContentOf(M, ctx), frame: { kind: "part def", title: ctx.name }, ctx };
}

/**
 * シーケンス図の内容を作る。対象のシナリオ（key）のシーケンス図（`seqContentOf`）を、ライフライン・メッセージ・
 * イベントの間の順序の線と、ライフラインの上のイベントにする（9.2.20.2.7・8.2.3.9）。
 *
 * @param M モデル
 * @param key 対象のキー（null は対象なし）
 * @returns ライフライン・線・イベント・段の数（seq: true）。シナリオが無ければ空で、作り方の案内（empty）を付ける
 * @example
 * // Start が部品 a・b と、a から b への message m を持つ
 * seqContent(M, "Start") // → { nodes: [l:a, l:b], edges: [{ id: "msg|0|m", kind: "message", row: 0, from: "l:a", to: "l:b", … }], events: [], rows: 1, seq: true, ctx }
 * // 対象なし
 * seqContent(M, null) // → { nodes: [], edges: [], seq: true, empty: "シナリオがまだありません。…" }
 */
function seqContent(M: Model, key: string | null): ViewContent {
  const ctx = seqContexts(M).find((n) => n.key === key);
  if (!ctx) return { nodes: [], edges: [], seq: true, empty: "シナリオがまだありません。上のパレットの「シナリオ」から作れます。" };
  return { ...seqContentOf(M, ctx), seq: true, ctx };
}

/**
 * アクションの流れの図の内容を作る。対象（key）のアクションの流れ（`flowContentOf`）に、対象の枠を付ける（8.2.3.17）。
 *
 * @param M モデル
 * @param key 対象のキー（null は対象なし）
 * @returns 要素・線・対象の枠。対象が無ければ空で、作り方の案内（empty）を付ける
 * @example
 * // Control に first start; then action read; がある
 * flowContent(M, "Control") // → { nodes: [a:start, a:read], edges: [{ id: "succession|a:start|a:read|#1", … }], frame: { kind: "action def", title: "Control" }, ctx }
 * // 対象なし
 * flowContent(M, null) // → { nodes: [], edges: [], empty: "アクション定義がまだありません。…" }
 */
function flowContent(M: Model, key: string | null): ViewContent {
  const ctx = flowContexts(M).find((n) => n.key === key);
  if (!ctx) return { nodes: [], edges: [], empty: "アクション定義がまだありません。「振る舞い」の図のパレットの「アクション定義」から作れます。" };
  const c = flowContentOf(M, ctx);
  if (!c.nodes.length) return { ...c, empty: `「${ctx.name}」には、まだアクションがありません。テキストに action や順序（first … then）を書くと、ここに流れが出ます。`, ctx };
  return { ...c, frame: { kind: "action def", title: ctx.name }, ctx };
}

/**
 * 状態遷移の図の内容を作る。対象（key）の状態遷移の図（`stateContentOf`）に、対象の枠を付ける（8.2.3.18）。
 *
 * @param M モデル
 * @param key 対象のキー（null は対象なし）
 * @returns 要素・線・並行の領域・対象の枠。対象が無ければ空で、作り方の案内（empty）を付ける
 * @example
 * // KettleStates に entry; then idle; state idle; がある
 * stateContent(M, "KettleStates") // → { nodes: [s:#start, s:idle], edges: [{ id: "transition|s:#start|s:idle|#1", … }], regions: [], frame: { kind: "state def", title: "KettleStates" }, ctx }
 * // 対象なし
 * stateContent(M, null) // → { nodes: [], edges: [], empty: "状態定義がまだありません。…" }
 */
function stateContent(M: Model, key: string | null): ViewContent {
  const ctx = stateContexts(M).find((n) => n.key === key);
  if (!ctx) return { nodes: [], edges: [], empty: "状態定義がまだありません。「振る舞い」の図のパレットの「状態定義」から作れます。" };
  const c = stateContentOf(M, ctx);
  if (!c.nodes.length) return { ...c, empty: `「${ctx.name}」には、まだ状態がありません。テキストに state や遷移（transition）を書くと、ここに図が出ます。`, ctx };
  return { ...c, frame: { kind: "state def", title: ctx.name }, ctx };
}

/**
 * view の expose の対象（またはその型）が ctxs のどれかなら、それを返す。
 *
 * @param mv テキストに書かれた view
 * @param ctxs 対象の候補（ibdContexts・seqContexts の結果）
 * @returns 最初に当たった候補。当たらなければ undefined
 * @example
 * // view が Vehicle を expose している
 * exposedContext(mv, [Vehicle, Truck])?.key // → "Vehicle"
 * // view が部品 v : Truck を expose している
 * exposedContext(mv, [Vehicle, Truck])?.key // → "Truck"（型で当たる）
 * exposedContext(mv, [])                    // → undefined
 */
function exposedContext(mv: ModelView, ctxs: ModelNode[]): ModelNode | undefined {
  return ctxs.find((n) => mv.targets.some((t) => t === n.entry || (!t.isDef && t.type === n.name)));
}

/**
 * 作成した図の package の枠を作る（F-VIEW-9）。枠の中の枠は、package の入れ子から決める。
 *
 * @param mv テキストに書かれた view
 * @param shown 図に出す要素のキー（枠の中身はこれに絞る）
 * @returns 枠ごとの名前・中の要素のキー・中の枠の番号（mv.frames の添字）
 * @example
 * // view が package P を expose し、P の中に package Q がある。P に A、Q に B があり、両方を図に出す
 * packageFrames(mv, new Set(["A", "B"])) // → [{ name: "P", keys: ["A"], inner: [1] }, { name: "Q", keys: ["B"], inner: [] }]
 */
function packageFrames(mv: ModelView, shown: Set<string>): PackageFrame[] {
  const within = (e: Entry, outer: Entry): boolean => {
    for (let a = e.pe; a; a = a.pe) if (a === outer) return true;
    return false;
  };
  return mv.frames.map((f) => ({
    name: f.name,
    keys: f.nodeKeys.filter((k) => shown.has(k)),
    inner: mv.frames.flatMap((g, j) => (within(g.entry, f.entry) ? [j] : [])),
  }));
}

/**
 * テキストに書かれた view の中身（expose・filter で決まる要素と、その間の関係、F-VIEW-7）を作る。一般の図（general）には、要素を注釈するメモも足す。
 * 内部ブロック図・シーケンス図・アクションの流れの図・状態遷移の図の view では、対象（resolveTarget が expose から選んだもの）の図を作る。
 *
 * @param M モデル
 * @param mv 表示する view。テキストから消えていれば null
 * @param t 図の対象（resolveTarget で選び直したもの）
 * @returns 表示する要素・関係・package の枠。出せる要素が無ければ空で、理由の案内（empty）を付ける
 * @example
 * // general の view Overview が A と B を expose し、A から B へ線 e がある
 * modelViewContent(M, mv, t) // → { nodes: [A, B], edges: [e], packages: [] }
 * modelViewContent(M, null, { ...t, modelView: "Gone" }) // → { nodes: [], edges: [], empty: "作成した図「Gone」は、モデルから消えています。" }
 */
function modelViewContent(M: Model, mv: ModelView | null, t: ViewTarget): ViewContent {
  if (!mv) return { nodes: [], edges: [], empty: `作成した図「${t.modelView ?? ""}」は、モデルから消えています。` };
  if (mv.kind === "interconnection")
    return t.ibdCtx ? ibdContent(M, t.ibdCtx) : { nodes: [], edges: [], empty: `図「${mv.name}」に、中に部品を持つ部品定義が含まれていません。` };
  if (mv.kind === "actionFlow")
    return t.flowCtx ? flowContent(M, t.flowCtx) : { nodes: [], edges: [], empty: `図「${mv.name}」に、アクション定義が含まれていません。` };
  if (mv.kind === "stateTransition")
    return t.stateCtx ? stateContent(M, t.stateCtx) : { nodes: [], edges: [], empty: `図「${mv.name}」に、状態定義が含まれていません。` };
  if (mv.kind === "sequence")
    return t.seqCtx ? seqContent(M, t.seqCtx) : { nodes: [], edges: [], seq: true, empty: `図「${mv.name}」に、シナリオが含まれていません。` };
  const keys = new Set(mv.nodeKeys);
  const nodes = M.nodes.filter((n) => keys.has(n.key));
  if (!nodes.length) {
    const where = mv.frames.length ? `パッケージ（${mv.frames.map((f) => f.name).join("・")}）の中に、` : "";
    return { nodes, edges: [], empty: `図「${mv.name}」に、${where}図に出せる要素がありません。` };
  }
  const content = phaseFilter(M, t.phase, { nodes, edges: M.edges.filter((e) => keys.has(e.from) && keys.has(e.to)) });
  const framed = { ...content, packages: packageFrames(mv, new Set(content.nodes.map((n) => n.key))) };
  return mv.kind === "general" ? withNotes(M.notes, framed) : framed;
}

/**
 * 一般の図（「すべて」の自動の図）なら、メモと、メモから要素への線を足す（8.2.3.4）。ほかの自動の図はそのまま返す。
 *
 * @param M モデル
 * @param v ビューの定義
 * @param c 図の内容
 * @returns メモを足した内容（一般の図のとき）か、c そのもの
 * @example
 * // A を注釈するメモ note:#1 がある
 * generalNotes(M, viewDef("all"), { nodes: [A], edges: [] }).nodes.map((n) => n.key)       // → ["A", "note:#1"]
 * generalNotes(M, viewDef("structure"), { nodes: [A], edges: [] }).nodes.map((n) => n.key) // → ["A"]
 */
const generalNotes = (M: Model, v: ViewDef, c: ViewContent): ViewContent => (v.id === "all" ? withNotes(M.notes, c) : c);

/**
 * どの図を描くか（画面の状態 S に頼らずに図を選ぶための値）。画面ではタブの状態から作り、画面の外（Node の書き出し）では呼び出し側が渡す。
 * 対象（ibdCtx など）は、その種類の図のときだけ使う。
 */
export interface ViewTarget {
  /** 描き方（自動の図の ID。テキストの view なら、その描き方に当たる自動の図の ID）。 */
  view: string;
  /** テキストに書かれた view の名前（F-VIEW-7）。null は自動の図。 */
  modelView: string | null;
  /** 内部ブロック図の対象（part def のキー）。 */
  ibdCtx: string | null;
  /** シーケンス図の対象（occurrence def のキー）。 */
  seqCtx: string | null;
  /** アクティビティ図の対象（action def のキー）。 */
  flowCtx: string | null;
  /** 状態遷移図の対象（state def のキー）。 */
  stateCtx: string | null;
  /** 選んだ工程（@Phase の値の名前。"" はすべての工程。F-TRACE-1）。 */
  phase: string;
}

/**
 * 図の対象を選び直す。テキストの view では、expose の対象を、その描き方の対象にする。自動の内部ブロック図・シーケンス図・
 * アクションの流れの図・状態遷移の図では、対象がモデルに無ければ既定の対象を選ぶ。ほかの値はそのまま返す。
 *
 * @param M モデル
 * @param t 選び直す前の図の対象
 * @returns 選び直した図の対象（新しいオブジェクト）
 * @example
 * // Vehicle が部品を 3 つ、Engine が 1 つ持つ
 * resolveTarget(M, { view: "ibd", modelView: null, ibdCtx: null, … }).ibdCtx    // → "Vehicle"（既定の対象）
 * resolveTarget(M, { view: "ibd", modelView: null, ibdCtx: "Engine", … }).ibdCtx // → "Engine"（そのまま）
 * // view V（interconnection）が Engine を expose している
 * resolveTarget(M, { view: "ibd", modelView: "V", ibdCtx: "Vehicle", … }).ibdCtx // → "Engine"
 * // テキストから消えた view
 * resolveTarget(M, { view: "ibd", modelView: "Gone", ibdCtx: null, … }).ibdCtx   // → null（そのまま）
 */
export function resolveTarget(M: Model, t: ViewTarget): ViewTarget {
  if (t.modelView) {
    const mv = M.views.find((v) => v.name === t.modelView);
    if (!mv) return { ...t };
    const exposed = (ctxs: ModelNode[]): string | null => exposedContext(mv, ctxs)?.key ?? null;
    if (mv.kind === "interconnection") return { ...t, ibdCtx: exposed(ibdContexts(M)) };
    if (mv.kind === "actionFlow") return { ...t, flowCtx: exposed(flowContexts(M)) };
    if (mv.kind === "stateTransition") return { ...t, stateCtx: exposed(stateContexts(M)) };
    if (mv.kind === "sequence") return { ...t, seqCtx: exposed(seqContexts(M)) };
    return { ...t };
  }
  const has = (ctxs: ModelNode[], key: string | null): boolean => ctxs.some((n) => n.key === key);
  if (t.view === "ibd" && !has(ibdContexts(M), t.ibdCtx)) return { ...t, ibdCtx: defaultIbdContext(M)?.key ?? null };
  if (t.view === "seq" && !has(seqContexts(M), t.seqCtx)) return { ...t, seqCtx: seqContexts(M)[0]?.key ?? null };
  if (t.view === "afv" && !has(flowContexts(M), t.flowCtx)) return { ...t, flowCtx: defaultFlowContext(M)?.key ?? null };
  if (t.view === "stm" && !has(stateContexts(M), t.stateCtx)) return { ...t, stateCtx: defaultStateContext(M)?.key ?? null };
  return { ...t };
}

/**
 * 配置情報のキー。内部ブロック図・アクションの流れの図・状態遷移の図は対象ごとに分ける。
 * テキストの view は view ごとに分ける（内部ブロック図・シーケンス図・アクションの流れの図・状態遷移の図は、対象ごとの配置を自動の図と共有する）。
 *
 * @param t 図の対象
 * @returns 配置のキー（配置ファイルの views の名前）
 * @example
 * layoutKey({ view: "ibd", ibdCtx: "Vehicle", … })            // → "ibd:Vehicle"
 * layoutKey({ view: "all", modelView: "Overview", … })        // → "view:Overview"
 * layoutKey({ view: "structure", modelView: null, … })        // → "structure"
 * layoutKey({ view: "afv", flowCtx: "Control", … })           // → "afv:Control"
 * layoutKey({ view: "stm", stateCtx: "KettleStates", … })     // → "stm:KettleStates"
 * layoutKey({ view: "seq", modelView: "Scenario", … })        // → "seq"（シーケンス図は配置を持たない）
 */
export const layoutKey = (t: ViewTarget): string =>
  t.view === "ibd"
    ? "ibd:" + t.ibdCtx
    : t.view === "afv"
      ? "afv:" + t.flowCtx
      : t.view === "stm"
        ? "stm:" + t.stateCtx
        : t.modelView && t.view !== "seq"
          ? "view:" + t.modelView
          : t.view;

/**
 * 図に表示する要素と関係を作る（画面の状態に頼らない）。対象は resolveTarget で選び直したものを渡す。
 *
 * @param M モデル
 * @param t 図の対象（resolveTarget の結果）
 * @param layout 配置（自動の図は、この図の配置に座標がある要素も出す。読むだけで書き換えない）
 * @returns 表示する内容。出せる要素が無ければ空で、理由の案内（empty）を付ける
 * @example
 * // 工程の絞り込みなし
 * contentOf(M, { view: "all", modelView: null, …, phase: "" }, {}) // → { nodes: M.nodes, edges: M.edges }（とメモ）
 * // 内部ブロック図で、部品を持つ part def が無い
 * contentOf(M, { view: "ibd", ibdCtx: null, … }, {})              // → { nodes: [], edges: [], empty: "中に部品を持つ部品定義がまだありません。…" }
 */
export function contentOf(M: Model, t: ViewTarget, layout: Readonly<Layout>): ViewContent {
  if (t.modelView) return modelViewContent(M, M.views.find((v) => v.name === t.modelView) ?? null, t);
  if (t.view === "ibd") return ibdContent(M, t.ibdCtx);
  if (t.view === "seq") return seqContent(M, t.seqCtx);
  if (t.view === "afv") return flowContent(M, t.flowCtx);
  if (t.view === "stm") return stateContent(M, t.stateCtx);
  const v = viewDef(t.view);
  return generalNotes(M, v, phaseFilter(M, t.phase, baseContent(M, v, layout[layoutKey(t)]?.pos ?? {})));
}
