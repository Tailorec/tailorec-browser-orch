import { describe, expect, it, vi } from "vitest";
import { SessionService } from "../../core/services/session.service.js";
import { createMockPage } from "../helpers/pw-session-fixtures.js";

function createSessionHarness() {
  const pages = new Map<string, any>();
  const browser = { isConnected: () => true };
  const browserDriver = {
    connect: vi.fn(async () => browser),
    getPage: vi.fn(async (_browser: unknown, targetId?: string) => {
      const key = targetId ?? "default";
      if (!pages.has(key)) pages.set(key, createMockPage());
      return pages.get(key);
    }),
    createPage: vi.fn(async () => createMockPage()),
    closePage: vi.fn(async () => undefined),
    focusPage: vi.fn(async () => undefined),
    listPages: vi.fn(async () => []),
  };
  const stored = new Map<string, { refs: any; mode: "role" | "aria"; frameSelector?: string }>();
  const sessionStore = {
    storeRoleRefs: vi.fn(async (session: { id: string }, refs: any, mode: "role" | "aria", frameSelector?: string) => {
      stored.set(session.id, { refs, mode, frameSelector });
    }),
    restoreRoleRefs: vi.fn(async (session: { id: string }) => stored.get(session.id) ?? null),
  };

  return {
    service: new SessionService(browserDriver as any, sessionStore as any),
    pages,
  };
}

describe("unit: pw-session", () => {
  it("restores role refs from target cache and resolves role ref locator", async () => {
    const { service } = createSessionHarness();
    const pageWriter = createMockPage();
    const pageReader = createMockPage();

    (service as any).initializePageState(pageWriter);
    (service as any).storeRoleRefs("target-1", { e1: { role: "button", name: "Submit" } }, "role", "http://127.0.0.1:9222", undefined);
    (service as any).initializePageState(pageReader);
    (service as any).rememberRoleRefsForTarget({
      cdpUrl: "http://127.0.0.1:9222/",
      targetId: " target-1 ",
      refs: { e1: { role: "button", name: "Submit" } },
      mode: "role",
    });
    (service as any).restoreRoleRefsForTarget({
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "target-1",
      page: pageReader,
    });

    const loc = (service as any).resolveRefLocator(pageReader, "e1", (service as any).pageStates.get(pageReader));
    expect(loc.kind).toBe("role");
    expect(loc.role).toBe("button");
    expect(loc.opts).toEqual({ name: "Submit", exact: true });
  });

  it("uses aria-ref lookup in frame mode when role refs mode is aria", async () => {
    const { service } = createSessionHarness();
    const page = createMockPage();
    (service as any).initializePageState(page);
    (service as any).rememberRoleRefsForTarget({
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "tab-aria",
      refs: { e5: { role: "textbox" } },
      frameSelector: "iframe#iframe-main",
      mode: "aria",
    });
    (service as any).restoreRoleRefsForTarget({
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "tab-aria",
      page,
    });

    const loc = (service as any).resolveRefLocator(page, "@e5", (service as any).pageStates.get(page));
    expect(loc.kind).toBe("frame-locator");
    expect(loc.frame).toBe("iframe#iframe-main");
    expect(loc.selector).toBe("aria-ref=e5");
  });

  it("supports dropdown dynamic refs and throws for unknown role refs", async () => {
    const { service } = createSessionHarness();
    const page = createMockPage();
    (service as any).initializePageState(page);

    const dynamic = (service as any).resolveRefLocator(page, "d7", (service as any).pageStates.get(page));
    expect(dynamic.selector).toBe('[aria-ref="d7"]');
    expect(() => (service as any).resolveRefLocator(page, "e999", (service as any).pageStates.get(page))).toThrow(/Unknown ref/);
  });

  it("records network lifecycle + failures and clears state on page close", async () => {
    const { service } = createSessionHarness();
    const page = createMockPage();
    const state = (service as any).initializePageState(page);

    const req = {
      method: () => "GET",
      url: () => "https://api.example.test/data",
      resourceType: () => "xhr",
      failure: () => ({ errorText: "net::ERR_FAILED" }),
    };
    const resp = {
      request: () => req,
      status: () => 503,
      ok: () => false,
    };

    page.emit("request", req);
    page.emit("response", resp);
    page.emit("requestfailed", req);

    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]?.id).toBe("r1");
    expect(state.requests[0]?.status).toBe(503);
    expect(state.requests[0]?.ok).toBe(false);
    expect(state.requests[0]?.failureText).toBe("net::ERR_FAILED");

    (service as any).pageStates.delete(page);
    const fresh = (service as any).initializePageState(page);
    expect(fresh).not.toBe(state);
    expect(fresh.requests).toHaveLength(0);
  });

  it("keeps rememberRoleRefsForTarget a no-op for blank target id", async () => {
    const { service } = createSessionHarness();
    const page = createMockPage();
    (service as any).initializePageState(page);

    (service as any).rememberRoleRefsForTarget({
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "   ",
      refs: { e1: { role: "button" } },
    });
    const restored = (service as any).restoreRoleRefsForTarget({
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "   ",
      page,
    });

    expect(restored).toBeNull();
    expect(() => (service as any).resolveRefLocator(page, "e1", (service as any).pageStates.get(page))).toThrow(/Unknown ref/);
  });
});
