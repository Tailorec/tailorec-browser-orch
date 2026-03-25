import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SnapshotService } from "../../core/services/snapshot.service.js";
import { TakeSnapshotUseCase } from "../../core/use-cases/take-snapshot.use-case.js";
import { PlaywrightNavigationAdapter } from "../../adapters/playwright/playwright.navigation.adapter.js";

function createMockPage() {
  const session = {
    send: vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ nodes: [] }),
    detach: vi.fn().mockResolvedValue(undefined),
  };

  return {
    context: vi.fn().mockReturnValue({
      newCDPSession: vi.fn().mockResolvedValue(session),
    }),
    goto: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue("https://example.com"),
    title: vi.fn().mockResolvedValue("Example"),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("shot")),
    _snapshotForAI: vi.fn().mockResolvedValue({ full: "- button \"Submit\"" }),
  } as any;
}

function createSessionService(page = createMockPage()) {
  return {
    getPage: vi.fn(async () => page),
    storeRoleRefs: vi.fn(async () => undefined),
  } as any;
}

describe("pw-tools-snapshot", () => {
  const snapshotService = new SnapshotService();
  const navigationAdapter = new PlaywrightNavigationAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("SnapshotService.captureAriaSnapshot", () => {
    it("captures aria snapshot with default limit", async () => {
      const page = createMockPage();

      const result = await snapshotService.captureAriaSnapshot(page);

      const session = await page.context().newCDPSession.mock.results[0].value;
      expect(session.send).toHaveBeenCalledWith("Accessibility.enable");
      expect(session.send).toHaveBeenCalledWith("Accessibility.getFullAXTree");
      expect(result.nodes).toEqual([]);
    });

    it("captures aria snapshot with custom limit", async () => {
      const page = createMockPage();
      const nodes = Array.from({ length: 5 }, (_, index) => ({
        role: { value: `role-${index}` },
        name: { value: `name-${index}` },
      }));
      const session = {
        send: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ nodes }),
        detach: vi.fn().mockResolvedValue(undefined),
      };
      page.context = vi.fn().mockReturnValue({
        newCDPSession: vi.fn().mockResolvedValue(session),
      });

      const result = await snapshotService.captureAriaSnapshot(page, 2);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]).toEqual({
        role: "role-0",
        name: "name-0",
        children: undefined,
      });
    });

    it("detaches session on completion", async () => {
      const page = createMockPage();

      await snapshotService.captureAriaSnapshot(page);

      const session = await page.context().newCDPSession.mock.results[0].value;
      expect(session.detach).toHaveBeenCalled();
    });

    it("detaches session on error", async () => {
      const page = createMockPage();
      const session = {
        send: vi.fn().mockRejectedValue(new Error("CDP error")),
        detach: vi.fn().mockResolvedValue(undefined),
      };
      page.context = vi.fn().mockReturnValue({
        newCDPSession: vi.fn().mockResolvedValue(session),
      });

      await expect(snapshotService.captureAriaSnapshot(page)).rejects.toThrow("CDP error");
      expect(session.detach).toHaveBeenCalled();
    });
  });

  describe("SnapshotService.captureSnapshot", () => {
    it("captures AI snapshot with default options", async () => {
      const page = createMockPage();

      const result = await snapshotService.captureSnapshot(page, {});

      expect(page._snapshotForAI).toHaveBeenCalledWith({
        timeout: 5000,
        track: "response",
      });
      expect(result.snapshot).toContain("Submit");
      expect(result.refs).toEqual({});
    });

    it("truncates snapshot when maxChars exceeded", async () => {
      const page = createMockPage();
      page._snapshotForAI = vi.fn().mockResolvedValue({ full: "x".repeat(1000) });

      const result = await snapshotService.captureSnapshot(page, { maxChars: 100 });

      expect(result.truncated).toBe(true);
      expect(result.snapshot.length).toBeGreaterThan(100);
      expect(result.snapshot).toContain("[...TRUNCATED - page too large]");
    });

    it("clamps timeout to valid range", async () => {
      const page = createMockPage();

      await snapshotService.captureSnapshot(page, { timeoutMs: 100 });
      await snapshotService.captureSnapshot(page, { timeoutMs: 100000 });

      expect(page._snapshotForAI).toHaveBeenNthCalledWith(1, {
        timeout: 500,
        track: "response",
      });
      expect(page._snapshotForAI).toHaveBeenNthCalledWith(2, {
        timeout: 60000,
        track: "response",
      });
    });

    it("throws when _snapshotForAI not available", async () => {
      const page = createMockPage();
      delete page._snapshotForAI;

      await expect(snapshotService.captureSnapshot(page, {})).rejects.toThrow(
        "Playwright _snapshotForAI is not available",
      );
    });
  });

  describe("TakeSnapshotUseCase.execute", () => {
    it("stores refs after ai snapshot", async () => {
      const page = createMockPage();
      const sessionService = createSessionService(page);
      const useCase = new TakeSnapshotUseCase(sessionService, snapshotService);

      const result = await useCase.execute({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
        type: "ai",
      });

      expect(result.ok).toBe(true);
      expect(sessionService.storeRoleRefs).toHaveBeenCalledWith(
        "tab-1",
        expect.any(Object),
        "aria",
      );
    });

    it("returns nodes for aria snapshot", async () => {
      const page = createMockPage();
      const sessionService = createSessionService(page);
      const useCase = new TakeSnapshotUseCase(sessionService, snapshotService);

      const result = await useCase.execute({
        type: "aria",
        options: { ariaLimit: 100 },
      });

      expect(result.ok).toBe(true);
      expect(result.nodes).toEqual([]);
    });

    it("stores refs in requested mode for role snapshot", async () => {
      const page = createMockPage();
      const sessionService = createSessionService(page);
      const useCase = new TakeSnapshotUseCase(sessionService, snapshotService);

      const result = await useCase.execute({
        targetId: "tab-1",
        type: "role",
        options: { refsMode: "role" },
      });

      expect(result.ok).toBe(true);
      expect(sessionService.storeRoleRefs).toHaveBeenCalledWith(
        "tab-1",
        expect.any(Object),
        "role",
      );
    });

    it("publishes lifecycle events", async () => {
      const page = createMockPage();
      const sessionService = createSessionService(page);
      const eventBus = { publish: vi.fn() };
      const useCase = new TakeSnapshotUseCase(sessionService, snapshotService, eventBus as any);

      await useCase.execute({ targetId: "tab-1", type: "ai" });

      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      expect(eventBus.publish.mock.calls[0][0]).toMatchObject({
        type: "ai",
        aggregateId: "tab-1",
      });
      expect(eventBus.publish.mock.calls[1][0]).toMatchObject({
        type: "ai",
        aggregateId: "tab-1",
      });
    });

    it("returns error response on failure", async () => {
      const brokenService = {
        captureSnapshot: vi.fn().mockRejectedValue(new Error("boom")),
        captureAriaSnapshot: vi.fn(),
      };
      const page = createMockPage();
      const sessionService = createSessionService(page);
      const useCase = new TakeSnapshotUseCase(
        sessionService,
        brokenService as any,
        { publish: vi.fn() } as any,
      );

      const result = await useCase.execute({ type: "ai" });

      expect(result).toEqual({ ok: false, error: "boom" });
    });
  });

  describe("PlaywrightNavigationAdapter", () => {
    it("navigates to URL", async () => {
      const page = createMockPage();

      const result = await navigationAdapter.navigate(page, "https://example.com/page");

      expect(page.goto).toHaveBeenCalledWith("https://example.com/page", {
        timeout: 20000,
        waitUntil: "load",
      });
      expect(result.url).toBe("https://example.com");
    });

    it("throws for empty URL", async () => {
      const page = createMockPage();

      await expect(navigationAdapter.navigate(page, "")).rejects.toThrow("url is required");
    });

    it("clamps navigation timeout to valid range", async () => {
      const page = createMockPage();

      await navigationAdapter.navigate(page, "https://example.com", { timeoutMs: 100 });
      await navigationAdapter.navigate(page, "https://example.com", { timeoutMs: 200000 });

      expect(page.goto).toHaveBeenNthCalledWith(1, "https://example.com", {
        timeout: 1000,
        waitUntil: "load",
      });
      expect(page.goto).toHaveBeenNthCalledWith(2, "https://example.com", {
        timeout: 120000,
        waitUntil: "load",
      });
    });

    it("resizes viewport", async () => {
      const page = createMockPage();

      await navigationAdapter.resizeViewport(page, 1920, 1080);

      expect(page.setViewportSize).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
      });
    });

    it("clamps dimensions to minimum 1", async () => {
      const page = createMockPage();

      await navigationAdapter.resizeViewport(page, -100, 0);

      expect(page.setViewportSize).toHaveBeenCalledWith({
        width: 1,
        height: 1,
      });
    });

    it("closes page", async () => {
      const page = createMockPage();

      await navigationAdapter.closePage(page);

      expect(page.close).toHaveBeenCalled();
    });

    it("generates pdf", async () => {
      const page = createMockPage();

      const result = await navigationAdapter.generatePdf(page);

      expect(page.pdf).toHaveBeenCalledWith({ printBackground: true, format: "A4" });
      expect(result.buffer).toEqual(Buffer.from("pdf"));
    });
  });
});
