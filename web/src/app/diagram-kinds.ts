// 作成する図の種類と、図の名前の変更・削除の判断（F-VIEW-8・F-VIEW-11）。画面に触らない純粋な関数だけを置く。

import type { ModelNode, ViewKind } from "../core";
import type { Layout } from "../render/layout";
import type { Tab } from "./state";
import { t } from "../l10n";

/** 「新しい図を作成」で選べる図の種類（F-VIEW-8）。`def` は描く対象の定義の種類（一般の図は対象を選ばない）。 */
export interface DiagramKind {
  id: ViewKind;
  label: string;
  note: string;
  /** 描く対象の定義の種類と、画面での呼び方。一般の図は null。 */
  def: { kind: string; label: string } | null;
}

/** 図の種類の一覧（「今の図のまま」は表示中の図で決まるので、ここには入れない）。 */
export const DIAGRAM_KINDS: DiagramKind[] = [
  { id: "general", label: t("app-diagram-kind-general"), note: t("app-diagram-kind-general-note"), def: null },
  { id: "interconnection", label: t("app-diagram-kind-interconnection"), note: t("app-diagram-kind-interconnection-note"), def: { kind: "part def", label: t("app-diagram-def-block") } },
  { id: "actionFlow", label: t("app-diagram-kind-action-flow"), note: t("app-diagram-kind-action-flow-note"), def: { kind: "action def", label: t("app-diagram-def-action") } },
  { id: "stateTransition", label: t("app-diagram-kind-state-transition"), note: t("app-diagram-kind-state-transition-note"), def: { kind: "state def", label: t("app-diagram-def-state") } },
  { id: "sequence", label: t("app-diagram-kind-sequence"), note: t("app-diagram-kind-sequence-note"), def: { kind: "occurrence def", label: t("app-diagram-def-scenario") } },
];

/**
 * 図の種類で描ける対象（定義）を、モデルから名前の順に集める（F-VIEW-8）。
 *
 * @param nodes モデルの図の要素
 * @param defKind 対象の定義の種類（`part def` など）
 * @returns 種類が defKind の定義（使用・ライフラインなどは除く）
 * @example
 * targetCandidates([{ key: "B", name: "B", kind: "part def", isDef: true }, { key: "A", name: "A", kind: "part def", isDef: true }, { key: "R", kind: "requirement def", isDef: true }], "part def")
 * // → [A, B]
 * targetCandidates([], "action def") // → []
 */
export function targetCandidates(nodes: ModelNode[], defKind: string): ModelNode[] {
  return nodes.filter((n) => n.isDef && n.kind === defKind && !n.usage && !n.lifeline).sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

/**
 * 図の名前を変えたとき、その図の配置を新しい名前に移す（F-VIEW-11）。一般の図の配置は `view:名前` に持つ。
 *
 * @param layout すべての図の配置（書き換える）
 * @param from 今の名前
 * @param to 新しい名前
 * @example
 * const L = { "view:A": { pos: { X: [0, 0] }, pins: {}, ends: {} } };
 * renameViewLayout(L, "A", "B") // L → { "view:B": { pos: { X: [0, 0] }, … } }
 * renameViewLayout(L, "Z", "Y") // 配置の無い図なら何もしない
 */
export function renameViewLayout(layout: Layout, from: string, to: string): void {
  const v = layout[`view:${from}`];
  if (!v) return;
  layout[`view:${to}`] = v;
  delete layout[`view:${from}`];
}

/**
 * 図の名前を変えたとき、その図を開いているタブの名前を付け替える（F-VIEW-11）。
 *
 * @param tabs 図のタブ（書き換える）
 * @param from 今の名前
 * @param to 新しい名前
 * @returns 付け替えたタブの数
 * @example
 * renameViewTabs([{ id: 1, view: "all", ctx: null, phase: "", mv: "A" }], "A", "B") // → 1（タブの mv が "B" になる）
 * renameViewTabs([{ id: 1, view: "all", ctx: null, phase: "" }], "A", "B")          // → 0
 */
export function renameViewTabs(tabs: Tab[], from: string, to: string): number {
  const hit = tabs.filter((t) => t.mv === from);
  for (const t of hit) t.mv = to;
  return hit.length;
}

