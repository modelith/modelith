import { describe, expect, it } from "vitest";
import { DEFAULT_USAGE_ENDPOINT, usageChannelFor, usageEndpointFor } from "./usage-endpoint";

describe("usageEndpointFor（F-TEL-1）", () => {
  it("配る形のビルドは、何も渡さなければ既定の受け口へ送る", () => {
    expect(usageEndpointFor("build", undefined)).toBe(DEFAULT_USAGE_ENDPOINT);
  });

  it("空を渡したビルドは送らない", () => {
    expect(usageEndpointFor("build", "")).toBe("");
  });

  it("渡した受け口があれば、それを使う", () => {
    expect(usageEndpointFor("build", "/__usage")).toBe("/__usage");
    expect(usageEndpointFor("serve", "/__usage")).toBe("/__usage");
  });

  it("開発用の画面は、何も渡さなければ送らない", () => {
    expect(usageEndpointFor("serve", undefined)).toBe("");
  });

  it("既定の受け口は https", () => {
    expect(DEFAULT_USAGE_ENDPOINT.startsWith("https://")).toBe(true);
  });
});

describe("usageChannelFor（F-TEL-1）", () => {
  it.each(["stable", "rc", "preview"] as const)("公式の系列 %s は、そのまま名乗る", (channel) => {
    expect(usageChannelFor(channel)).toBe(channel);
  });

  it.each([undefined, "", "nightly", "other"])("系列を渡さない・知らない系列（%s）は other", (configured) => {
    expect(usageChannelFor(configured)).toBe("other");
  });
});
