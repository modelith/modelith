// 利用状況の報告の送信と、送る中身の一覧（F-TEL-1）の単体テスト。
import { describe, expect, it } from "vitest";
import { startupReport } from "./report";
import { flatten, postReport } from "./transport";

const REPORT = startupReport(500, { appVersion: "0.3.0", channel: "stable" });

describe("postReport", () => {
  it("報告の JSON を、認証情報と Referer を付けずに POST する", () => {
    // Arrange
    const calls: { url: string; init: RequestInit }[] = [];
    // Act
    postReport("https://telemetry.example/v1/events", REPORT, async (url, init) => void calls.push({ url, init }));
    // Assert
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://telemetry.example/v1/events");
    expect(calls[0]?.init).toMatchObject({ method: "POST", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true, headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(REPORT);
  });

  it("送れなくても例外を出さない（異常系: 拒否・fetch が投げる）", async () => {
    // Act・Assert
    expect(() => postReport("https://x/", REPORT, () => Promise.reject(new Error("offline")))).not.toThrow();
    expect(() => postReport("https://x/", REPORT, () => {
      throw new Error("no fetch");
    })).not.toThrow();
    await Promise.resolve();
  });
});

describe("flatten", () => {
  it("入れ子と配列を「.」でつないだ行にする。空の配列は、渡した文字にする（境界値）", () => {
    // Act
    const got = flatten({ kind: "daily", edits: { rename: 2 }, onboarding: ["saved"], parseTimes: [], folderAccess: true }, "-");
    // Assert
    expect(got).toEqual([["kind", "daily"], ["edits.rename", "2"], ["onboarding.0", "saved"], ["parseTimes", "-"], ["folderAccess", "true"]]);
  });
});
