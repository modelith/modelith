import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isEmptyLayout, keepExtras, layoutExtras, NO_EXTRAS, parseLayoutFile, serializeLayout, usedFeatures, writeLock } from "./layout-file";
import type { Layout } from "./layout";

const L: Layout = {
  trace: { pos: { B: [10, 20], A: [0, 0] }, pins: { A: { a2: ["r", 0.5], a1: ["l", 0.3] } }, ends: { "e|A|B": ["a1", null] } },
  ibd: { pos: {}, pins: {}, ends: {} },
};

describe("serializeLayout（ADR-0005）", () => {
  it("キー順を固定し、要素ごとに 1 行で書く（空のビューは書かない）", () => {
    // Arrange・Act
    const text = serializeLayout(L);
    // Assert
    expect(text).toBe(`{
  "modelith": "layout",
  "format": 1,
  "views": {
    "trace": {
      "@ends": {
        "e|A|B": ["a1",null]
      },
      "@pins": {
        "A": {"a1":["l",0.3],"a2":["r",0.5]}
      },
      "A": [0,0],
      "B": [10,20]
    }
  }
}
`);
  });

  it("書く順は、配置を作った順に左右されない（同じ配置なら同じ文字列）", () => {
    // Arrange
    const other: Layout = { trace: { pos: { A: [0, 0], B: [10, 20] }, pins: { A: { a1: ["l", 0.3], a2: ["r", 0.5] } }, ends: L.trace!.ends } };
    // Act・Assert
    expect(serializeLayout(other)).toBe(serializeLayout(L));
  });

  it("空の配置も、読み直せる形で書く（境界値）", () => {
    // Arrange・Act
    const text = serializeLayout({});
    // Assert
    expect(parseLayoutFile(text)).toEqual({ layout: {}, error: null });
  });
});

describe("parseLayoutFile（ADR-0005）", () => {
  it("書いたものを読み直すと、同じ配置に戻る（空のビューを除く）", () => {
    // Arrange
    const text = serializeLayout(L);
    // Act
    const r = parseLayoutFile(text);
    // Assert
    expect(r.error).toBeNull();
    expect(r.layout).toEqual({ trace: L.trace });
  });

  it("空のファイルは、空の配置として読む（境界値）", () => {
    // Arrange・Act・Assert
    expect(parseLayoutFile("  \n")).toEqual({ layout: {}, error: null });
  });

  it.each([
    ["{ broken", "配置ファイルを読めません（JSON の形が壊れています）"],
    ['{"views":{}}', "配置ファイルの形が違います"],
    ['{"modelith":"layout","format":2,"views":{}}', "配置ファイルの形式（2）に対応していません"],
  ])("読めない内容（%s）は、理由を添えて空の配置にする（異常系）", (text, error) => {
    // Arrange・Act
    const r = parseLayoutFile(text);
    // Assert
    expect(r).toEqual({ layout: {}, error });
  });
});

describe("isEmptyLayout", () => {
  it("座標・接続点・線の端のどれかがあれば空ではない", () => {
    // Arrange・Act・Assert
    expect(isEmptyLayout({})).toBe(true);
    expect(isEmptyLayout({ v: { pos: {}, pins: {}, ends: {} } })).toBe(true);
    expect(isEmptyLayout(L)).toBe(false);
  });
});

/**
 * 新しい版が書く配置ファイルの見本を読む（ADR-0023 §6、web/src/app/compat/）。
 *
 * @param name 見本のファイル名
 * @returns 見本の中身
 */
const sample = (name: string): string => readFileSync(new URL(`./compat/${name}`, import.meta.url), "utf8");

describe("serializeLayout の知らない項目（ADR-0023）", () => {
  it("外側の知らない項目は views の後に、ビューの知らない項目はそのビューに書き戻す", () => {
    // Arrange
    const layout: Layout = { trace: { pos: { A: [0, 0] }, pins: {}, ends: {} } };
    // Act
    const text = serializeLayout(layout, { top: { writer: "0.3.0" }, views: { trace: { "@future": { e: [[1, 2]] } } } });
    // Assert
    expect(text).toBe(`{
  "modelith": "layout",
  "format": 1,
  "views": {
    "trace": {
      "@future": {"e":[[1,2]]},
      "A": [0,0]
    }
  },
  "writer": "0.3.0"
}
`);
  });

  it("知らない項目だけのビューも消さない（境界値）", () => {
    // Act
    const text = serializeLayout({}, { top: {}, views: { ibd: { "@future": 1 } } });
    // Assert
    expect(JSON.parse(text).views).toEqual({ ibd: { "@future": 1 } });
  });
});

describe("layoutExtras（ADR-0023）", () => {
  it("知らない外側の項目と、ビューの中の知らない @ の項目を取り出す（知っている項目と要素の座標は取り出さない）", () => {
    // Arrange（0.2 は線の調整 @bends・@anchors を知っている）
    const text =
      '{"modelith":"layout","format":1,"views":{"trace":{"A":[0,0],"@pins":{},"@bends":{"e":[[1,2]]},"@future":{"x":1}}},"requires":["edge-shapes"],"writer":"0.3.0"}';
    // Act
    const extras = layoutExtras(text);
    // Assert
    expect(extras).toEqual({ top: { requires: ["edge-shapes"], writer: "0.3.0" }, views: { trace: { "@future": { x: 1 } } } });
  });

  it.each(["", "{ broken", sample("layout-format-2.json")])("空・読めないファイルからは何も取り出さない（境界値・異常系）", (text) => {
    // Act / Assert
    expect(layoutExtras(text)).toBe(NO_EXTRAS);
  });
});

describe("writeLock（ADR-0023）", () => {
  it("空のファイルと、この版の読めるファイルは保存してよい", () => {
    // Act / Assert
    expect([writeLock(""), writeLock(serializeLayout(L)), writeLock(sample("layout-0.2-bends.json"))]).toEqual([null, null, null]);
  });

  it("中身の無いオブジェクト（{}）は、失うものが無いので保存してよい（境界値）", () => {
    // Act / Assert
    expect([writeLock("{}"), writeLock("  {}\n")]).toEqual([null, null]);
  });

  it("requires が空なら保存してよい（境界値）", () => {
    // Arrange
    const text = '{"modelith":"layout","format":1,"views":{},"requires":[]}';
    // Act / Assert
    expect(writeLock(text)).toBeNull();
  });

  it("この版の知らない機能が requires にあれば、その名前を添えて保存しない", () => {
    // Arrange（0.2 は edge-shapes を知っているので、知らない名前を使う）
    const text = '{"modelith":"layout","format":1,"views":{},"requires":["edge-shapes","shared-layers"]}';
    // Act
    const reason = writeLock(text);
    // Assert
    expect(reason).toBe("配置ファイルに、新しい版の Modelith で使った機能（shared-layers）が入っています。ファイルを守るため、この版では図の配置を保存しません");
  });

  it("この版の知っている機能（線の調整）だけが requires にあれば、保存してよい", () => {
    // Act / Assert
    expect(writeLock(sample("layout-requires.json"))).toBeNull();
  });

  it.each([
    ["{ broken", "配置ファイルを読めません（JSON の形が壊れています）"],
    ['{"views":{}}', "配置ファイルの形が違います"],
    [sample("layout-format-2.json"), "配置ファイルの形式（2）に対応していません"],
  ])("読めないファイル（%s）は、空の配置で上書きしないよう保存しない（異常系）", (text, error) => {
    // Act / Assert
    expect(writeLock(text)).toBe(`${error}。ファイルを守るため、この版では図の配置を保存しません`);
  });
});

describe("keepExtras（ADR-0023 §6 の往復）", () => {
  it("0.2 の線の調整を含む配置ファイルを読み、要素を動かして保存しても、線の調整を消さない", () => {
    // Arrange
    const base = sample("layout-0.2-bends.json");
    const layout = parseLayoutFile(base).layout;
    layout["trace"]!.pos["A"] = [10, 10];
    // Act
    const saved = JSON.parse(keepExtras(serializeLayout(layout), base));
    // Assert
    expect(saved.views.trace["@bends"]).toEqual({ "e|A|B": [[50, 10], [50, 40]] });
    expect(saved.views.trace["@anchors"]).toEqual({ "e|A|B": [["r", 0.5], null] });
    expect(saved.views.trace.A).toEqual([10, 10]);
  });

  it("線の調整は知っている項目なので、調整し直して保存すると、ファイルの古い形で上書きしない", () => {
    // Arrange
    const base = sample("layout-0.2-bends.json");
    const layout = parseLayoutFile(base).layout;
    layout["trace"]!.bends = { "e|A|B": [[70, 20]] };
    // Act
    const saved = JSON.parse(keepExtras(serializeLayout(layout), base));
    // Assert
    expect(saved.views.trace["@bends"]).toEqual({ "e|A|B": [[70, 20]] });
  });

  it("読んだときのファイルに知らない項目が無ければ、書いたものをそのまま返す（境界値）", () => {
    // Arrange
    const text = serializeLayout(L);
    // Act / Assert
    expect([keepExtras(text, ""), keepExtras(text, serializeLayout({}))]).toEqual([text, text]);
  });

  it("保存し直したものを読み直すと、知らない項目がまた取り出せる（往復しても変わらない）", () => {
    // Arrange
    const base = sample("layout-requires.json");
    // Act
    const once = keepExtras(serializeLayout(parseLayoutFile(base).layout), base);
    const twice = keepExtras(serializeLayout(parseLayoutFile(once).layout), once);
    // Assert
    expect(layoutExtras(once)).toEqual(layoutExtras(base));
    expect(twice).toBe(once);
  });
});

describe("requires の線の調整（ADR-0023 §3・§7）", () => {
  const shaped: Layout = { trace: { pos: { A: [0, 0] }, pins: {}, ends: {}, bends: { e: [[1, 2]] } } };
  const plain: Layout = { trace: { pos: { A: [0, 0] }, pins: {}, ends: {} } };

  it("線の調整（曲がり角・端の位置）を使っていれば、edge-shapes を使っていると判定する", () => {
    // Arrange
    const anchored: Layout = { trace: { pos: {}, pins: {}, ends: {}, anchors: { e: [["r", 0.5], null] } } };
    // Act / Assert
    expect([usedFeatures(shaped), usedFeatures(anchored), usedFeatures(plain), usedFeatures({})]).toEqual([["edge-shapes"], ["edge-shapes"], [], []]);
  });

  it("線の調整を使っていれば requires に edge-shapes を書き、0.1 が書き換えないようにする", () => {
    // Act
    const text = serializeLayout(shaped);
    // Assert
    expect(JSON.parse(text).requires).toEqual(["edge-shapes"]);
    expect(text.endsWith('  },\n  "requires": ["edge-shapes"]\n}\n')).toBe(true);
  });

  it("線の調整を使わなくなったら、読んだときにあった edge-shapes も外す（境界値）", () => {
    // Act
    const text = serializeLayout(plain, { top: { requires: ["edge-shapes"] }, views: {} });
    // Assert
    expect(JSON.parse(text).requires).toBeUndefined();
  });

  it("読んだときにあった、この版の知らない機能の名前は残し、名前の順に並べる", () => {
    // Act
    const text = serializeLayout(shaped, { top: { requires: ["shared-layers", "edge-shapes"] }, views: {} });
    // Assert
    expect(JSON.parse(text).requires).toEqual(["edge-shapes", "shared-layers"]);
  });

  it("線の調整を使わない配置には requires を書かない（今までと同じ中身）", () => {
    // Act / Assert
    expect(serializeLayout(plain)).not.toContain("requires");
  });
});
