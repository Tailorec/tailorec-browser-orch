import { describe, expect, it } from "vitest";
import {
  ensurePageState,
  refLocator,
  rememberRoleRefsForTarget,
  restoreRoleRefsForTarget,
  storeRoleRefsForTarget,
} from "../../browser/pw-session.js";
import { createMockPage } from "../helpers/pw-session-fixtures.js";

describe("unit: pw-session advanced", () => {
  describe("ensurePageState", () => {
    it("creates new state for page", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      expect(state).toBeDefined();
      expect(state.console).toEqual([]);
      expect(state.errors).toEqual([]);
      expect(state.requests).toEqual([]);
      expect(state.nextRequestId).toBe(0);
    });

    it("returns existing state for same page", () => {
      const page = createMockPage();
      const state1 = ensurePageState(page);
      const state2 = ensurePageState(page);

      expect(state1).toBe(state2);
    });

    it("limits console messages to MAX_CONSOLE_MESSAGES", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      for (let i = 0; i < 510; i++) {
        page.emit("console", {
          type: () => "log",
          text: () => `message ${i}`,
          location: () => ({}),
        });
      }

      expect(state.console.length).toBeLessThanOrEqual(500);
    });

    it("limits errors to MAX_PAGE_ERRORS", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      for (let i = 0; i < 210; i++) {
        page.emit("pageerror", new Error(`error ${i}`));
      }

      expect(state.errors.length).toBeLessThanOrEqual(200);
    });

    it("tracks network requests with incrementing IDs", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      const req1 = {
        method: () => "GET",
        url: () => "https://api.example.com/1",
        resourceType: () => "fetch",
      };
      const req2 = {
        method: () => "POST",
        url: () => "https://api.example.com/2",
        resourceType: () => "xhr",
      };

      page.emit("request", req1);
      page.emit("request", req2);

      expect(state.requests).toHaveLength(2);
      expect(state.requests[0]?.id).toBe("r1");
      expect(state.requests[1]?.id).toBe("r2");
    });

    it("clears state on page close", () => {
      const page = createMockPage();
      const state1 = ensurePageState(page);

      state1.console.push({ type: "log", text: "test", timestamp: new Date().toISOString() });
      state1.requests.push({
        id: "r1",
        timestamp: new Date().toISOString(),
        method: "GET",
        url: "https://example.com",
      });

      page.emit("close");

      const state2 = ensurePageState(page);
      expect(state2).not.toBe(state1);
      expect(state2.console).toEqual([]);
      expect(state2.requests).toEqual([]);
    });
  });

  describe("storeRoleRefsForTarget", () => {
    it("stores role refs in page state", () => {
      const page = createMockPage();

      storeRoleRefsForTarget({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
        refs: { e1: { role: "button", name: "Submit" } },
        mode: "role",
      });

      const state = ensurePageState(page);
      expect(state.roleRefs).toEqual({ e1: { role: "button", name: "Submit" } });
      expect(state.roleRefsMode).toBe("role");
    });

    it("stores frame selector with role refs", () => {
      const page = createMockPage();

      storeRoleRefsForTarget({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-2",
        refs: { e1: { role: "textbox" } },
        frameSelector: "iframe#content",
        mode: "aria",
      });

      const state = ensurePageState(page);
      expect(state.roleRefsFrameSelector).toBe("iframe#content");
      expect(state.roleRefsMode).toBe("aria");
    });

    it("skips target cache for blank target id", () => {
      const page = createMockPage();

      storeRoleRefsForTarget({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "   ",
        refs: { e1: { role: "button" } },
        mode: "role",
      });

      // Page state is still set, but global cache is skipped
      const state = ensurePageState(page);
      expect(state.roleRefs).toEqual({ e1: { role: "button" } });
      
      // Restore from blank target should be no-op
      restoreRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "   ",
        page: createMockPage(),
      });
    });
  });

  describe("restoreRoleRefsForTarget", () => {
    it("restores role refs from target cache", () => {
      const pageWriter = createMockPage();
      const pageReader = createMockPage();

      storeRoleRefsForTarget({
        page: pageWriter,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-cache",
        refs: { e1: { role: "link", name: "Home" } },
        mode: "role",
      });

      restoreRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-cache",
        page: pageReader,
      });

      const state = ensurePageState(pageReader);
      expect(state.roleRefs).toEqual({ e1: { role: "link", name: "Home" } });
    });

    it("does not overwrite existing role refs", () => {
      const page = createMockPage();

      storeRoleRefsForTarget({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-existing",
        refs: { e1: { role: "button" } },
        mode: "role",
      });

      restoreRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-existing",
        page,
      });

      const state = ensurePageState(page);
      expect(state.roleRefs).toEqual({ e1: { role: "button" } });
    });

    it("skips restore for blank target id", () => {
      const page = createMockPage();

      restoreRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "   ",
        page,
      });

      const state = ensurePageState(page);
      expect(state.roleRefs).toBeUndefined();
    });
  });

  describe("refLocator", () => {
    it("resolves role ref with name", () => {
      const page = createMockPage();

      storeRoleRefsForTarget({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-role",
        refs: { e1: { role: "button", name: "Submit" } },
        mode: "role",
      });

      const loc = refLocator(page, "e1") as any;
      expect(loc.kind).toBe("role");
      expect(loc.role).toBe("button");
      expect(loc.opts).toEqual({ name: "Submit", exact: true });
    });

    it("resolves role ref without name", () => {
      const page = createMockPage();

      storeRoleRefsForTarget({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-role2",
        refs: { e2: { role: "checkbox" } },
        mode: "role",
      });

      const loc = refLocator(page, "e2") as any;
      expect(loc.kind).toBe("role");
      expect(loc.role).toBe("checkbox");
      expect(loc.opts).toBeUndefined();
    });

    it("resolves aria-ref in frame mode", () => {
      const page = createMockPage();

      storeRoleRefsForTarget({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-frame",
        refs: { e3: { role: "textbox" } },
        frameSelector: "iframe#main",
        mode: "aria",
      });

      const loc = refLocator(page, "@e3") as any;
      expect(loc.kind).toBe("frame-locator");
      expect(loc.frame).toBe("iframe#main");
      expect(loc.selector).toBe("aria-ref=e3");
    });

    it("resolves aria-ref without frame", () => {
      const page = createMockPage();

      storeRoleRefsForTarget({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-aria",
        refs: { e4: { role: "button" } },
        mode: "aria",
      });

      const loc = refLocator(page, "@e4") as any;
      expect(loc.kind).toBe("locator");
      expect(loc.selector).toBe("aria-ref=e4");
    });

    it("resolves dynamic ref", () => {
      const page = createMockPage();

      const loc = refLocator(page, "d1") as any;
      expect(loc.kind).toBe("locator");
      expect(loc.selector).toBe('[aria-ref="d1"]');
    });

    it("throws for unknown role ref", () => {
      const page = createMockPage();

      expect(() => refLocator(page, "e999")).toThrow(/Unknown ref/);
    });

    it("throws for unknown aria ref", () => {
      const page = createMockPage();

      expect(() => refLocator(page, "@e999")).toThrow(/Unknown ref/);
    });
  });

  describe("rememberRoleRefsForTarget", () => {
    it("stores refs in global cache", () => {
      const page = createMockPage();

      rememberRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-global",
        refs: { e1: { role: "button" } },
        mode: "role",
      });

      restoreRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-global",
        page,
      });

      const state = ensurePageState(page);
      expect(state.roleRefs).toEqual({ e1: { role: "button" } });
    });

    it("normalizes cdpUrl by removing trailing slash", () => {
      const page1 = createMockPage();
      const page2 = createMockPage();

      rememberRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222/",
        targetId: "tab-norm",
        refs: { e1: { role: "link" } },
        mode: "role",
      });

      restoreRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-norm",
        page: page2,
      });

      const state = ensurePageState(page2);
      expect(state.roleRefs).toEqual({ e1: { role: "link" } });
    });

    it("skips storage for blank target id", () => {
      const page = createMockPage();

      rememberRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "   ",
        refs: { e1: { role: "button" } },
      });

      restoreRoleRefsForTarget({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "   ",
        page,
      });

      const state = ensurePageState(page);
      expect(state.roleRefs).toBeUndefined();
    });
  });

  describe("network request tracking", () => {
    it("tracks response with status", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      const req = {
        method: () => "GET",
        url: () => "https://api.example.com/data",
        resourceType: () => "xhr",
      };
      const resp = {
        request: () => req,
        status: () => 200,
        ok: () => true,
      };

      page.emit("request", req);
      page.emit("response", resp);

      expect(state.requests).toHaveLength(1);
      expect(state.requests[0]?.status).toBe(200);
      expect(state.requests[0]?.ok).toBe(true);
    });

    it("tracks request failure", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      const req = {
        method: () => "GET",
        url: () => "https://api.example.com/data",
        resourceType: () => "fetch",
        failure: () => ({ errorText: "net::ERR_CONNECTION_REFUSED" }),
      };

      page.emit("request", req);
      page.emit("requestfailed", req);

      expect(state.requests).toHaveLength(1);
      expect(state.requests[0]?.failureText).toBe("net::ERR_CONNECTION_REFUSED");
    });

    it("limits requests to MAX_NETWORK_REQUESTS", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      for (let i = 0; i < 510; i++) {
        const req = {
          method: () => "GET",
          url: () => `https://api.example.com/${i}`,
          resourceType: () => "fetch",
        };
        page.emit("request", req);
      }

      expect(state.requests.length).toBeLessThanOrEqual(500);
    });
  });

  describe("console message tracking", () => {
    it("tracks console messages with type and text", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      page.emit("console", {
        type: () => "log",
        text: () => "Hello World",
        location: () => ({ url: "https://example.com", lineNumber: 10 }),
      });

      expect(state.console).toHaveLength(1);
      expect(state.console[0]?.type).toBe("log");
      expect(state.console[0]?.text).toBe("Hello World");
    });

    it("includes timestamp for console messages", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      const before = Date.now();
      page.emit("console", {
        type: () => "error",
        text: () => "Error message",
        location: () => ({}),
      });
      const after = Date.now();

      const timestamp = Date.parse(state.console[0]?.timestamp || "");
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("page error tracking", () => {
    it("tracks page errors with message and stack", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";

      page.emit("pageerror", error);

      expect(state.errors).toHaveLength(1);
      expect(state.errors[0]?.message).toBe("Test error");
      expect(state.errors[0]?.stack).toContain("test.js:1:1");
    });

    it("handles non-Error objects", () => {
      const page = createMockPage();
      const state = ensurePageState(page);

      page.emit("pageerror", "string error");

      expect(state.errors).toHaveLength(1);
      expect(state.errors[0]?.message).toBe("string error");
    });
  });
});
