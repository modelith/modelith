// 図を PNG にする口の結合テスト（要求 F-AI-3、ADR-0029）。Rust の描画の wasm と、同梱のフォントを実際に使う
// （先に scripts/build-wasm.sh と scripts/fetch-fonts.sh が要る。scripts/check.sh が実行する）。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Refused } from "./core.ts";
import { loadRasterizer, rasterReason } from "./raster.ts";
import { loadWebRenderer } from "./web-render.ts";

const rasterizer = loadRasterizer();

/** 幅 120・高さ 40 の SVG。中身は引数。 */
const svgOf = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40">${body}</svg>`;

/** 図と同じ書き方の文字（font はアプリの図と同じ名前で指す）。 */
const text = (s: string, font = "Noto Sans JP, sans-serif", weight = "400"): string =>
  `<text x="4" y="26" font-size="16" font-weight="${weight}" fill="#000000" font-family="${font}">${s}</text>`;

/** PNG のファイルの先頭の 8 バイト。 */
const PNG_SIGNATURE = Buffer.from("\x89PNG\r\n\x1a\n", "latin1");

describe("loadRasterizer", () => {
  it.each([[1], [2], [3]])("F-AI-3: SVG の大きさに倍率 %d を掛けた PNG にする（境界値）", (scale) => {
    // Act
    const image = rasterizer.png(svgOf('<rect width="60" height="40" fill="#2D5A87"/>'), scale);
    // Assert
    expect([image.width, image.height]).toEqual([120 * scale, 40 * scale]);
    expect(Buffer.from(image.data.subarray(0, 8))).toEqual(PNG_SIGNATURE);
    expect(image.missing).toBe("");
  });

  it.each([
    ["日本語と英語の文字", text("部品 Kettle")],
    ["太字", text("Kettle", "Noto Sans JP, sans-serif", "700")],
    ["等幅の文字", text("mass = 1.0 [kg]", "monospace")],
  ])("F-AI-3: %s を、同梱のフォントで描く（その所のフォントに頼らない）", (_title, body) => {
    // Act
    const drawn = rasterizer.png(svgOf(body), 1);
    const blank = rasterizer.png(svgOf(""), 1);
    // Assert（描けなかった文字が無く、文字の無い画像とは違う画像になる）
    expect(drawn.missing).toBe("");
    expect(Buffer.from(drawn.data).equals(Buffer.from(blank.data))).toBe(false);
  });

  it("F-AI-3: 普通の太さと太字は、違う形で描く（太字のフォントを使う）", () => {
    // Act
    const regular = rasterizer.png(svgOf(text("Kettle")), 1);
    const bold = rasterizer.png(svgOf(text("Kettle", "Noto Sans JP, sans-serif", "700")), 1);
    // Assert
    expect(Buffer.from(regular.data).equals(Buffer.from(bold.data))).toBe(false);
  });

  it("F-AI-3: 同梱のフォントに無い文字は、黙って欠かさずに、描けなかった文字として返す（異常系）", () => {
    // Act（ハングルは、同梱のフォントに無い）
    const image = rasterizer.png(svgOf(text("部品 한글 한")), 1);
    // Assert（重なりを除き、文字の順。描ける文字は入らない）
    expect(image.missing).toBe("글한");
  });

  it("F-AI-3: SVG として読めないときは、理由つきで断る（異常系）", () => {
    // Act
    const run = () => rasterizer.png("<p>not a diagram</p>", 1);
    // Assert
    expect(run).toThrow(new Refused("The diagram could not be read as SVG."));
  });

  it("F-AI-3: 公開のサンプルの図は、どれも描けなかった文字なしで PNG になる（正常系）", () => {
    // Arrange
    const file = "electric-kettle.sysml";
    const project = { files: [{ path: file, text: readFileSync(new URL(`../../web/src/samples/${file}`, import.meta.url), "utf8") }], unreadable: [], pluginFiles: {} };
    const renderer = loadWebRenderer();
    // Act
    const images = ["all", "structure", "trace", "control", "behavior"].map((auto) =>
      rasterizer.png(renderer.render(project, { file, auto, format: "svg" }).content, 1));
    // Assert
    expect(images.map((i) => i.missing)).toEqual(["", "", "", "", ""]);
    expect(images.every((i) => i.width > 0 && i.height > 0)).toBe(true);
  });
});

describe("rasterReason", () => {
  it.each([
    ["svg", "The diagram could not be read as SVG."],
    ["size", "The image would be empty or too large. Use a smaller scale."],
    ["encode", "The image could not be written as PNG."],
    ["oops", "The diagram could not be drawn as PNG (oops)."],
  ])("理由のコード %s を、利用者に伝える文にする（知らないコードは、コードを添える）", (code, expected) => {
    // Act
    const got = rasterReason(code);
    // Assert
    expect(got).toBe(expected);
  });
});
