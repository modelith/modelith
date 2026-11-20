// フォルダを読む口の結合テスト（本物のファイルシステム。一時フォルダを使う）。
// 読むのはフォルダの中だけ（ADR-0024 の 5）であることと、`modelith check` と同じファイルを読むことを確かめる。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fsProjectReader, fsProjectWriter, isModelFile, isSkippedDir, layoutPathFor } from "./fs-project.ts";

let root: string;
let folder: string;

/** プロジェクトのフォルダにファイルを書く（途中のフォルダも作る）。 */
function write(path: string, content: string | Uint8Array): void {
  const full = join(folder, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "modelith-cli-"));
  folder = join(root, "project");
  mkdirSync(folder);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("どれを読むか（判断）", () => {
  it("モデルのファイルは .sysml と .kerml（拡張子だけの名前は除く。境界値）", () => {
    // Act
    const got = ["a.sysml", "a.kerml", ".sysml", "a.sysml.bak", "a.txt"].map(isModelFile);
    // Assert
    expect(got).toEqual([true, true, false, false, false]);
  });

  it("隠しフォルダ・target・node_modules はたどらない（同値分割）", () => {
    // Act
    const got = [".modelith", ".git", "target", "node_modules", "parts", "targets"].map(isSkippedDir);
    // Assert
    expect(got).toEqual([true, true, true, true, false, false]);
  });
});

describe("fsProjectReader", () => {
  it("モデルのファイルを、下のフォルダも含めて名前の順に読む（正常系）", async () => {
    // Arrange
    write("b.sysml", "package B;");
    write("a.kerml", "package A;");
    write("parts/wheel.sysml", "package Wheel;");
    write("notes.txt", "x");
    write("node_modules/dep/x.sysml", "package X;");
    write(".hidden/y.sysml", "package Y;");
    // Act
    const project = await fsProjectReader(folder).read();
    // Assert
    expect(project.files).toEqual([
      { path: "a.kerml", text: "package A;" },
      { path: "b.sysml", text: "package B;" },
      { path: "parts/wheel.sysml", text: "package Wheel;" },
    ]);
    expect(project.unreadable).toEqual([]);
    expect(project.projectFile).toBeUndefined();
    expect(project.pluginFiles).toEqual({});
    expect(project.layouts).toEqual({});
  });

  it("モデルのファイルの隣の配置ファイルを読む。無いファイルの分は入れない（正常系）", async () => {
    // Arrange
    write("a.sysml", "package A;");
    write("a.layout.json", '{"modelith":"layout"}');
    write("parts/B.KERML", "package B;");
    write("parts/B.layout.json", "{}");
    write("c.sysml", "package C;");
    // Act
    const project = await fsProjectReader(folder).read();
    const names = ["parts/kettle.sysml", "a.KERML", "notes.txt"].map(layoutPathFor);
    // Assert
    expect(project.layouts).toEqual({ "a.sysml": '{"modelith":"layout"}' });
    expect(names).toEqual(["parts/kettle.layout.json", "a.layout.json", "notes.txt.layout.json"]);
  });

  it("設定ファイルと、プラグインのマニフェスト・ルールを読む（正常系）", async () => {
    // Arrange
    write("modelith.json", '{ "plugins": { "jp.x": {} } }');
    write(".modelith/plugins/jp.x/modelith-plugin.json", "{}");
    write(".modelith/plugins/jp.x/rules/a.yaml", "rules: []");
    write(".modelith/plugins/jp.x/main.js", "ignored");
    // Act
    const project = await fsProjectReader(folder).read();
    // Assert
    expect(project.projectFile).toBe('{ "plugins": { "jp.x": {} } }');
    expect(project.pluginFiles).toEqual({ "jp.x": { "modelith-plugin.json": "{}", "rules/a.yaml": "rules: []" } });
  });

  it("空のフォルダは、空のプロジェクトとして読む（境界値）", async () => {
    // Act
    const project = await fsProjectReader(folder).read();
    // Assert
    expect(project).toEqual({ files: [], unreadable: [], projectFile: undefined, pluginFiles: {}, layouts: {} });
  });

  it("UTF-8 でないファイルは、読めなかったファイルとして理由つきで返す（異常系）", async () => {
    // Arrange
    write("ok.sysml", "package Ok;");
    write("bad.sysml", new Uint8Array([0xff, 0xfe, 0x00]));
    // Act
    const project = await fsProjectReader(folder).read();
    // Assert
    expect(project.files.map((f) => f.path)).toEqual(["ok.sysml"]);
    expect(project.unreadable).toEqual([{ path: "bad.sysml", reason: "not UTF-8 text" }]);
  });

  it("シンボリックリンクはたどらず、フォルダの外のファイルを読まない（異常系）", async () => {
    // Arrange（フォルダの外のファイルとフォルダを、中からリンクする）
    writeFileSync(join(root, "outside.sysml"), "package Secret;");
    mkdirSync(join(root, "outside-dir"));
    writeFileSync(join(root, "outside-dir", "z.sysml"), "package Z;");
    symlinkSync(join(root, "outside.sysml"), join(folder, "link.sysml"));
    symlinkSync(join(root, "outside-dir"), join(folder, "linked-dir"));
    symlinkSync(join(root, "outside.sysml"), join(folder, "modelith.json"));
    write("in.sysml", "package In;");
    // Act
    const project = await fsProjectReader(folder).read();
    // Assert
    expect(project.files).toEqual([{ path: "in.sysml", text: "package In;" }]);
    expect(project.projectFile).toBeUndefined();
    expect(project.unreadable).toEqual([{ path: "modelith.json", reason: "symbolic links are not read" }]);
  });

  it("フォルダが無ければ、例外で拒否する（異常系）", async () => {
    // Act
    const read = fsProjectReader(join(root, "nope")).read();
    // Assert
    await expect(read).rejects.toThrow();
  });
});

describe("fsProjectWriter", () => {
  it("モデルのファイルを書き換える（下のフォルダのファイルも。正常系）", async () => {
    // Arrange
    write("a.sysml", "package A;");
    write("parts/wheel.sysml", "package Wheel;");
    // Act
    await fsProjectWriter(folder).write("a.sysml", "package A2;");
    await fsProjectWriter(folder).write("parts/wheel.sysml", "package 車輪;");
    // Assert
    expect(readFileSync(join(folder, "a.sysml"), "utf8")).toBe("package A2;");
    expect(readFileSync(join(folder, "parts/wheel.sysml"), "utf8")).toBe("package 車輪;");
  });

  it("フォルダの外・無いファイル・設定ファイル・プラグイン・モデルでないファイルには書かない（異常系）", async () => {
    // Arrange
    writeFileSync(join(root, "outside.sysml"), "package Secret;");
    write("modelith.json", "{}");
    write(".modelith/plugins/jp.x/rules.yaml", "rules: []");
    write("notes.txt", "x");
    const writer = fsProjectWriter(folder);
    // Act
    const attempts = await Promise.allSettled(
      ["../outside.sysml", "new.sysml", "modelith.json", ".modelith/plugins/jp.x/rules.yaml", "notes.txt", ""]
        .map((path) => writer.write(path, "changed")),
    );
    // Assert
    expect(attempts.map((a) => a.status === "rejected" && /is not a model file of the project/.test(String(a.reason))))
      .toEqual([true, true, true, true, true, true]);
    expect(readFileSync(join(root, "outside.sysml"), "utf8")).toBe("package Secret;");
    expect(readFileSync(join(folder, "modelith.json"), "utf8")).toBe("{}");
  });

  it("シンボリックリンクには書かず、リンクの先を書き換えない（異常系）", async () => {
    // Arrange
    writeFileSync(join(root, "outside.sysml"), "package Secret;");
    symlinkSync(join(root, "outside.sysml"), join(folder, "link.sysml"));
    // Act
    const attempt = fsProjectWriter(folder).write("link.sysml", "changed");
    // Assert
    await expect(attempt).rejects.toThrow();
    expect(readFileSync(join(root, "outside.sysml"), "utf8")).toBe("package Secret;");
  });
});
