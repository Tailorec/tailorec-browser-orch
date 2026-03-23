import { describe, expect, it } from "vitest";
import { formatAriaSnapshot, normalizeCdpWsUrl } from "../../browser/cdp.js";

describe("cdp helpers in cdp.ts", () => {
  it("normalizes loopback websocket URL for remote cdp URL", () => {
    const normalized = normalizeCdpWsUrl(
      "ws://127.0.0.1:9222/devtools/browser/abc",
      "https://example.com:8443",
    );

    expect(normalized.startsWith("wss://example.com:8443")).toBe(true);
    expect(normalized).toContain("/devtools/browser/abc");
  });

  it("formats aria snapshot tree with depth and limit", () => {
    const out = formatAriaSnapshot(
      [
        { nodeId: "1", role: { value: "RootWebArea" }, childIds: ["2"] },
        { nodeId: "2", role: { value: "button" }, name: { value: "Submit" } },
      ],
      10,
    );

    expect(out.length).toBe(2);
    expect(out[1]?.role.toLowerCase()).toBe("button");
    expect(out[1]?.name).toBe("Submit");
  });
});
