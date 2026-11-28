// 利用状況の集計（F-TEL-1）の単体テスト。
import { describe, expect, it } from "vitest";
import { addCheck, addOnboarding, addParseTime, bump, emptyCounts, newState, readState, rollover, type Counter } from "./state";

const NOW = new Date("2026-11-28T10:00:00Z");

describe("回数を足す", () => {
  it("bump は、まとまりの中の項目と、まとまりを持たない項目を 1 つ増やす", () => {
    // Arrange
    const counts = emptyCounts();
    // Act
    bump(counts, "edits.rename");
    bump(counts, "edits.rename");
    bump(counts, "exports.svg");
    bump(counts, "pluginUses");
    // Assert
    expect(counts.edits.rename).toBe(2);
    expect(counts.exports.svg).toBe(1);
    expect(counts.pluginUses).toBe(1);
    expect(counts.edits.delete).toBe(0);
  });

  it("bump は、契約に無い項目を足さない（異常系）", () => {
    // Arrange
    const counts = emptyCounts();
    // Act
    bump(counts, "edits.unknown" as Counter);
    bump(counts, "nothing" as Counter);
    bump(counts, "parseTimes" as Counter);
    // Assert
    expect(counts).toEqual(emptyCounts());
  });

  it.each([[0, "noProblems"], [1, "problems1To9"], [9, "problems1To9"], [10, "problems10To99"], [99, "problems10To99"], [100, "problems100OrMore"]] as const)(
    "addCheck(%d) は runs と %s を増やす（境界値）", (problems, bucket) => {
      // Arrange
      const counts = emptyCounts();
      // Act
      addCheck(counts, problems);
      // Assert
      expect(counts.checks).toEqual({ ...emptyCounts().checks, runs: 1, [bucket]: 1 });
    });

  it("addParseTime は、同じ組の回数を足し、違う組は並べる", () => {
    // Arrange
    const counts = emptyCounts();
    // Act
    addParseTime(counts, 500, 20);
    addParseTime(counts, 600, 30);
    addParseTime(counts, 20_000, 20);
    // Assert
    expect(counts.parseTimes).toEqual([
      { fileSize: "lt10kb", duration: "lt100ms", count: 2 },
      { fileSize: "10to100kb", duration: "lt100ms", count: 1 },
    ]);
  });

  it("addOnboarding は、同じ段階を 1 回だけ残す", () => {
    // Arrange
    const state = newState(NOW);
    // Act
    addOnboarding(state, "saved");
    addOnboarding(state, "saved");
    addOnboarding(state, "folderOpened");
    // Assert
    expect(state.onboarding).toEqual(["saved", "folderOpened"]);
  });
});

describe("rollover（日付の変わり目）", () => {
  it("同じ日なら、そのまま続ける（境界値: 日の終わり）", () => {
    // Arrange
    const state = newState(NOW);
    // Act
    const got = rollover(state, new Date("2026-11-28T23:59:59Z"));
    // Assert
    expect(got).toEqual({ state, due: null });
  });

  it("日付が変わったら、前の日の集計を送る分にし、今日の集計を 0 から始める（同じ週なら週の数は増えない）", () => {
    // Arrange（2026-11-28 は土曜。翌日の日曜は同じ週）
    const state = newState(NOW);
    bump(state.counts, "edits.rename");
    addOnboarding(state, "saved");
    // Act
    const got = rollover(state, new Date("2026-11-29T00:00:00Z"));
    // Assert
    expect(got.due).toBe(state);
    expect(got.state).toEqual({ day: "2026-11-29", counts: emptyCounts(), onboarding: [], weeks: 1, lastWeek: 2969, firstQuarter: "2026-Q4" });
  });

  it("週が変わったら、使った週の数を 1 つ増やす。初めて使った四半期は変えない", () => {
    // Arrange
    const state = newState(NOW);
    // Act
    const got = rollover(state, new Date("2027-01-04T00:00:00Z"));
    // Assert
    expect(got.state.weeks).toBe(2);
    expect(got.state.firstQuarter).toBe("2026-Q4");
  });
});

describe("readState（保存した集計を読む）", () => {
  it("保存したものを、そのまま読む", () => {
    // Arrange
    const state = newState(new Date("2026-11-20T00:00:00Z"));
    bump(state.counts, "saves.folder");
    addParseTime(state.counts, 10, 10);
    addOnboarding(state, "saved");
    state.weeks = 3;
    // Act
    const got = readState(JSON.stringify(state), NOW);
    // Assert
    expect(got).toEqual(state);
  });

  it.each([[null], [""], ["{"], ["null"], ["[]"], ['{"day":"today"}'], ['{"day":20261128}']])("無い・壊れている・形が違う（%s）ときは、初めて使ったものとして始める（異常系）", (raw) => {
    // Act
    const got = readState(raw, NOW);
    // Assert
    expect(got).toEqual(newState(NOW));
  });

  it("知らない項目・負の数・数でない値・知らない区分は捨てる（異常系）", () => {
    // Arrange
    const raw = JSON.stringify({
      day: "2026-11-27",
      counts: {
        edits: { rename: 2, unknown: 9, delete: -1, connect: "3" },
        pluginUses: 1.9,
        aiRewrites: "x",
        secret: "package P;",
        parseTimes: [{ fileSize: "lt10kb", duration: "lt100ms", count: 2 }, { fileSize: "huge", duration: "lt100ms", count: 1 }, { fileSize: "lt10kb", duration: "lt100ms", count: 0 }, null],
      },
      onboarding: ["saved", "hacked", 3],
      weeks: 0,
      lastWeek: "x",
      firstQuarter: "2026-11",
      name: "my-secret-project",
    });
    // Act
    const got = readState(raw, NOW);
    // Assert
    const counts = emptyCounts();
    counts.edits.rename = 2;
    counts.pluginUses = 1;
    counts.parseTimes = [{ fileSize: "lt10kb", duration: "lt100ms", count: 2 }];
    expect(got).toEqual({ day: "2026-11-27", counts, onboarding: ["saved"], weeks: 1, lastWeek: 2969, firstQuarter: "2026-Q4" });
  });
});
