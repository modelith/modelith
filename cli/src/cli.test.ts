// コマンドラインの引数の読み方の単体テスト。
import { expect, it } from "vitest";
import { parseArgs } from "./cli.ts";

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
  const got = [["check", "x"], ["mcp"], ["mcp", "a", "b"]].map(parseArgs);
  // Assert
  expect(got).toEqual([
    { kind: "usage", error: 'Unknown command "check".' },
    { kind: "usage", error: "The project folder is missing." },
    { kind: "usage", error: "Too many arguments." },
  ]);
});
