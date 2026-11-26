// 画面の「エクスポート…」の中身（表示中の図の draw.io の XML・SVG）と、PNG・JPEG への変換、ファイルのダウンロード・画像のコピー。
// 図の中身の作り方は diagram-export.ts にあり、ここは画面の状態（S）から図の内容・配置・描き方を集めて渡す。

import type { DiagramImage } from "../render/diagram-export";
import { t } from "../l10n";
import { drawioDocument, svgDocument } from "../render/diagram-export";
import { selectionContent } from "./export-range";
import { S } from "./state";
import { curLayout, curView, viewContent } from "./views";

export {
  drawioEdgeStyle, drawioEventCell, drawioFlowCell, drawioLineShape, drawioStateCell, drawioText, mxfileXml, type DiagramImage,
} from "../render/diagram-export";

/**
 * 表示中の図を draw.io の XML にする（F-EXP-2）。中身は drawioDocument に任せる。
 *
 * @param page ページの名前（画面のタブの名前。省けば図の種類の名前。#244）
 * @returns draw.io（app.diagrams.net）で読み込める mxfile の XML
 * @example
 * // ブロック定義図に要素が 1 つも無い
 * drawioXml()
 * // → '<mxfile host="app.diagrams.net"><diagram id="v" name="ブロック定義図"><mxGraphModel grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'
 */
export function drawioXml(page?: string): string {
  const cc = viewContent(S.M, curView());
  return drawioDocument(cc, curLayout(), { view: S.view, edgeStyle: S.edgeStyle, page });
}

/** エクスポートする SVG の範囲と背景（F-EXP-4）。 */
export interface SvgExportOptions {
  /** 選んだ要素のキー（この範囲だけを描く）。無ければ図の全体。 */
  keys?: ReadonlySet<string> | null;
  /** 背景を透明にするか（既定は白）。 */
  transparent?: boolean;
}

/**
 * 表示中の図を単独の SVG にする（F-EXP-1・F-EXP-4）。範囲を選んでいれば、その要素だけに絞る（シーケンス図は絞らない）。中身は svgDocument に任せる。
 *
 * @param opts 範囲（選んだ要素）と背景（既定は図の全体・白い背景）
 * @returns SVG の文字列と大きさ
 * @example
 * // 図に要素が 1 つも無い
 * svgExport() // → { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">…</svg>', width: 100, height: 100 }
 */
export function svgExport(opts: SvgExportOptions = {}): DiagramImage {
  const whole = viewContent(S.M, curView());
  const content = opts.keys && !whole.seq ? selectionContent(whole, opts.keys) : whole;
  return svgDocument(content, curLayout(), { view: S.view, edgeStyle: S.edgeStyle, phases: !!S.M.phases, transparent: opts.transparent });
}

/**
 * SVG の図を、点の並びの画像（PNG・JPEG）にする（F-EXP-3）。SVG は data: の URL で読み込む（本体の CSP は img-src に blob: を許さない）。
 *
 * @param image SVG の図と大きさ
 * @param scale 倍率（rasterScale で上限に収めたもの）
 * @param type 画像の種類（"image/png"・"image/jpeg"）
 * @param transparent 背景を透明にするか（JPEG は透明にできないので、白で塗る）
 * @returns 画像のバイト列（作れなければ失敗する Promise）
 * @example
 * await rasterize(svgExport(), 2, "image/png", false) // → 幅・高さが 2 倍の PNG の Blob
 */
export async function rasterize(image: DiagramImage, scale: number, type: string, transparent: boolean): Promise<Blob> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const g = canvas.getContext("2d");
  if (!g) throw new Error(t("app-files-image-not-made"));
  if (!transparent || type === "image/jpeg") {
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  // `canvas.toBlob` は使わない。ブラウザの手が空いたときに変換を進める作りで、画面が動いていない間は終わらないことがある
  // （「画像をコピー」が、成功も失敗も知らせずに止まった。#310）。その場で変換する `toDataURL` から作る
  const blob = dataUrlBlob(canvas.toDataURL(type, 0.92));
  if (!blob) throw new Error(t("app-files-image-not-made"));
  return blob;
}

/**
 * `data:` の URL（base64）を、バイト列（Blob）にする。
 *
 * @param url `data:<種類>;base64,<中身>` の形の URL（`canvas.toDataURL` の結果）
 * @returns その種類の Blob。base64 の `data:` の URL でない・中身が空・中身を読めないときは null
 * @example
 * dataUrlBlob("data:image/png;base64,iVBORw0KGgo=") // → 種類 "image/png"、8 バイトの Blob
 * dataUrlBlob("data:,")                             // → null（大きすぎるキャンバスなどで、ブラウザが画像を作れなかったとき）
 * dataUrlBlob("https://example.com/a.png")          // → null
 */
export function dataUrlBlob(url: string): Blob | null {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(url);
  if (!m) return null;
  let binary: string;
  try {
    binary = atob(m[2] ?? "");
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: m[1] ?? "" });
}

/**
 * 画像のコピーに失敗したときの文（F-EXP-5、#243）。ブラウザが書き込みを許さなかった（NotAllowedError）のか、コピーに対応していないのかを分ける。
 *
 * @param e 投げられた値
 * @returns トーストの文
 * @example
 * copyFailureText(new DOMException("denied", "NotAllowedError"))
 *   // → "画像をコピーできませんでした。ブラウザがクリップボードへの書き込みを許しませんでした。ブラウザの許可を確かめるか、PNG 画像としてエクスポートしてください"
 * copyFailureText(new Error("This browser cannot copy images"))
 *   // → "画像をコピーできませんでした。このブラウザでは、PNG 画像としてエクスポートしてください"
 */
export function copyFailureText(e: unknown): string {
  if (e instanceof Error && e.name === "NotAllowedError") {
    return t("app-files-copy-image-denied");
  }
  return t("app-files-copy-image-unsupported");
}

/**
 * PNG の画像をクリップボードに入れる（F-EXP-5）。画像はまだできていなくてよい（Safari は、押した直後に書き込みを始めないと断るため、Promise のまま渡す）。
 *
 * @param png PNG の画像（できあがる Promise）
 * @returns 書き込めたら解決し、ブラウザが許さなければ失敗する Promise
 */
export async function copyImage(png: Promise<Blob>): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("This browser cannot copy images");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

/**
 * 文字列やバイト列をファイルとしてダウンロードさせる（一時的な URL を作ってリンクを押し、すぐに URL を解放する）。
 *
 * @param filename 保存するファイル名（"model.svg" など）
 * @param data ファイルの中身（文字列は UTF-8 で書く。プラグインのエクスポートはバイト列、画像は Blob）
 * @param type MIME タイプ（"image/svg+xml" など）
 */
export function download(filename: string, data: string | Uint8Array<ArrayBuffer> | Blob, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
