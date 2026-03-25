import { describe, expect, it, vi } from "vitest";
import { SessionService } from "../../core/services/session.service.js";
import { createMockPage } from "../helpers/pw-session-fixtures.js";

function createService() {
  const browser = { isConnected: () => true };
  const browserDriver = {
    connect: vi.fn(async () => browser),
    getPage: vi.fn(async () => createMockPage()),
    createPage: vi.fn(async () => createMockPage()),
    closePage: vi.fn(async () => undefined),
    focusPage: vi.fn(async () => undefined),
    listPages: vi.fn(async () => []),
  };
  const store = new Map<string, any>();
  const sessionStore = {
    storeRoleRefs: vi.fn(async (session: { id: string }, refs: any, mode: "role" | "aria", frameSelector?: string) => {
      store.set(session.id, { refs, mode, frameSelector });
    }),
    restoreRoleRefs: vi.fn(async (session: { id: string }) => store.get(session.id) ?? null),
  };
  return new SessionService(browserDriver as any, sessionStore as any);
}

describe("unit: pw-session advanced", () => {
  describe("initializePageState", () => {
    it("creates new state for page", () => {
      const service = createService();
      const state = (service as any).initializePageState(createMockPage());
      expect(state.console).toEqual([]);
      expect(state.errors).toEqual([]);
      expect(state.requests).toEqual([]);
      expect(state.nextRequestId).toBe(0);
    });

    it("returns existing state for same page", () => {
      const service = createService();
      const page = createMockPage();
      expect((service as any).initializePageState(page)).toBe((service as any).initializePageState(page));
    });

    it("limits console messages to MAX_CONSOLE_MESSAGES", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      for (let i = 0; i < 510; i++) {
        page.emit("console", { type: () => "log", text: () => `message ${i}`, location: () => ({}) });
      }
      expect(state.console.length).toBeLessThanOrEqual(500);
    });

    it("limits errors to MAX_PAGE_ERRORS", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      for (let i = 0; i < 210; i++) page.emit("pageerror", new Error(`error ${i}`));
      expect(state.errors.length).toBeLessThanOrEqual(200);
    });

    it("tracks network requests with incrementing IDs", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      page.emit("request", { method: () => "GET", url: () => "https://api.example.com/1", resourceType: () => "fetch" });
      page.emit("request", { method: () => "POST", url: () => "https://api.example.com/2", resourceType: () => "xhr" });
      expect(state.requests[0]?.id).toBe("r1");
      expect(state.requests[1]?.id).toBe("r2");
    });

    it("clears state on page close", () => {
      const service = createService();
      const page = createMockPage();
      const state1 = (service as any).initializePageState(page);
      state1.console.push({ type: "log", text: "test", timestamp: new Date().toISOString() });
      (service as any).pageStates.delete(page);
      const state2 = (service as any).initializePageState(page);
      expect(state2).not.toBe(state1);
      expect(state2.console).toEqual([]);
    });
  });

  describe("role ref caching", () => {
    it("stores role refs in page state", async () => {
      const service = createService();
      await service.storeRoleRefs("tab-1", { e1: { role: "button", name: "Submit" } }, "role", "http://127.0.0.1:9222");
      await service.restoreRoleRefs("tab-1", "http://127.0.0.1:9222");
      expect(service.getPageState("tab-1")?.roleRefs).toEqual({ e1: { role: "button", name: "Submit" } });
    });

    it("stores frame selector with role refs", async () => {
      const service = createService();
      await service.storeRoleRefs("tab-2", { e1: { role: "textbox" } }, "aria", "http://127.0.0.1:9222", "iframe#content");
      await service.restoreRoleRefs("tab-2", "http://127.0.0.1:9222");
      expect(service.getPageState("tab-2")?.roleRefsFrameSelector).toBe("iframe#content");
      expect(service.getPageState("tab-2")?.roleRefsMode).toBe("aria");
    });

    it("skips target cache for blank target id", () => {
      const service = createService();
      const page = createMockPage();
      (service as any).initializePageState(page);
      (service as any).rememberRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "   ",
        refs: { e1: { role: "button" } },
      });
      expect((service as any).restoreRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "   ", page })).toBeNull();
    });

    it("restores role refs from target cache", () => {
      const service = createService();
      const page = createMockPage();
      (service as any).initializePageState(page);
      (service as any).rememberRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-cache",
        refs: { e1: { role: "link", name: "Home" } },
        mode: "role",
      });
      (service as any).restoreRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "tab-cache", page });
      expect((service as any).pageStates.get(page).roleRefs).toEqual({ e1: { role: "link", name: "Home" } });
    });

    it("does not overwrite existing role refs", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      state.roleRefs = { e1: { role: "button" } };
      (service as any).rememberRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-existing",
        refs: { e2: { role: "link" } },
      });
      (service as any).restoreRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "tab-existing", page });
      expect(state.roleRefs).toEqual({ e1: { role: "button" } });
    });

    it("skips restore for blank target id", () => {
      const service = createService();
      const page = createMockPage();
      (service as any).initializePageState(page);
      expect((service as any).restoreRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "   ", page })).toBeNull();
    });
  });

  describe("refLocator", () => {
    it("resolves role ref with name", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      state.roleRefs = { e1: { role: "button", name: "Submit" } };
      const loc = (service as any).resolveRefLocator(page, "e1", state);
      expect(loc.kind).toBe("role");
      expect(loc.opts).toEqual({ name: "Submit", exact: true });
    });

    it("resolves role ref without name", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      state.roleRefs = { e2: { role: "checkbox" } };
      const loc = (service as any).resolveRefLocator(page, "e2", state);
      expect(loc.kind).toBe("role");
      expect(loc.opts).toBeUndefined();
    });

    it("resolves aria-ref in frame mode", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      state.roleRefsMode = "aria";
      state.roleRefsFrameSelector = "iframe#main";
      const loc = (service as any).resolveRefLocator(page, "@e3", state);
      expect(loc.kind).toBe("frame-locator");
      expect(loc.selector).toBe("aria-ref=e3");
    });

    it("resolves aria-ref without frame", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      state.roleRefsMode = "aria";
      const loc = (service as any).resolveRefLocator(page, "@e4", state);
      expect(loc.kind).toBe("locator");
      expect(loc.selector).toBe("aria-ref=e4");
    });

    it("resolves dynamic ref", () => {
      const service = createService();
      const page = createMockPage();
      const loc = (service as any).resolveRefLocator(page, "d1", (service as any).initializePageState(page));
      expect(loc.selector).toBe('[aria-ref="d1"]');
    });

    it("throws for unknown role ref", () => {
      const service = createService();
      const page = createMockPage();
      expect(() => (service as any).resolveRefLocator(page, "e999", (service as any).initializePageState(page))).toThrow(/Unknown ref/);
    });

    it("throws for unknown aria ref", () => {
      const service = createService();
      const page = createMockPage();
      expect(() => (service as any).resolveRefLocator(page, "@e999", (service as any).initializePageState(page))).toThrow(/Unknown ref/);
    });
  });

  describe("rememberRoleRefsForTarget", () => {
    it("stores refs in global cache", () => {
      const service = createService();
      const page = createMockPage();
      (service as any).initializePageState(page);
      (service as any).rememberRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "tab-global", refs: { e1: { role: "button" } }, mode: "role" });
      (service as any).restoreRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "tab-global", page });
      expect((service as any).pageStates.get(page).roleRefs).toEqual({ e1: { role: "button" } });
    });

    it("normalizes cdpUrl by removing trailing slash", () => {
      const service = createService();
      const page = createMockPage();
      (service as any).initializePageState(page);
      (service as any).rememberRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222/", targetId: "tab-norm", refs: { e1: { role: "link" } }, mode: "role" });
      (service as any).restoreRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "tab-norm", page });
      expect((service as any).pageStates.get(page).roleRefs).toEqual({ e1: { role: "link" } });
    });

    it("skips storage for blank target id", () => {
      const service = createService();
      const page = createMockPage();
      (service as any).initializePageState(page);
      (service as any).rememberRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "   ", refs: { e1: { role: "button" } } });
      expect((service as any).restoreRoleRefsForTarget({ cdpUrl: "http://127.0.0.1:9222", targetId: "   ", page })).toBeNull();
    });
  });

  describe("network and event tracking", () => {
    it("tracks response with status", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      const req = { method: () => "GET", url: () => "https://api.example.com/data", resourceType: () => "xhr" };
      page.emit("request", req);
      page.emit("response", { request: () => req, status: () => 200, ok: () => true });
      expect(state.requests[0]?.status).toBe(200);
      expect(state.requests[0]?.ok).toBe(true);
    });

    it("tracks request failure", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      const req = { method: () => "GET", url: () => "https://api.example.com/data", resourceType: () => "fetch", failure: () => ({ errorText: "net::ERR_CONNECTION_REFUSED" }) };
      page.emit("request", req);
      page.emit("requestfailed", req);
      expect(state.requests[0]?.failureText).toBe("net::ERR_CONNECTION_REFUSED");
    });

    it("limits requests to MAX_NETWORK_REQUESTS", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      for (let i = 0; i < 510; i++) {
        page.emit("request", { method: () => "GET", url: () => `https://api.example.com/${i}`, resourceType: () => "fetch" });
      }
      expect(state.requests.length).toBeLessThanOrEqual(500);
    });

    it("tracks console messages with type and text", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      page.emit("console", { type: () => "log", text: () => "Hello World", location: () => ({}) });
      expect(state.console[0]?.type).toBe("log");
      expect(state.console[0]?.text).toBe("Hello World");
    });

    it("includes timestamp for console messages", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      const before = Date.now();
      page.emit("console", { type: () => "error", text: () => "Error message", location: () => ({}) });
      const after = Date.now();
      const timestamp = Date.parse(state.console[0]?.timestamp || "");
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("tracks page errors with message and stack", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";
      page.emit("pageerror", error);
      expect(state.errors[0]?.message).toBe("Test error");
      expect(state.errors[0]?.stack).toContain("test.js:1:1");
    });

    it("handles non-Error objects", () => {
      const service = createService();
      const page = createMockPage();
      const state = (service as any).initializePageState(page);
      page.emit("pageerror", "string error");
      expect(state.errors[0]?.message).toBe("string error");
    });
  });
});
