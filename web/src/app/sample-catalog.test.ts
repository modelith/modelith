// 公式のサンプル集（F-FILE-20）の単体テスト。サンプルは本物のコア（Rust の wasm）で読む。
import { describe, expect, it } from "vitest";
import { build, parse } from "../core/rust";
import { START_SAMPLE, sampleChoices } from "./sample-catalog";

describe("sampleChoices（サンプルの一覧、F-FILE-20）", () => {
  it("入門を先に、分野ごとのモデルを後に並べ、どれにも名前と説明を付ける", () => {
    // Act
    const got = sampleChoices();
    // Assert
    expect(got.map((s) => s.id)).toEqual(["intro-requirements", "intro-structure", "intro-behavior", "electric-kettle", "delivery-drone"]);
    expect(got.map((s) => s.title)).toEqual([
      "入門：要求のトレース（自転車のライト）",
      "入門：構造と接続（卓上扇風機）",
      "入門：振る舞い（自動ドア）",
      "家電：電気ケトル",
      "モビリティ：配送ドローン",
    ]);
    expect(got.every((s) => s.note.length > 0 && !s.note.startsWith("app-files-samples-"))).toBe(true);
  });

  it("ファイル名は重ならず、どれも .sysml で終わる", () => {
    // Act
    const names = sampleChoices().map((s) => s.doc.name);
    // Assert
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.endsWith(".sysml"))).toBe(true);
  });

  it.each(sampleChoices().map((s) => [s.doc.name, s.doc.text] as const))("%s は、エラー無しで読め、図に出す要素がある", (_name, text) => {
    // Act
    const model = build(parse(text));
    // Assert（トレースの抜けの知らせ（gap）は、学ぶ材料として残してよい）
    expect(model.problems.filter((p) => p.kind !== "gap")).toEqual([]);
    expect(model.nodes.length).toBeGreaterThan(0);
  });

  it("起動したときのサンプルは、一覧の電気ケトルと同じ", () => {
    // Act
    const kettle = sampleChoices().find((s) => s.id === "electric-kettle");
    // Assert
    expect(kettle?.doc).toEqual(START_SAMPLE);
  });
});
