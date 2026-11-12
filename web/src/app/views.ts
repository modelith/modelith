// 表示中のタブ（画面の状態 S）の図を選ぶ。どの要素・関係を表示するかの決め方は view-content.ts にあり、ここは S から ViewTarget を作って渡すだけ。

import type { Model, ModelEdge, ModelNode, ModelView } from "../core";
import { emptyView, type ViewLayout } from "./layout";
import { S } from "./state";
import { baseViewOf, contentOf, layoutKey, resolveTarget, viewDef, type ViewContent, type ViewDef, type ViewTarget } from "./view-content";

export {
  baseViewOf, defaultIbdContext, ibdContexts, phaseLabel, seqContexts, VIEWS, viewDef,
  type PackageFrame, type ViewContent, type ViewDef,
} from "./view-content";

/**
 * 表示中のタブのビューの定義を返す（S.view から引く）。
 *
 * @returns ビューの定義
 * @example
 * // S.view が "structure"
 * curView().label // → "ブロック定義図"
 */
export const curView = (): ViewDef => viewDef(S.view);
/**
 * 表示中のタブの、テキストに書かれた view を返す（F-VIEW-7）。
 *
 * @returns 名前が S.modelView の view。自動の図のタブや、テキストから消えた view なら null
 * @example
 * // S.modelView が "Overview" で、モデルに view Overview がある
 * modelView()?.name // → "Overview"
 * // S.modelView が null（自動の図）
 * modelView()       // → null
 */
export const modelView = (): ModelView | null => (S.modelView ? (S.M.views.find((v) => v.name === S.modelView) ?? null) : null);

/**
 * 表示中のタブの図の対象を、画面の状態から作る。
 *
 * @returns S.view・S.modelView・各図の対象・工程をそのまま写した値
 * @example
 * // S.view が "ibd"、S.ibdCtx が "Vehicle"、ほかは初期値
 * curTarget() // → { view: "ibd", modelView: null, ibdCtx: "Vehicle", seqCtx: null, flowCtx: null, stateCtx: null, phase: "" }
 */
export const curTarget = (): ViewTarget => ({
  view: S.view, modelView: S.modelView, ibdCtx: S.ibdCtx, seqCtx: S.seqCtx, flowCtx: S.flowCtx, stateCtx: S.stateCtx, phase: S.phase,
});

/**
 * 配置情報のキー（layoutKey を表示中のタブに当てたもの）。
 *
 * @returns 表示中のタブの配置のキー
 * @example
 * // S.view が "ibd"、S.ibdCtx が "Vehicle"
 * VK() // → "ibd:Vehicle"
 * // S.view が "all"、S.modelView が "Overview"
 * VK() // → "view:Overview"
 * // S.view が "structure"、S.modelView が null
 * VK() // → "structure"
 */
export const VK = (): string => layoutKey(curTarget());
/**
 * 現在のビューの配置を返す。無ければ空の配置を作って S.layout に加える。
 *
 * @returns S.layout[VK()] の配置（呼び出し側の変更はそのまま S.layout に残る）
 * @example
 * // S.view が "structure" で、まだ配置が無い
 * curLayout() // → emptyView() と同じ中身（S.layout.structure に加わる）
 */
export function curLayout(): ViewLayout {
  const k = VK();
  return (S.layout[k] ||= emptyView());
}

/**
 * テキストの view の描き方が変わったら（render や型を書き換えたとき）、表示中のタブの描き方を合わせる。
 * S.view と、表示中のタブの view を書き換える。
 */
export function syncModelViewKind(): void {
  const mv = modelView();
  if (!mv || S.view === baseViewOf(mv)) return;
  S.view = baseViewOf(mv);
  const t = S.tabs.find((x) => x.id === S.tabId);
  if (t) t.view = S.view;
}

let cache: { M: Model | null; k: string | null; v: ViewContent | null } = { M: null, k: null, v: null };

/**
 * ビューに表示する要素と関係を返す（モデルと表示条件が同じ間はキャッシュする）。どう選ぶかは contentOf に任せる。
 * 図の対象を選び直し（resolveTarget）、その結果を S.ibdCtx・S.seqCtx・S.flowCtx・S.stateCtx に書き戻す
 * （自動の図で対象が無効なら既定の対象に、テキストの view なら expose の対象になる）。
 *
 * @param M モデル
 * @param v ビューの定義
 * @returns 表示する内容（同じ条件なら前と同じオブジェクト）
 * @example
 * // S.modelView が null、S.phase が ""
 * viewContent(M, viewDef("all"))                                 // → { nodes: M.nodes, edges: M.edges }
 * viewContent(M, viewDef("all")) === viewContent(M, viewDef("all")) // → true（キャッシュ）
 */
export function viewContent(M: Model, v: ViewDef): ViewContent {
  const t = resolveTarget(M, { ...curTarget(), view: v.id });
  S.ibdCtx = t.ibdCtx;
  S.seqCtx = t.seqCtx;
  S.flowCtx = t.flowCtx;
  S.stateCtx = t.stateCtx;
  const k = [t.view, t.ibdCtx, t.seqCtx, t.flowCtx, t.stateCtx, t.phase, t.modelView].join("|");
  if (cache.M === M && cache.k === k && cache.v) return cache.v;
  const r = contentOf(M, t, S.layout);
  cache = { M, k, v: r };
  return r;
}

/**
 * 現在のビューの内容を返す（viewContent(S.M, curView()) の略）。
 *
 * @returns 表示中のタブの内容
 * @example
 * // S.view が "all"、絞り込みなし
 * CC().nodes.length // → S.M.nodes.length
 */
export const CC = (): ViewContent => viewContent(S.M, curView());

/**
 * キーから要素を探す（`u:`・`l:`・`j:`・`a:`・`s:`・`note:` は現在のビューの部品・ライフライン・n 項の接続の点・アクションの流れの要素・状態・メモ）。
 *
 * @param k 要素のキー
 * @returns 見つかった要素。k が空か、見つからなければ null
 * @example
 * // モデルに part def Vehicle がある
 * nodeByKey("Vehicle")    // → Vehicle のノード
 * // 内部ブロック図に部品 engine を表示中
 * nodeByKey("u:engine")   // → 部品 engine のノード
 * nodeByKey("b:pwr")      // → 対象そのもののポート pwr（枠の上のポート）
 * nodeByKey(undefined)    // → null
 */
export function nodeByKey(k: string | null | undefined): ModelNode | null {
  if (!k) return null;
  if (k.startsWith("b:")) return CC().boundary?.find((n) => n.key === k) ?? null;
  if (/^(?:[uljas]|note):/.test(k)) return CC().nodes.find((n) => n.key === k) ?? null;
  return S.M.nodes.find((n) => n.key === k) ?? null;
}

/**
 * ID から線を探す。現在のビューの線を先に、無ければモデルの線から探す。
 *
 * @param id 線の ID
 * @returns 見つかった線。id が空か、見つからなければ null
 * @example
 * // 内部ブロック図に flow の線 "flow|u:a|u:b|#1" を表示中
 * edgeById("flow|u:a|u:b|#1") // → その線
 * edgeById(null)              // → null
 */
export function edgeById(id: string | null | undefined): ModelEdge | null {
  if (!id) return null;
  return CC().edges.find((e) => e.id === id) ?? S.M.edges.find((e) => e.id === id) ?? null;
}

/**
 * 現在のビューに表示している要素を返す。
 *
 * @returns 表示中の要素（CC().nodes）
 * @example
 * // ブロック定義図に A と B を表示中
 * visibleNodes().map((n) => n.key) // → ["A", "B"]
 */
export const visibleNodes = (): ModelNode[] => CC().nodes;
