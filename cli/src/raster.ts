// 図を PNG にする口（core.ts の Rasterizer）を、Rust の描画の wasm と、同梱のフォントで満たす（ADR-0029）。
// 描画の wasm とフォントに触れるのはこのファイルだけ。wasm は scripts/build-wasm.sh が cli/wasm/ に、
// フォントは scripts/fetch-fonts.sh が cli/fonts/ に置く。

import { readFileSync } from "node:fs";
import { Fonts, initSync, renderPng } from "../wasm/modelith_raster.js";
import { Refused, type PngImage, type Rasterizer } from "./core.ts";

/** 描画の wasm のファイル。 */
const WASM = new URL("../wasm/modelith_raster_bg.wasm", import.meta.url);

/** 同梱のフォントのフォルダ。 */
const FONT_DIR = new URL("../fonts/", import.meta.url);

/** 図の文字のフォント（`font-family="Noto Sans JP, sans-serif"`。Regular と、名前の太字）。 */
const SANS_FONTS = ["NotoSansJP-Regular.otf", "NotoSansJP-Bold.otf"];

/** 等幅の文字のフォント（`font-family="monospace"`。区画の行・ポートの名前）。 */
const MONO_FONTS = ["IBMPlexMono-Regular.ttf"];

/** 画像にできなかった理由（描画の wasm が返すコード）ごとの文。 */
const REASONS: Record<string, string> = {
  svg: "The diagram could not be read as SVG.",
  size: "The image would be empty or too large. Use a smaller scale.",
  encode: "The image could not be written as PNG.",
};

/**
 * 画像にできなかった理由のコードを、利用者に伝える文にする。
 *
 * @param code 描画の wasm が返したコード（svg・size・encode）
 * @returns 理由の文。知らないコードは、コードを添えた文
 * @example
 * rasterReason("size") // → "The image would be empty or too large. Use a smaller scale."
 * rasterReason("oops") // → "The diagram could not be drawn as PNG (oops)."
 */
export function rasterReason(code: string): string {
  return REASONS[code] ?? `The diagram could not be drawn as PNG (${code}).`;
}

/**
 * 描画の wasm を読み込み、同梱のフォントを入れた集まりを作る。
 *
 * @returns フォントの集まり。wasm やフォントのファイルが無い・フォントとして読めないときは例外を投げる
 *   （手元では、先に scripts/build-wasm.sh と scripts/fetch-fonts.sh が要る）
 * @example
 * renderPng(svg, loadFonts(), 1, false).width // → SVG の幅
 */
function loadFonts(): Fonts {
  initSync({ module: readFileSync(WASM) });
  const fonts = new Fonts();
  const add = (files: string[], put: (data: Uint8Array) => boolean): void => {
    for (const file of files) {
      if (!put(readFileSync(new URL(file, FONT_DIR)))) throw new Error(`The font ${file} could not be read.`);
    }
  };
  add(SANS_FONTS, (data) => fonts.addSans(data));
  add(MONO_FONTS, (data) => fonts.addMono(data));
  return fonts;
}

/**
 * 図を PNG にする口を作る。wasm とフォントは、初めて PNG を書き出すときに読み込む（SVG・draw.io だけを使う人を待たせない）。
 *
 * @returns 図を PNG にする口
 * @example
 * loadRasterizer().png('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>', 2) // → { data: PNG, width: 40, height: 20, missing: "" }
 * loadRasterizer().png("<p>", 1)                                                                // → Refused("The diagram could not be read as SVG.") を投げる
 */
export function loadRasterizer(): Rasterizer {
  let fonts: Fonts | undefined;
  return {
    /**
     * SVG を、倍率を掛けた大きさの PNG にする（背景は白）。
     *
     * @param svg SVG の文
     * @param scale 倍率（1 で SVG の大きさのまま）
     * @returns PNG と、その幅・高さ、描けなかった文字。画像にできないときは、理由を書いた Refused を投げる
     * @example
     * png('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>', 2) // → { data: PNG, width: 40, height: 20, missing: "" }
     */
    png(svg, scale): PngImage {
      fonts ??= loadFonts();
      let image;
      try {
        image = renderPng(svg, fonts, scale, false);
      } catch (e) {
        // 描画の wasm は、理由のコードを文字列で投げる
        if (typeof e === "string") throw new Refused(rasterReason(e));
        throw e;
      }
      try {
        return { data: image.png, width: image.width, height: image.height, missing: image.missing };
      } finally {
        image.free();
      }
    },
  };
}
