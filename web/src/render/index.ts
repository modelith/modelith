// 画面を介さずに図を書き出す入口（ADR-0024 の 3：Node で動く書き出しは、画面と同じ配置と描画を使う）。
// モデル・どの図か・保存した配置・描き方をすべて引数で受け取り、DOM・画面の状態（S）・ブラウザの保存領域には触れない。
// 手順は「図の中身を選ぶ（view-content）→ 座標の無い要素を置く（geometry）→ 文字列にする（diagram-export）」で、
// 画面の「エクスポート…」も最後の文字列にする段で同じ関数（svgDocument・drawioDocument）を使う。

import type { Model } from "../core";
import { drawioDocument, svgDocument, type DiagramImage } from "./diagram-export";
import { placeView } from "./geometry";
import { emptyView, type Layout, type ViewLayout } from "./layout";
import type { EdgeStyle } from "./svg";
import { contentOf, layoutKey, resolveTarget, viewDef, type ViewContent, type ViewTarget } from "./view-content";

export type { DiagramImage } from "./diagram-export";
export type { Layout } from "./layout";
export type { EdgeStyle } from "./svg";
export type { ViewTarget } from "./view-content";

/** 図の描き方（画面の設定に当たるもの）。 */
export interface DiagramOptions {
  /** 線の形（画面の「直角」「曲線」。既定は直角）。 */
  edgeStyle?: EdgeStyle;
}

/** 書き出す前の図（中身と、座標の無い要素を置いた配置）。 */
export interface PreparedDiagram {
  /** 選び直した図の対象（resolveTarget の結果）。 */
  target: ViewTarget;
  /** 図に出す要素と関係。 */
  content: ViewContent;
  /** この図の配置（渡した配置の写しに、座標の無い要素を置いたもの）。 */
  layout: ViewLayout;
}

/**
 * 図の中身を選び、渡した配置の写しに、座標の無い要素を画面と同じ規則で置く（渡した配置は書き換えない）。
 *
 * @param model モデル（コアの build の結果）
 * @param target どの図か（対象が無効なら既定の対象を選ぶ）
 * @param layout 保存した配置（配置ファイルの views。無い図は空の配置から始める）
 * @returns 選び直した対象・図の中身・この図の配置
 * @example
 * // part def A だけのモデルで、ブロック定義図に配置が無い
 * prepareDiagram(M, { view: "structure", modelView: null, …, phase: "" }, {}).layout.pos // → { A: [0, 0] }
 * // シーケンス図は配置を持たない
 * prepareDiagram(M, { view: "seq", … }, {}).layout                                     // → { pos: {}, pins: {}, ends: {} }
 */
export function prepareDiagram(model: Model, target: ViewTarget, layout: Readonly<Layout>): PreparedDiagram {
  const resolved = resolveTarget(model, target);
  const content = contentOf(model, resolved, layout);
  const own = structuredClone(layout[layoutKey(resolved)] ?? emptyView());
  placeView(content, viewDef(resolved.view), own.pos, model.phases?.[0] ?? null);
  return { target: resolved, content, layout: own };
}

/**
 * 図を単独の SVG にする（F-EXP-1）。画面の「エクスポート…」の SVG と同じもの（明るい配色・白い背景・図の全体）。
 *
 * @param model モデル（コアの build の結果）
 * @param target どの図か
 * @param layout 保存した配置（読むだけ）
 * @param options 描き方（線の形）
 * @returns SVG の文字列と大きさ（倍率 1 の点の数）
 * @example
 * // part def A だけのモデルのブロック定義図
 * diagramSvg(M, { view: "structure", … }, {}) // → { svg: '<svg … viewBox="-40 -40 304 124" …>…A…</svg>', width: 304, height: 124 }
 * // 要素の無い図
 * diagramSvg(emptyModel, { view: "structure", … }, {}) // → { svg: '<svg … viewBox="0 0 100 100" …>…</svg>', width: 100, height: 100 }
 */
export function diagramSvg(model: Model, target: ViewTarget, layout: Readonly<Layout>, options: DiagramOptions = {}): DiagramImage {
  const d = prepareDiagram(model, target, layout);
  return svgDocument(d.content, d.layout, { view: d.target.view, edgeStyle: options.edgeStyle ?? "ortho", phases: !!model.phases });
}

/**
 * 図を draw.io の XML にする（F-EXP-2）。画面の「エクスポート…」の draw.io と同じもの。
 *
 * @param model モデル（コアの build の結果）
 * @param target どの図か
 * @param layout 保存した配置（読むだけ）
 * @param options 描き方（線の形）と、ページの名前（省けば図の種類の名前）
 * @returns draw.io（app.diagrams.net）で読み込める mxfile の XML
 * @example
 * // part def A だけのモデルのブロック定義図
 * diagramDrawio(M, { view: "structure", … }, {}) // → '<mxfile …><diagram id="v" name="ブロック定義図">…«part def»…A…</mxfile>'
 * diagramDrawio(M, { view: "structure", … }, {}, { page: "車" }) // → '…<diagram id="v" name="車">…'
 */
export function diagramDrawio(model: Model, target: ViewTarget, layout: Readonly<Layout>, options: DiagramOptions & { page?: string } = {}): string {
  const d = prepareDiagram(model, target, layout);
  return drawioDocument(d.content, d.layout, { view: d.target.view, edgeStyle: options.edgeStyle ?? "ortho", page: options.page });
}
