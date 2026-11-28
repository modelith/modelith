// 利用状況の送信の段取り（F-TEL-1）の単体テスト。保存領域・送信・時計は偽物を渡す。
import { describe, expect, it } from "vitest";
import type { UsageReport } from "../plugins/generated/protocol";
import { LEVEL_KEY, NOTICE_KEY, STATE_KEY, UsageReporter, levelOf } from "./reporter";

function setup(opts: { notice?: boolean; level?: string } = {}) {
  const kv = new Map<string, string>();
  if (opts.notice !== false) kv.set(NOTICE_KEY, "1");
  if (opts.level) kv.set(LEVEL_KEY, opts.level);
  const sent: UsageReport[] = [];
  const clock = { now: new Date("2026-11-28T10:00:00Z") };
  const reporter = new UsageReporter({
    store: { get: (k) => kv.get(k) ?? null, set: (k, v) => kv.set(k, v) },
    send: (r) => sent.push(r),
    now: () => clock.now,
    env: () => ({ browser: "chrome", os: "linux", screen: "desktop", language: "ja", folderAccess: true }),
    sender: { appVersion: "0.3.0", channel: "stable" },
    base: "https://example.org/app/",
  });
  return { kv, sent, clock, reporter };
}

describe("levelOf", () => {
  it("知っている値はそのまま、無い・知らない値は「すべて送る」にする", () => {
    expect([levelOf("all"), levelOf("errorsOnly"), levelOf("off"), levelOf(null), levelOf("x")]).toEqual(["all", "errorsOnly", "off", "all", "all"]);
  });
});

describe("UsageReporter", () => {
  it("最初の知らせを見せるまでは、何も数えず、何も送らず、何も残さない", () => {
    // Arrange
    const s = setup({ notice: false });
    // Act
    s.reporter.started(500);
    s.reporter.count("edits.rename");
    s.reporter.error(new Error("x"), "uncaughtError");
    // Assert
    expect(s.reporter.noticeNeeded()).toBe(true);
    expect(s.sent).toEqual([]);
    expect(s.kv.has(STATE_KEY)).toBe(false);
  });

  it("知らせを見せた後は、起動を報告し、回数を足し込んで保存する（その日のうちは送らない）", () => {
    // Arrange
    const s = setup({ notice: false });
    s.reporter.noticeShown();
    // Act
    s.reporter.started(500);
    s.reporter.count("edits.rename");
    s.reporter.check(3);
    s.reporter.parseTime(100, 10);
    s.reporter.step("saved");
    // Assert
    expect(s.sent.map((r) => r.kind)).toEqual(["startup"]);
    expect(JSON.parse(s.kv.get(STATE_KEY) ?? "")).toMatchObject({
      day: "2026-11-28", onboarding: ["saved"],
      counts: { edits: { rename: 1 }, checks: { runs: 1, problems1To9: 1 }, parseTimes: [{ fileSize: "lt10kb", duration: "lt100ms", count: 1 }] },
    });
  });

  it("日付が変わってから起動すると、前の日のまとめを送ってから、起動を報告する", () => {
    // Arrange
    const s = setup();
    s.reporter.count("exports.svg");
    s.clock.now = new Date("2026-11-29T09:00:00Z");
    // Act
    s.reporter.started(1500);
    // Assert
    expect(s.sent.map((r) => r.kind)).toEqual(["daily", "startup"]);
    expect(s.sent[0]).toMatchObject({ exports: { svg: 1 }, weeksUsed: "1", firstQuarter: "2026-Q4" });
    expect(JSON.parse(s.kv.get(STATE_KEY) ?? "")).toMatchObject({ day: "2026-11-29", counts: { exports: { svg: 0 } } });
  });

  it("開いたまま日付が変わっても、次に数えたときに前の日のまとめを送る（境界値: 日の変わり目）", () => {
    // Arrange
    const s = setup();
    s.reporter.count("exports.svg");
    s.clock.now = new Date("2026-11-29T00:00:00Z");
    // Act
    s.reporter.count("exports.png");
    // Assert
    expect(s.sent.map((r) => r.kind)).toEqual(["daily"]);
    expect(s.sent[0]).toMatchObject({ exports: { svg: 1, png: 0 } });
    expect(JSON.parse(s.kv.get(STATE_KEY) ?? "")).toMatchObject({ day: "2026-11-29", counts: { exports: { svg: 0, png: 1 } } });
  });

  it("「エラーだけ」は、エラーだけを送り、回数は数えない", () => {
    // Arrange
    const s = setup({ level: "errorsOnly" });
    // Act
    s.reporter.started(500);
    s.reporter.count("edits.rename");
    s.reporter.error(new TypeError("x"), "unhandledRejection");
    // Assert
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0]).toMatchObject({ kind: "error", level: "errorsOnly", errorKind: "unhandledRejection", errorName: "typeError" });
    expect(s.kv.has(STATE_KEY)).toBe(false);
    expect(s.reporter.preview()).toBeNull();
  });

  it("「送らない」は、何も送らない", () => {
    // Arrange
    const s = setup({ level: "off" });
    // Act
    s.reporter.started(500);
    s.reporter.count("edits.rename");
    s.reporter.error(new Error("x"), "uncaughtError");
    // Assert
    expect(s.sent).toEqual([]);
    expect(s.reporter.preview()).toBeNull();
  });

  it("「すべて送る」をやめると、足し込んでいた回数を捨てる。戻しても前の回数は送らない", () => {
    // Arrange
    const s = setup();
    s.reporter.count("edits.rename");
    // Act
    s.reporter.setLevel("off");
    s.reporter.setLevel("all");
    s.clock.now = new Date("2026-11-29T09:00:00Z");
    s.reporter.started(500);
    // Assert
    expect(s.reporter.level()).toBe("all");
    expect(s.sent.map((r) => r.kind)).toEqual(["startup"]);
  });

  it("preview は、いま送るとしたら送るまとめを返し、何も送らない", () => {
    // Arrange
    const s = setup();
    s.reporter.count("saves.folder");
    // Act
    const got = s.reporter.preview();
    // Assert
    expect(got).toMatchObject({ kind: "daily", saves: { folder: 1 }, browser: "chrome", appVersion: "0.3.0" });
    expect(s.sent).toEqual([]);
  });
});
