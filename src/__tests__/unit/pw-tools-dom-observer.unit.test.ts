import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  discoverDropdownOptions,
  injectIncrementalRefs,
  startDomDeltaObserver,
  startDomObserver,
  stopDomDeltaObserver,
  stopDomObserver,
} from "../../adapters/playwright/playwright.dom-observer.adapter.js";

describe("pw-tools-dom-observer", () => {
  const createMockPage = () =>
    ({
      evaluate: vi.fn(async () => undefined),
      waitForTimeout: vi.fn(async () => undefined),
    }) as unknown as Page;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startDomDeltaObserver", () => {
    it("starts observer with default body anchor", async () => {
      const page = createMockPage();
      const result = await startDomDeltaObserver({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        refLocator: vi.fn(),
        restoreRoleRefs: vi.fn(),
      });
      expect(result).toEqual({ observing: true });
      expect(page.evaluate).toHaveBeenCalledTimes(2);
    });

    it("starts observer with custom anchor ref", async () => {
      const page = createMockPage();
      const refLocator = vi.fn(() => ({ elementHandle: vi.fn(async () => ({ _type: "element" })) }));
      const restoreRoleRefs = vi.fn();
      const result = await startDomDeltaObserver({
        page,
        anchorRef: "@e1",
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
        refLocator,
        restoreRoleRefs,
      });
      expect(result).toEqual({ observing: true });
      expect(restoreRoleRefs).toHaveBeenCalledWith({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
        page,
      });
    });

    it("falls back to body when anchor ref not found", async () => {
      const page = createMockPage();
      const result = await startDomDeltaObserver({
        page,
        anchorRef: "@e999",
        cdpUrl: "http://127.0.0.1:9222",
        refLocator: vi.fn(() => {
          throw new Error("Unknown ref");
        }),
        restoreRoleRefs: vi.fn(),
      });
      expect(result).toEqual({ observing: true });
    });

    it("injects observer JS into page", async () => {
      const page = createMockPage();
      await startDomDeltaObserver({
        page,
        cdpUrl: "http://127.0.0.1:9222",
        refLocator: vi.fn(),
        restoreRoleRefs: vi.fn(),
      });
      expect(typeof (page.evaluate as any).mock.calls[0][0]).toBe("string");
      expect((page.evaluate as any).mock.calls[0][0]).toContain("__skyvernDeltaObserver");
    });
  });

  describe("stopDomDeltaObserver", () => {
    it("stops observer and returns delta", async () => {
      const page = createMockPage();
      const mockDelta = {
        addedElements: [{ tagName: "button", role: "button", text: "Click me" }],
        removedElements: [],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 100,
      };
      (page.evaluate as any).mockResolvedValue(mockDelta);
      expect(await stopDomDeltaObserver(page)).toEqual(mockDelta);
    });

    it("throws error when observer not started", async () => {
      const page = createMockPage();
      (page.evaluate as any).mockResolvedValue(null);
      await expect(stopDomDeltaObserver(page)).rejects.toThrow(/Delta observer not started/);
    });

    it("returns delta with added elements", async () => {
      const page = createMockPage();
      (page.evaluate as any).mockResolvedValue({
        addedElements: [{ tagName: "div" }, { tagName: "button" }],
        removedElements: [],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 50,
      });
      expect((await stopDomDeltaObserver(page)).addedElements).toHaveLength(2);
    });

    it("returns delta with removed elements", async () => {
      const page = createMockPage();
      (page.evaluate as any).mockResolvedValue({
        addedElements: [],
        removedElements: [{ ref: "d1", text: "Removed", tagName: "li" }],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 75,
      });
      expect((await stopDomDeltaObserver(page)).removedElements).toHaveLength(1);
    });

    it("returns delta with modified elements", async () => {
      const page = createMockPage();
      (page.evaluate as any).mockResolvedValue({
        addedElements: [],
        removedElements: [],
        modifiedElements: [{ ref: "e1", tagName: "input", attr: "value", oldValue: "old", newValue: "new", text: "" }],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 60,
      });
      expect((await stopDomDeltaObserver(page)).modifiedElements).toHaveLength(1);
    });

    it("detects URL changes", async () => {
      const page = createMockPage();
      (page.evaluate as any).mockResolvedValue({
        addedElements: [],
        removedElements: [],
        modifiedElements: [],
        urlChanged: true,
        previousUrl: "https://example.com/page1",
        currentUrl: "https://example.com/page2",
        observationDurationMs: 200,
      });
      const result = await stopDomDeltaObserver(page);
      expect(result.urlChanged).toBe(true);
      expect(result.currentUrl).toContain("page2");
    });
  });

  describe("lightweight observer helpers", () => {
    it("starts lightweight observer", async () => {
      const page = createMockPage();
      await startDomObserver(page);
      expect(page.evaluate).toHaveBeenCalled();
    });

    it("stops lightweight observer and maps refs", async () => {
      const page = createMockPage();
      (page.evaluate as any).mockResolvedValue({
        nodes: [{ tagName: "div", role: null, text: "New content", className: "", rect: { x: 1, y: 2, width: 3, height: 4 } }],
        observationDurationMs: 10,
      });
      const result = await stopDomObserver(page);
      expect(result.newElements[0]?.ref).toBe("d1");
      expect(result.removedCount).toBe(0);
    });

    it("injects incremental refs", async () => {
      const page = createMockPage();
      await injectIncrementalRefs(page, [{ ref: "d1", tagName: "div", role: null, text: "New content", className: "", ariaInvalid: null, isError: false, rect: { x: 0, y: 0, width: 10, height: 10 } }]);
      expect(page.evaluate).toHaveBeenCalled();
    });

    it("discovers dropdown options via observer wrapper", async () => {
      const page = createMockPage();
      (page.evaluate as any)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ nodes: [{ tagName: "option", role: "option", text: "Choice", className: "", rect: { x: 0, y: 0, width: 10, height: 10 } }], observationDurationMs: 10 });
      const triggerFn = vi.fn(async () => undefined);
      const result = await discoverDropdownOptions(page, triggerFn, 50);
      expect(triggerFn).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
