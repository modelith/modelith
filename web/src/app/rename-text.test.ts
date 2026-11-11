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
});
