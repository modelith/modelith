// 利用状況の報告の組み立て（F-TEL-1）の単体テスト。
import { describe, expect, it } from "vitest";
import { dailyReport, environment, errorReport, stackFrames, startupReport } from "./report";
import { bump, emptyCounts, newState } from "./state";

const SENDER = { appVersion: "0.3.0-alpha.4", channel: "preview" } as const;
const BASE = "https://example.org/app/";

describe("報告を作る", () => {
  it("起動の報告は、版・系列・起動の時間の区分だけを持つ", () => {
    // Act
    const got = startupReport(850, SENDER);
    // Assert
    expect(got).toEqual({ kind: "startup", schemaVersion: 1, startupTime: "lt1s", client: "web", appVersion: "0.3.0-alpha.4", channel: "preview" });
  });

  it("日に 1 回のまとめは、環境・段階・回数・使った週の数の区分・初めて使った四半期を持ち、集計の日付は持たない", () => {
    // Arrange
    const state = newState(new Date("2026-11-28T10:00:00Z"));
    bump(state.counts, "edits.rename");
    state.onboarding.push("saved");
    state.weeks = 5;
    const env = environment("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36", 1280, "ja", true);
    // Act
    const got = dailyReport(state, env, SENDER);
    // Assert
    const counts = emptyCounts();
    counts.edits.rename = 1;
    expect(got).toEqual({
      kind: "daily", schemaVersion: 1,
      browser: "chrome", os: "windows", screen: "desktop", language: "ja", folderAccess: true,
      onboarding: ["saved"], ...counts, weeksUsed: "5to12", firstQuarter: "2026-Q4",
      client: "web", appVersion: "0.3.0-alpha.4", channel: "preview",
    });
  });

  it("エラーの報告は、例外の名前の区分と配信しているファイルの段だけを持ち、エラーの文を持たない", () => {
    // Arrange
    const error = new TypeError("要素「秘密の名前」が見つかりません");
    error.stack = `TypeError: 要素「秘密の名前」が見つかりません\n    at f (${BASE}assets/index-3f2a.js:10:20)`;
    // Act
    const got = errorReport(error, "uncaughtError", "errorsOnly", BASE, SENDER);
    // Assert
    expect(got).toEqual({
      kind: "error", schemaVersion: 1, level: "errorsOnly", errorKind: "uncaughtError", errorName: "typeError",
      frames: [{ module: "assets/index-3f2a.js", line: 10, column: 20 }],
      client: "web", appVersion: "0.3.0-alpha.4", channel: "preview",
    });
    expect(JSON.stringify(got)).not.toContain("秘密");
  });

  it("wasm の panic は、例外の名前を panic にする。Error でないものは、段なしで送る（境界値）", () => {
    // Act
    const panic = errorReport(new Error("unreachable"), "wasmPanic", "all", BASE, SENDER);
    const text = errorReport("boom", "unhandledRejection", "all", BASE, SENDER);
    // Assert
    expect(panic.errorName).toBe("panic");
    expect(text).toMatchObject({ errorName: "other", frames: [] });
  });
});

describe("stackFrames（スタックトレースから配信しているファイルの段だけを取り出す）", () => {
  it("Chrome の形と、Firefox・Safari の形を読む", () => {
    // Arrange
    const chrome = `Error: x\n    at run (${BASE}assets/index-3f2a.js:10:20)\n    at ${BASE}assets/worker-9c1d.js:3:4`;
    const firefox = `run@${BASE}assets/index-3f2a.js:10:20\n@${BASE}assets/worker-9c1d.js:3:4`;
    // Act・Assert
    const expected = [{ module: "assets/index-3f2a.js", line: 10, column: 20 }, { module: "assets/worker-9c1d.js", line: 3, column: 4 }];
    expect(stackFrames(chrome, BASE)).toEqual(expected);
    expect(stackFrames(firefox, BASE)).toEqual(expected);
  });

  it("wasm の段は、コアの関数の名前だけを残す（JS の関数名は残さない）", () => {
    // Arrange
    const stack = `RuntimeError: unreachable\n    at modelith_core::edit::ops::rename (${BASE}assets/modelith_wasm_bg-1a2b.wasm:wasm-function[412]:0x5f3c1)\n    at userNamedThing (${BASE}assets/index-3f2a.js:1:2)`;
    // Act
    const got = stackFrames(stack, BASE);
    // Assert
    expect(got).toEqual([
      { module: "assets/modelith_wasm_bg-1a2b.wasm", function: "modelith_core::edit::ops::rename" },
      { module: "assets/index-3f2a.js", line: 1, column: 2 },
    ]);
  });

  it("ほかのコードの段（拡張・プラグイン・別の配信元・assets の外）と、エラーの文は捨てる（異常系）", () => {
    // Arrange
    const stack = [
      `Error: ${BASE}assets/secret.txt を読めません`,
      "    at chrome-extension://abcdef/content.js:1:1",
      "    at https://evil.example/app/assets/index.js:1:1",
      `    at ${BASE}plugins/jp.x/main.js:5:6`,
      `    at ${BASE}assets/../secret/a.js:1:1`,
      "    at <anonymous>",
    ].join("\n");
    // Act
    const got = stackFrames(stack, BASE);
    // Assert
    expect(got).toEqual([]);
  });

  it("空のスタックは空、段は 30 までにする（境界値）", () => {
    // Arrange
    const many = Array.from({ length: 31 }, (_, i) => `    at f (${BASE}assets/a.js:${i + 1}:1)`).join("\n");
    // Act・Assert
    expect(stackFrames("", BASE)).toEqual([]);
    expect(stackFrames(many, BASE)).toHaveLength(30);
  });
});
