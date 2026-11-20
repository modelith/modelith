// コマンドラインの引数の読み方の単体テスト。
import { expect, it } from "vitest";
import { exportOptions, parseArgs } from "./cli.ts";

it("mcp とフォルダを渡すと、そのコマンドにする（正常系）", () => {
  // Act
  const got = parseArgs(["mcp", "./kettle"]);
  // Assert
  expect(got).toEqual({ kind: "mcp", folder: "./kettle" });
});

it("引数なし・--help・-h は、誤りの無い使い方にする（正常系）", () => {
  // Act
  const got = [[], ["--help"], ["-h"]].map(parseArgs);
  // Assert
  expect(got).toEqual([{ kind: "usage" }, { kind: "usage" }, { kind: "usage" }]);
});

it("知らないコマンド・フォルダなし・余分な引数は、理由つきの使い方にする（異常系・境界値）", () => {
  // Act
  const got = [["check", "x"], ["mcp"], ["mcp", "a", "b"], ["export"], ["export", "--format", "svg"]].map(parseArgs);
  // Assert
  expect(got).toEqual([
    { kind: "usage", error: 'Unknown command "check".' },
    { kind: "usage", error: "The project folder is missing." },
    { kind: "usage", error: "Too many arguments." },
    { kind: "usage", error: "The project folder is missing." },
    { kind: "usage", error: "The project folder is missing." },
  ]);
});

it("export は、フォルダとオプションを読み、--out だけを分けて返す（正常系）", () => {
  // Act
  const toStdout = parseArgs(["export", "./kettle", "--format", "svg", "--diagram", "Shop::overview"]);
  const toFile = parseArgs(["export", "./kettle", "--format", "drawio", "--file", "a.sysml", "--view", "structure", "--out", "a.drawio"]);
  const bySubject = parseArgs(["export", "./kettle", "--format", "svg", "--subject", "Shop::Cart"]);
  const bare = parseArgs(["export", "./kettle"]);
  // Assert
  expect(bySubject).toEqual({ kind: "export", folder: "./kettle", args: { format: "svg", subject: "Shop::Cart" } });
  expect(toStdout).toEqual({ kind: "export", folder: "./kettle", args: { format: "svg", diagram: "Shop::overview" } });
  expect(toFile).toEqual({ kind: "export", folder: "./kettle", args: { format: "drawio", file: "a.sysml", view: "structure" }, out: "a.drawio" });
  expect(bare).toEqual({ kind: "export", folder: "./kettle", args: {} });
});

it("export のオプションは、知らない名前・値なし・2 回の指定を理由つきで断る（異常系・境界値）", () => {
  // Act
  const got = [["--colour", "red"], ["svg"], ["--format"], ["--format", "svg", "--format", "drawio"], []].map(exportOptions);
  const viaParse = parseArgs(["export", "./kettle", "--format"]);
  // Assert
  expect(got).toEqual(['Unknown option "--colour".', 'Unknown option "svg".', "--format needs a value.", "--format is given twice.", {}]);
  expect(viaParse).toEqual({ kind: "usage", error: "--format needs a value." });
});
