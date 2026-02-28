import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page, CDPSession } from "playwright-core";
import {
  closePageViaPlaywright,
  navigateViaPlaywright,
  pdfViaPlaywright,
  resizeViewportViaPlaywright,
  snapshotAiViaPlaywright,
  snapshotAriaViaPlaywright,
  snapshotDeltaViaPlaywright,
  snapshotRoleViaPlaywright,
} from "../../browser/pw-tools-core.snapshot.js";

// Mock logging
vi.mock("../../logging/subsystem.js", async () => {
  return {
    createSubsystemLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      exception: vi.fn(),
    })),
  };
});

// Mock pw-session
vi.mock("../../browser/pw-session.js", async () => {
  return {
    ensurePageState: vi.fn(),
    getPageForTargetId: vi.fn(),
    restoreRoleRefsForTarget: vi.fn(),
    storeRoleRefsForTarget: vi.fn(),
  };
});

// Mock cdp
vi.mock("../../browser/cdp.js", async () => {
  return {
    formatAriaSnapshot: vi.fn((nodes) => nodes.slice(0, 100)),
  };
});

// Mock pw-role-snapshot
vi.mock("../../browser/pw-role-snapshot.js", async () => {
  return {
    buildRoleSnapshotFromAiSnapshot: vi.fn((snapshot) => ({
      snapshot,
      refs: { e1: { role: "button", name: "Submit" } },
    })),
    buildRoleSnapshotFromAriaSnapshot: vi.fn((snapshot) => ({
      snapshot,
      refs: { e1: { role: "button", name: "Click" } },
    })),
    getRoleSnapshotStats: vi.fn((snapshot) => ({
      lines: snapshot.split("\n").length,
      chars: snapshot.length,
      refs: 1,
      interactive: 1,
    })),
  };
});

// Mock dom-observer
vi.mock("../../browser/pw-tools-core.dom-observer.js", async () => {
  return {
    snapshotDeltaViaPlaywright: vi.fn(),
  };
});

describe("pw-tools-snapshot", () => {
  const createMockPage = () => {
    const page = {
      context: vi.fn().mockReturnValue({
        newCDPSession: vi.fn(),
      }),
      goto: vi.fn(),
      url: vi.fn().mockReturnValue("https://example.com"),
      setViewportSize: vi.fn(),
      close: vi.fn(),
      pdf: vi.fn(),
      frameLocator: vi.fn().mockReturnValue({
        locator: vi.fn().mockReturnValue({
          ariaSnapshot: vi.fn().mockResolvedValue("- button [Click]"),
        }),
      }),
      locator: vi.fn().mockReturnValue({
        ariaSnapshot: vi.fn().mockResolvedValue("- button [Submit]"),
      }),
      _snapshotForAI: vi.fn().mockResolvedValue({ full: "snapshot content" }),
    };
    return page as unknown as Page;
  };

  const createMockCDPSession = () => {
    return {
      send: vi.fn().mockResolvedValue({ nodes: [] }),
      detach: vi.fn().mockResolvedValue(undefined),
    } as unknown as CDPSession;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("snapshotDeltaViaPlaywright", () => {
    it("starts delta snapshot", async () => {
      const { getPageForTargetId, ensurePageState } = await import("../../browser/pw-session.js");
      const { snapshotDeltaViaPlaywright: mockSnapshotDelta } = await import(
        "../../browser/pw-tools-core.dom-observer.js"
      );
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);
      vi.mocked(mockSnapshotDelta).mockResolvedValue({ observing: true });

      const result = await snapshotDeltaViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        action: "start",
      });

      expect(getPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://127.0.0.1:9222",
        action: "start",
      });
      expect(ensurePageState).toHaveBeenCalledWith(mockPage);
      expect(result).toEqual({ observing: true });
    });

    it("stops delta snapshot with anchor ref", async () => {
      const { getPageForTargetId, ensurePageState } = await import("../../browser/pw-session.js");
      const { snapshotDeltaViaPlaywright: mockSnapshotDelta } = await import(
        "../../browser/pw-tools-core.dom-observer.js"
      );
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);
      vi.mocked(mockSnapshotDelta).mockResolvedValue({
        addedElements: [],
        removedElements: [],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 100,
      });

      const result = await snapshotDeltaViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
        action: "stop",
        anchorRef: "@e1",
      });

      expect(getPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
        action: "stop",
        anchorRef: "@e1",
      });
      expect(result.urlChanged).toBe(false);
    });
  });

  describe("snapshotAriaViaPlaywright", () => {
    it("captures aria snapshot with default limit", async () => {
      const { getPageForTargetId, ensurePageState } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      const mockSession = createMockCDPSession();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);
      vi.mocked(mockPage.context().newCDPSession).mockResolvedValue(mockSession);

      const result = await snapshotAriaViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(mockSession.send).toHaveBeenCalledWith("Accessibility.enable");
      expect(mockSession.send).toHaveBeenCalledWith("Accessibility.getFullAXTree");
      expect(result.nodes).toEqual([]);
    });

    it("captures aria snapshot with custom limit", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      const mockSession = createMockCDPSession();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);
      vi.mocked(mockPage.context().newCDPSession).mockResolvedValue(mockSession);

      await snapshotAriaViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        limit: 100,
      });

      expect(mockSession.send).toHaveBeenCalledWith("Accessibility.getFullAXTree");
    });

    it("clamps limit to valid range", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      const mockSession = createMockCDPSession();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);
      vi.mocked(mockPage.context().newCDPSession).mockResolvedValue(mockSession);

      // Test minimum limit
      await snapshotAriaViaPlaywright({ cdpUrl: "http://127.0.0.1:9222", limit: -10 });
      // Test maximum limit
      await snapshotAriaViaPlaywright({ cdpUrl: "http://127.0.0.1:9222", limit: 5000 });

      expect(mockSession.send).toHaveBeenCalledTimes(4); // 2 calls per snapshot (enable + getFullAXTree)
    });

    it("detaches session on completion", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      const mockSession = createMockCDPSession();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);
      vi.mocked(mockPage.context().newCDPSession).mockResolvedValue(mockSession);

      await snapshotAriaViaPlaywright({ cdpUrl: "http://127.0.0.1:9222" });

      expect(mockSession.detach).toHaveBeenCalled();
    });

    it("detaches session on error", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      const mockSession = createMockCDPSession();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);
      vi.mocked(mockPage.context().newCDPSession).mockResolvedValue(mockSession);
      vi.mocked(mockSession.send).mockRejectedValue(new Error("CDP error"));

      await expect(snapshotAriaViaPlaywright({ cdpUrl: "http://127.0.0.1:9222" })).rejects.toThrow();

      expect(mockSession.detach).toHaveBeenCalled();
    });
  });

  describe("snapshotAiViaPlaywright", () => {
    it("captures AI snapshot with default options", async () => {
      const { getPageForTargetId, ensurePageState } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      const result = await snapshotAiViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(ensurePageState).toHaveBeenCalledWith(mockPage);
      expect(mockPage._snapshotForAI).toHaveBeenCalledWith({
        timeout: 5000,
        track: "response",
      });
      expect(result.snapshot).toBe("snapshot content");
      expect(result.refs).toEqual({ e1: { role: "button", name: "Submit" } });
    });

    it("truncates snapshot when maxChars exceeded", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      mockPage._snapshotForAI = vi.fn().mockResolvedValue({ full: "x".repeat(1000) });
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      const result = await snapshotAiViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        maxChars: 100,
      });

      expect(result.truncated).toBe(true);
      expect(result.snapshot.length).toBeLessThanOrEqual(150);
    });

    it("clamps timeout to valid range", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      // Test minimum timeout
      await snapshotAiViaPlaywright({ cdpUrl: "http://127.0.0.1:9222", timeoutMs: 100 });
      // Test maximum timeout
      await snapshotAiViaPlaywright({ cdpUrl: "http://127.0.0.1:9222", timeoutMs: 100000 });

      expect(mockPage._snapshotForAI).toHaveBeenCalledTimes(2);
    });

    it("throws when _snapshotForAI not available", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      delete (mockPage as any)._snapshotForAI;
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await expect(snapshotAiViaPlaywright({ cdpUrl: "http://127.0.0.1:9222" })).rejects.toThrow(
        "Playwright _snapshotForAI is not available"
      );
    });

    it("stores role refs after snapshot", async () => {
      const { getPageForTargetId, storeRoleRefsForTarget } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await snapshotAiViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
      });

      expect(storeRoleRefsForTarget).toHaveBeenCalledWith({
        page: mockPage,
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
        refs: expect.any(Object),
        mode: "aria",
      });
    });
  });

  describe("snapshotRoleViaPlaywright", () => {
    it("captures role snapshot in role mode", async () => {
      const { getPageForTargetId, storeRoleRefsForTarget } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      const result = await snapshotRoleViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        refsMode: "role",
      });

      expect(mockPage.locator).toHaveBeenCalledWith(":root");
      expect(result.snapshot).toBe("- button [Submit]");
      expect(result.stats).toEqual({
        lines: 1,
        chars: expect.any(Number),
        refs: 1,
        interactive: 1,
      });
    });

    it("captures role snapshot with selector", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await snapshotRoleViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        refsMode: "role",
        selector: ".my-button",
      });

      expect(mockPage.locator).toHaveBeenCalledWith(".my-button");
    });

    it("captures role snapshot with frame selector", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await snapshotRoleViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        refsMode: "role",
        frameSelector: "iframe#content",
      });

      expect(mockPage.frameLocator).toHaveBeenCalledWith("iframe#content");
    });

    it("captures role snapshot in aria mode", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      const result = await snapshotRoleViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        refsMode: "aria",
      });

      expect(mockPage._snapshotForAI).toHaveBeenCalled();
      expect(result.refsMode).toBeUndefined();
    });

    it("throws for aria mode with selector", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await expect(
        snapshotRoleViaPlaywright({
          cdpUrl: "http://127.0.0.1:9222",
          refsMode: "aria",
          selector: ".button",
        })
      ).rejects.toThrow("refs=aria does not support selector");
    });

    it("throws for aria mode without _snapshotForAI", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      delete (mockPage as any)._snapshotForAI;
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await expect(
        snapshotRoleViaPlaywright({
          cdpUrl: "http://127.0.0.1:9222",
          refsMode: "aria",
        })
      ).rejects.toThrow("refs=aria requires Playwright _snapshotForAI support");
    });
  });

  describe("navigateViaPlaywright", () => {
    it("navigates to URL", async () => {
      const { getPageForTargetId, ensurePageState } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      const result = await navigateViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        url: "https://example.com/page",
      });

      expect(mockPage.goto).toHaveBeenCalledWith("https://example.com/page", {
        timeout: 20000,
      });
      expect(result.url).toBe("https://example.com");
    });

    it("throws for empty URL", async () => {
      await expect(
        navigateViaPlaywright({
          cdpUrl: "http://127.0.0.1:9222",
          url: "",
        })
      ).rejects.toThrow("url is required");
    });

    it("clamps timeout to valid range", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      // Test minimum timeout
      await navigateViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        url: "https://example.com",
        timeoutMs: 100,
      });
      // Test maximum timeout
      await navigateViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        url: "https://example.com",
        timeoutMs: 200000,
      });

      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });
  });

  describe("resizeViewportViaPlaywright", () => {
    it("resizes viewport", async () => {
      const { getPageForTargetId, ensurePageState } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await resizeViewportViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        width: 1920,
        height: 1080,
      });

      expect(mockPage.setViewportSize).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
      });
    });

    it("clamps dimensions to minimum 1", async () => {
      const { getPageForTargetId } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await resizeViewportViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
        width: -100,
        height: 0,
      });

      expect(mockPage.setViewportSize).toHaveBeenCalledWith({
        width: 1,
        height: 1,
      });
    });
  });

  describe("closePageViaPlaywright", () => {
    it("closes page", async () => {
      const { getPageForTargetId, ensurePageState } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      await closePageViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(mockPage.close).toHaveBeenCalled();
    });
  });

  describe("pdfViaPlaywright", () => {
    it("generates PDF", async () => {
      const { getPageForTargetId, ensurePageState } = await import("../../browser/pw-session.js");
      
      const mockPage = createMockPage();
      const mockBuffer = Buffer.from("pdf content");
      vi.mocked(mockPage.pdf).mockResolvedValue(mockBuffer);
      vi.mocked(getPageForTargetId).mockResolvedValue(mockPage);

      const result = await pdfViaPlaywright({
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(mockPage.pdf).toHaveBeenCalledWith({ printBackground: true });
      expect(result.buffer).toEqual(mockBuffer);
    });
  });
});
