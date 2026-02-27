import { describe, expect, it } from "vitest";
import {
  ensurePageState,
  refLocator,
  rememberRoleRefsForTarget,
  restoreRoleRefsForTarget,
  storeRoleRefsForTarget,
} from "../../browser/pw-session.js";

type Handler = (arg?: any) => void;

function makeRoleLocator(role: string, opts?: { name?: string; exact?: boolean }, frame?: string) {
  return {
    kind: "role",
    role,
    opts,
    frame,
    nth(index: number) {
      return { kind: "role-nth", role, opts, frame, index };
    },
  };
}

function createMockPage() {
  const handlers = new Map<string, Handler[]>();

  const page = {
    _url: "https://example.test",
    on(event: string, handler: Handler) {
      const existing = handlers.get(event) ?? [];
      existing.push(handler);
      handlers.set(event, existing);
    },
    emit(event: string, payload?: any) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
    url() {
      return this._url;
    },
    locator(selector: string) {
      return { kind: "locator", selector };
    },
    frameLocator(frame: string) {
      return {
        locator(selector: string) {
          return { kind: "frame-locator", frame, selector };
        },
        getByRole(role: string, opts?: { name?: string; exact?: boolean }) {
          return makeRoleLocator(role, opts, frame);
        },
      };
    },
    getByRole(role: string, opts?: { name?: string; exact?: boolean }) {
      return makeRoleLocator(role, opts);
    },
  };

  return page as any;
}

describe("unit: pw-session", () => {
  it("restores role refs from target cache and resolves role ref locator", () => {
    const pageWriter = createMockPage();
    const pageReader = createMockPage();

    storeRoleRefsForTarget({
      page: pageWriter,
      cdpUrl: "http://127.0.0.1:9222/",
      targetId: " target-1 ",
      refs: { e1: { role: "button", name: "Submit" } },
      mode: "role",
    });

    restoreRoleRefsForTarget({
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "target-1",
      page: pageReader,
    });

    const loc = refLocator(pageReader, "e1") as any;
    expect(loc.kind).toBe("role");
    expect(loc.role).toBe("button");
    expect(loc.opts).toEqual({ name: "Submit", exact: true });
  });

  it("uses aria-ref lookup in frame mode when role refs mode is aria", () => {
    const page = createMockPage();

    storeRoleRefsForTarget({
      page,
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "tab-aria",
      refs: { e5: { role: "textbox" } },
      frameSelector: "iframe#iframe-main",
      mode: "aria",
    });

    const loc = refLocator(page, "@e5") as any;
    expect(loc.kind).toBe("frame-locator");
    expect(loc.frame).toBe("iframe#iframe-main");
    expect(loc.selector).toBe("aria-ref=e5");
  });

  it("supports dropdown dynamic refs and throws for unknown role refs", () => {
    const page = createMockPage();

    const dynamic = refLocator(page, "d7") as any;
    expect(dynamic.selector).toBe('[aria-ref="d7"]');

    expect(() => refLocator(page, "e999")).toThrow(/Unknown ref/);
  });

  it("records network lifecycle + failures and clears state on page close", () => {
    const page = createMockPage();
    const state = ensurePageState(page);

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

    page.emit("close");
    const fresh = ensurePageState(page);
    expect(fresh).not.toBe(state);
    expect(fresh.requests).toHaveLength(0);
  });

  it("keeps rememberRoleRefsForTarget a no-op for blank target id", () => {
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

    expect(() => refLocator(page, "e1")).toThrow(/Unknown ref/);
  });
});
