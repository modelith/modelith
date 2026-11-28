// 利用状況の値の区分（F-TEL-1）の単体テスト。区分の境目を境界値で確かめる。
import { describe, expect, it } from "vitest";
import { browserOf, dayOf, durationClass, errorNameOf, languageOf, osOf, parseDurationClass, quarterOf, screenClass, sizeClass, weekOf, weeksClass } from "./classes";

describe("区分（境界値）", () => {
  it.each([[0, "lt1s"], [999, "lt1s"], [1000, "1to3s"], [2999, "1to3s"], [3000, "3to10s"], [9999, "3to10s"], [10000, "ge10s"]] as const)(
    "durationClass(%d) は %s", (ms, expected) => {
      expect(durationClass(ms)).toBe(expected);
    });

  it.each([[99, "lt100ms"], [100, "100to300ms"], [299, "100to300ms"], [300, "300msTo1s"], [999, "300msTo1s"], [1000, "1to3s"], [2999, "1to3s"], [3000, "ge3s"]] as const)(
    "parseDurationClass(%d) は %s", (ms, expected) => {
      expect(parseDurationClass(ms)).toBe(expected);
    });

  it.each([[0, "lt10kb"], [9_999, "lt10kb"], [10_000, "10to100kb"], [99_999, "10to100kb"], [100_000, "100kbTo1mb"], [999_999, "100kbTo1mb"], [1_000_000, "ge1mb"]] as const)(
    "sizeClass(%d) は %s", (bytes, expected) => {
      expect(sizeClass(bytes)).toBe(expected);
    });

  it.each([[390, "phone"], [599, "phone"], [600, "tablet"], [1023, "tablet"], [1024, "desktop"]] as const)("screenClass(%d) は %s", (width, expected) => {
    expect(screenClass(width)).toBe(expected);
  });

  it.each([[1, "1"], [2, "2to4"], [4, "2to4"], [5, "5to12"], [12, "5to12"], [13, "ge13"]] as const)("weeksClass(%d) は %s", (weeks, expected) => {
    expect(weeksClass(weeks)).toBe(expected);
  });
});

describe("環境（同値分割）", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "chrome", "windows"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "edge", "windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0", "firefox", "linux"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "safari", "macos"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "safari", "ios"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "chrome", "android"],
    ["", "other", "other"],
  ] as const)("%s", (ua, browser, os) => {
    expect(browserOf(ua)).toBe(browser);
    expect(osOf(ua)).toBe(os);
  });

  it("言語は、言語の部分だけを見る（知らない言語は other）", () => {
    expect([languageOf("ja"), languageOf("en-US"), languageOf("JA-jp"), languageOf("fr"), languageOf("")]).toEqual(["ja", "en", "ja", "other", "other"]);
  });
});

describe("日付（UTC）", () => {
  it("四半期は 3 か月ごとに変わる（境界値: 四半期と年の変わり目）", () => {
    expect(quarterOf(new Date("2026-09-30T23:59:59Z"))).toBe("2026-Q3");
    expect(quarterOf(new Date("2026-10-01T00:00:00Z"))).toBe("2026-Q4");
    expect(quarterOf(new Date("2027-01-01T00:00:00Z"))).toBe("2027-Q1");
  });

  it("日は UTC で区切る", () => {
    expect(dayOf(new Date("2026-11-28T23:59:59Z"))).toBe("2026-11-28");
    expect(dayOf(new Date("2026-11-29T00:00:00Z"))).toBe("2026-11-29");
  });

  it("週は月曜に変わる（境界値: 日曜の終わりと月曜の始め）", () => {
    expect(weekOf(new Date("2026-11-29T23:59:59Z"))).toBe(2969);
    expect(weekOf(new Date("2026-11-30T00:00:00Z"))).toBe(2970);
  });
});

describe("errorNameOf", () => {
  it("例外の名前を区分にし、知らない名前と Error でないものは other にする", () => {
    expect(errorNameOf(new Error("x"))).toBe("error");
    expect(errorNameOf(new TypeError("x"))).toBe("typeError");
    expect(errorNameOf(new DOMException("x", "QuotaExceededError"))).toBe("quotaExceededError");
    expect(errorNameOf(new DOMException("x", "DataError"))).toBe("otherDomException");
    expect(errorNameOf(Object.assign(new Error("x"), { name: "MyError" }))).toBe("other");
    expect(errorNameOf("boom")).toBe("other");
    expect(errorNameOf(null)).toBe("other");
  });
});
