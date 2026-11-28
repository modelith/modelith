import { describe, expect, it } from "vitest";
import { renamedMessage } from "./rename-text";

describe("renamedMessage（F-EDIT-3。#266）", () => {
  it("参照も書き換えたときは、使っている箇所も変えたと添える", () => {
    // Act
    const msg = renamedMessage("A", "B", "part def A; part a : A;", "part def B; part a : B;");
    // Assert
    expect(msg).toBe("「A」を「B」に変更しました。このファイルの中で使っている箇所も変えました");
  });

  it("宣言の名前だけを変えたとき（置いた直後の仮の名前など）は、参照の話をしない（境界値）", () => {
    // Act
    const msg = renamedMessage("NewRequirement", "Quiet", "requirement def NewRequirement;", "requirement def Quiet;");
    // Assert
    expect(msg).toBe("「NewRequirement」を「Quiet」に変更しました");
  });

  it("新しい名前がもともとテキストにあっても、増えた数で判断する", () => {
    // Act
    const msg = renamedMessage("A", "Lamp", "// Lamp\npart def A;", "// Lamp\npart def Lamp;");
    // Assert
    expect(msg).toBe("「A」を「Lamp」に変更しました");
  });
  it("ほかのファイルの参照も変えたときは、そのファイルの名前と、未保存であることを示す（ADR-0021）", () => {
    // Act
    const one = renamedMessage("Cart", "Basket", "part def Cart;", "part def Basket;", ["app.sysml"]);
    const many = renamedMessage("Cart", "Basket", "part def Cart;", "part def Basket;", ["a.sysml", "b.sysml", "c.sysml", "d.sysml"]);
    // Assert（境界値：1 つ・上限を超える数）
    expect(one).toBe("「Cart」を「Basket」に変更しました。「app.sysml」で使っている箇所も変えました。「app.sysml」は未保存です");
    expect(many).toBe(
      "「Cart」を「Basket」に変更しました。「a.sysml」「b.sysml」「c.sysml」ほか 1 件で使っている箇所も変えました。「a.sysml」「b.sysml」「c.sysml」ほか 1 件は未保存です",
    );
  });
});
