import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendCdpPath,
  fetchJson,
  fetchOk,
  getHeadersWithAuth,
  isLoopbackHost,
} from "../../browser/cdp.helpers.js";

describe("cdp.helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects loopback hosts", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("example.com")).toBe(false);
  });

  it("appends cdp path while preserving base path", () => {
    expect(appendCdpPath("http://127.0.0.1:9222/base", "/json/version")).toBe(
      "http://127.0.0.1:9222/base/json/version",
    );
  });

  it("adds basic auth header from URL when absent", () => {
    const headers = getHeadersWithAuth("http://user:pass@example.com:9222");
    expect(Object.keys(headers).some((k) => k.toLowerCase() === "authorization")).toBe(true);
  });

  it("fetchJson and fetchOk handle success and error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }) as any,
    );

    const data = await fetchJson<{ ok: boolean }>("http://127.0.0.1:9222/json/version", 1000);
    expect(data.ok).toBe(true);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("boom", { status: 500 }) as any);
    await expect(fetchOk("http://127.0.0.1:9222/json/version", 1000)).rejects.toThrow("HTTP 500");
  });
});
