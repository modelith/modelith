// 画面に出す名前（ADR-0014、docs/development/ui-writing.md）。
import { describe, expect, it } from "vitest";
import { standardViewName, stdViewLabel } from "../core";
import { attrText, docChangedMessage, savedViewHint, shownEdgeLabel, shownName, tabTitle, typeText, v2ViewNote, viewHint } from "./labels";
import { VIEWS } from "./view-content";

describe("図の種類の呼び名（ViewDef.diagramName）", () => {
  it("名前が「図」で終わらない図の種類は、「〜の図」と呼ぶ", () => {
    // Arrange
    const ids = ["trace", "control", "behavior", "all"];
    // Act
    const names = ids.map((id) => VIEWS.find((v) => v.id === id)?.diagramName);
    // Assert
    expect(names).toEqual(["トレーサビリティの図", "制御ループの図", "振る舞いの図", "すべての図"]);
  });

  it("名前が「図」で終わる図の種類は、名前のまま呼ぶ（「ブロック定義図の図」にしない）", () => {
    // Arrange
    const ids = ["structure", "ibd", "seq", "afv", "stm"];
    // Act
    const names = ids.map((id) => VIEWS.find((v) => v.id === id)?.diagramName);
    // Assert
    expect(names).toEqual(["ブロック定義図", "内部ブロック図", "シーケンス図", "アクティビティ図", "状態遷移図"]);
  });

  it("どの図の種類にも、呼び名がある", () => {
    // Arrange
    const missing = VIEWS.filter((v) => !v.diagramName);
    // Act
    const ids = missing.map((v) => v.id);
    // Assert
    expect(ids).toEqual([]);
  });
});

describe("stdViewLabel（標準ビューの、広く知られた名前。ui-writing の決まり 9）", () => {
  const cases: [string, string][] = [
    ["GeneralView", "一般ビュー"],
    ["InterconnectionView", "内部ブロック図"],
    ["StateTransitionView", "状態遷移図"],
    ["SequenceView", "シーケンス図"],
    ["ActionFlowView", "アクティビティ図"],
    ["GeometryView", "ジオメトリビュー"],
    ["GridView", "グリッドビュー"],
    ["BrowserView", "ブラウザビュー"],
  ];
  for (const [std, label] of cases) {
    it(`${std} は「${label}」と呼ぶ`, () => {
      // Arrange（標準ビュー定義ごとの同値クラス）
      const name = std;
      // Act
      const shown = stdViewLabel(name);
      // Assert
      expect(shown).toBe(label);
    });
  }

  it("型の無い図は「一般ビュー」と呼ぶ（null）", () => {
    // Arrange
    const std = null;
    // Act
    const shown = stdViewLabel(std);
    // Assert
    expect(shown).toBe("一般ビュー");
  });
});

describe("standardViewName（標準ビュー定義の名前にそろえる）", () => {
  it("短い名前は、標準ビュー定義の名前にする", () => {
    // Arrange
    const short = "afv";
    // Act
    const std = standardViewName(short);
    // Assert
    expect(std).toBe("ActionFlowView");
  });

  it("標準ビュー定義の名前は、そのまま返す", () => {
    // Arrange
    const name = "StateTransitionView";
    // Act
    const std = standardViewName(name);
    // Assert
    expect(std).toBe("StateTransitionView");
  });

  it("標準ビュー定義でない名前は null（異常系。Object の持つ名前も含む）", () => {
    // Arrange
    const names = ["MyView", "toString", ""];
    // Act
    const std = names.map(standardViewName);
    // Assert
    expect(std).toEqual([null, null, null]);
  });
});

describe("v2ViewNote・viewHint（SysML v2 の標準ビューの補足）", () => {
  it("画面の名前が標準ビューの名前と同じなら、標準ビューの名前だけを添える", () => {
    // Arrange
    const [label, std] = ["アクティビティ図", "ActionFlowView"];
    // Act
    const hint = viewHint(label, std);
    // Assert
    expect(hint).toBe("アクティビティ図（SysML v2 では ActionFlowView）");
  });

  it("Modelith 独自の図は「〜で描く図」と添える", () => {
    // Arrange
    const [label, std] = ["トレーサビリティ", "GeneralView"];
    // Act
    const note = v2ViewNote(label, std);
    // Assert
    expect(note).toBe("SysML v2 では GeneralView で描く図");
  });

  it("表に無い標準ビューの名前でも、名前をそのまま添える（異常系）", () => {
    // Arrange（stdViewLabel は知らない名前をそのまま返すので、同じ名前とみなす）
    const [label, std] = ["MyView", "MyView"];
    // Act
    const hint = viewHint(label, std);
    // Assert
    expect(hint).toBe("MyView（SysML v2 では MyView）");
  });

  it("＋メニューに出す 8 つの自動の図のツールチップは、当たる標準ビューを添える", () => {
    // Arrange
    const views = VIEWS.filter((v) => !v.hidden);
    // Act
    const hints = views.map((v) => viewHint(v.label, v.std));
    // Assert
    expect(hints).toEqual([
      "トレーサビリティ（SysML v2 では GeneralView で描く図）",
      "ブロック定義図（SysML v2 では GeneralView で描く図）",
      "制御ループ（SysML v2 では GeneralView で描く図）",
      "内部ブロック図（SysML v2 では InterconnectionView）",
      "振る舞い（SysML v2 では GeneralView で描く図）",
      "シーケンス図（SysML v2 では SequenceView）",
      "アクティビティ図（SysML v2 では ActionFlowView）",
      "すべて（SysML v2 では GeneralView で描く図）",
    ]);
  });

  it("一覧に出さない状態遷移図も、StateTransitionView を添える（ツリーから開いたタブのツールチップ）", () => {
    // Arrange
    const stm = VIEWS.find((v) => v.id === "stm");
    // Act
    const hint = stm ? viewHint(stm.label, stm.std) : null;
    // Assert
    expect(hint).toBe("状態遷移図（SysML v2 では StateTransitionView）");
  });
});

describe("savedViewHint（作成した図の種類のツールチップ）", () => {
  it("型のある view は、その標準ビューの名前で書く", () => {
    // Arrange
    const std = "InterconnectionView";
    // Act
    const hint = savedViewHint(std);
    // Assert
    expect(hint).toBe("内部ブロック図（SysML v2 では InterconnectionView）");
  });

  it("型の無い view は、一般ビュー（GeneralView）として書く（null）", () => {
    // Arrange
    const std = null;
    // Act
    const hint = savedViewHint(std);
    // Assert
    expect(hint).toBe("一般ビュー（SysML v2 では GeneralView）");
  });
});

describe("tabTitle（タブのツールチップ）", () => {
  it("タブの名前が図の種類の名前と同じなら、補足つきの文だけにする", () => {
    // Arrange
    const hint = "すべて（SysML v2 では GeneralView で描く図）";
    // Act
    const title = tabTitle("すべて", "すべて", hint);
    // Assert
    expect(title).toBe(hint);
  });

  it("対象の付いたタブは、名前の下の行に補足つきの文を出す", () => {
    // Arrange
    const hint = "内部ブロック図（SysML v2 では InterconnectionView）";
    // Act
    const title = tabTitle("ibd Vehicle", "内部ブロック図", hint);
    // Assert
    expect(title).toBe("ibd Vehicle\n内部ブロック図（SysML v2 では InterconnectionView）");
  });

  it("名前が図の種類の名前の頭の一部でしかなければ、同じとみなさない（境界値）", () => {
    // Arrange
    const hint = "すべて（SysML v2 では GeneralView で描く図）";
    // Act
    const title = tabTitle("すべ", "すべて", hint);
    // Assert
    expect(title).toBe(`すべ\n${hint}`);
  });
});

describe("typeText（宣言の型の表示）", () => {
  it("型が 1 つならその名前、複数なら書いた順にカンマでつなぐ（同値分割：1 つ・2 つ・3 つ）", () => {
    // Act
    const got = [
      typeText({ type: "A" }),
      typeText({ type: "A", moreTypes: [{ name: "B" }] }),
      typeText({ type: "A", moreTypes: [{ name: "B" }, { name: "C" }] }),
    ];
    // Assert
    expect(got).toEqual(["A", "A, B", "A, B, C"]);
  });

  it("型が無ければ空文字列にする。引用名のエスケープは、表す文字に戻す（境界値）", () => {
    // Act
    const got = [typeText({ type: "" }), typeText({ type: "", moreTypes: [] }), typeText({ type: "a\\'b", moreTypes: [{ name: "c\\'d" }] })];
    // Assert
    expect(got).toEqual(["", "", "a'b, c'd"]);
  });
});

describe("attrText（属性の表示）", () => {
  it("名前・型・値を「名前 : 型 = 値」の形にする（正常系）", () => {
    // Act / Assert
    expect(attrText({ name: "mass", type: "Real", value: "1500 [kg]" })).toBe("mass : Real = 1500 [kg]");
  });

  it("値の書き方（:=・default）はそのまま書く", () => {
    // Act / Assert
    expect(attrText({ name: "t", type: "Real", value: "0", valueOp: ":=" })).toBe("t : Real := 0");
    expect(attrText({ name: "d", type: "", value: "2", valueOp: "default" })).toBe("d default 2");
  });

  it("型も値も無ければ名前だけ（境界値）", () => {
    // Act / Assert
    expect(attrText({ name: "重さ", type: "" })).toBe("重さ");
  });
});

describe("docChangedMessage（説明を書き換えたときのトースト。F-EDIT-12、#244）", () => {
  it("書き換え・消す・「*/」を含む文で、文を変える（同値分割）", () => {
    // Act
    const changed = docChangedMessage("R", "要求の文章", "3 分で沸かす");
    const removed = docChangedMessage("A", "説明", "  ");
    const replaced = docChangedMessage("A", "説明", "a */ b");
    // Assert
    expect(changed).toBe("「R」の要求の文章を変えました");
    expect(removed).toBe("「A」の説明を消しました");
    expect(replaced).toBe("「A」の説明を変えました。「*/」はテキストに書けないため「* /」にしました");
  });
});

describe("shownName（引用名のエスケープを、表す文字に戻して見せる。#297）", () => {
  it("「\\'」「\\\"」「\\\\」を、表す文字に戻す（同値分割：3 つのエスケープ）", () => {
    // Act
    const names = ["a\\'b", 'say \\"hi\\"', "x\\\\y"].map(shownName);
    // Assert
    expect(names).toEqual(["a'b", 'say "hi"', "x\\y"]);
  });

  it("エスケープの無い名前は変えない（正常系・境界値：空の名前）", () => {
    // Act
    const names = ["Engine", "電気 ケトル", "it:s", ""].map(shownName);
    // Assert
    expect(names).toEqual(["Engine", "電気 ケトル", "it:s", ""]);
  });

  it("「\\\\」の後ろの「'」を、もう一度エスケープとして読まない（境界値：続いたエスケープ）", () => {
    // Act（テキストでは 'a\\\'b'：バックスラッシュ 1 つと「'」）
    const name = shownName("a\\\\\\'b");
    // Assert
    expect(name).toBe("a\\'b");
  });

  it("改行やタブのエスケープと、終わりに 1 つだけ残ったバックスラッシュは書いたままにする（異常系）", () => {
    // Act
    const names = ["a\\nb", "a\\tb", "a\\"].map(shownName);
    // Assert
    expect(names).toEqual(["a\\nb", "a\\tb", "a\\"]);
  });
});

describe("shownEdgeLabel（線のラベルの見せ方。#297）", () => {
  it("部品として持つ線のラベル（部品の名前）は、エスケープを戻す", () => {
    // Act
    const label = shownEdgeLabel({ kind: "comp", label: "q\\'r" });
    // Assert
    expect(label).toBe("q'r");
  });

  it("ほかの線のラベル（式を含むことがある）と、空のラベルはそのまま", () => {
    // Act
    const labels = [{ kind: "transition", label: "Go [x == '\\\\']" }, { kind: "comp", label: "" }].map(shownEdgeLabel);
    // Assert
    expect(labels).toEqual(["Go [x == '\\\\']", ""]);
  });
});
