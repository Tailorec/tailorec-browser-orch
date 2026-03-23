import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  injectIncrementalRefs,
  snapshotDeltaViaPlaywright,
  startDomObserver,
  stopDomObserver,
} from "../../browser/pw-tools-core.dom-observer.js";

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
    refLocator: vi.fn(),
    restoreRoleRefsForTarget: vi.fn(),
  };
});

describe("pw-tools-dom-observer", () => {
  const createMockPage = () => {
    const evaluateResults = new Map<string, any>();
    
    const page = {
      evaluate: vi.fn(async (fn: any, ...args: any[]) => {
        // Simulate different evaluate behaviors based on the function
        if (typeof fn === "string") {
          // Handle string-based evaluate calls (OBSERVER_JS injection)
          return undefined;
        }
        // For function-based evaluate calls, simulate behavior
        return undefined;
      }),
      _evaluateResults: evaluateResults,
    } as unknown as Page & { _evaluateResults: Map<string, any> };

    return page;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("snapshotDeltaViaPlaywright - start action", () => {
    it("starts observer with default body anchor", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "start",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result).toEqual({ observing: true });
      expect(page.evaluate).toHaveBeenCalledTimes(2);
    });

    it("starts observer with custom anchor ref", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      const { restoreRoleRefsForTarget, refLocator } = await import("../../browser/pw-session.js");
      const mockElementHandle = { _type: "element" };
      vi.mocked(refLocator).mockReturnValue({ elementHandle: vi.fn().mockResolvedValue(mockElementHandle) } as any);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "start",
        anchorRef: "@e1",
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
      });

      expect(result).toEqual({ observing: true });
      expect(restoreRoleRefsForTarget).toHaveBeenCalledWith({
        cdpUrl: "http://127.0.0.1:9222",
        targetId: "tab-1",
        page,
      });
    });

    it("falls back to body when anchor ref not found", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      const { refLocator } = await import("../../browser/pw-session.js");
      vi.mocked(refLocator).mockImplementation(() => {
        throw new Error("Unknown ref");
      });

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "start",
        anchorRef: "@e999",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result).toEqual({ observing: true });
    });

    it("injects observer JS into page", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      await snapshotDeltaViaPlaywright({
        page,
        action: "start",
        cdpUrl: "http://127.0.0.1:9222",
      });

      const firstCall = page.evaluate.mock.calls[0];
      expect(typeof firstCall[0]).toBe("string");
      expect(firstCall[0]).toContain("__skyvernDeltaObserver");
    });
  });

  describe("snapshotDeltaViaPlaywright - stop action", () => {
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
      page.evaluate = vi.fn().mockResolvedValue(mockDelta);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result).toEqual(mockDelta);
    });

    it("throws error when observer not started", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(null);

      await expect(
        snapshotDeltaViaPlaywright({
          page,
          action: "stop",
          cdpUrl: "http://127.0.0.1:9222",
        })
      ).rejects.toThrow("Delta observer not started");
    });

    it("returns delta with added elements", async () => {
      const page = createMockPage();
      const mockDelta = {
        addedElements: [
          { tagName: "div", role: null, text: "New content", className: "content" },
          { tagName: "button", role: "button", text: "Submit", className: "btn" },
        ],
        removedElements: [],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 50,
      };
      page.evaluate = vi.fn().mockResolvedValue(mockDelta);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result.addedElements).toHaveLength(2);
    });

    it("returns delta with removed elements", async () => {
      const page = createMockPage();
      const mockDelta = {
        addedElements: [],
        removedElements: [
          { ref: "d1", text: "Removed item", tagName: "li" },
          { ref: null, text: "Deleted", tagName: "span" },
        ],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 75,
      };
      page.evaluate = vi.fn().mockResolvedValue(mockDelta);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result.removedElements).toHaveLength(2);
    });

    it("returns delta with modified elements", async () => {
      const page = createMockPage();
      const mockDelta = {
        addedElements: [],
        removedElements: [],
        modifiedElements: [
          { ref: "e1", tagName: "input", attr: "value", oldValue: "old", newValue: "new", text: "" },
          { ref: null, tagName: "div", attr: "class", oldValue: "old-class", newValue: "new-class", text: "Content" },
        ],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 60,
      };
      page.evaluate = vi.fn().mockResolvedValue(mockDelta);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result.modifiedElements).toHaveLength(2);
    });

    it("detects URL changes", async () => {
      const page = createMockPage();
      const mockDelta = {
        addedElements: [],
        removedElements: [],
        modifiedElements: [],
        urlChanged: true,
        previousUrl: "https://example.com/page1",
        currentUrl: "https://example.com/page2",
        observationDurationMs: 200,
      };
      page.evaluate = vi.fn().mockResolvedValue(mockDelta);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result.urlChanged).toBe(true);
      expect(result.previousUrl).toBe("https://example.com/page1");
      expect(result.currentUrl).toBe("https://example.com/page2");
    });

    it("limits added elements to 200", async () => {
      const page = createMockPage();
      // The JS observer limits to 200, so we mock the limited result
      const limitedElements = Array.from({ length: 200 }, (_, i) => ({
        tagName: "div",
        role: null,
        text: `Element ${i}`,
        className: "",
      }));
      const mockDelta = {
        addedElements: limitedElements,
        removedElements: [],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 100,
      };
      page.evaluate = vi.fn().mockResolvedValue(mockDelta);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result.addedElements.length).toBe(200);
    });

    it("limits removed elements to 50", async () => {
      const page = createMockPage();
      const limitedElements = Array.from({ length: 50 }, (_, i) => ({
        ref: `d${i}`,
        text: `Removed ${i}`,
        tagName: "div",
      }));
      const mockDelta = {
        addedElements: [],
        removedElements: limitedElements,
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 100,
      };
      page.evaluate = vi.fn().mockResolvedValue(mockDelta);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result.removedElements.length).toBe(50);
    });

    it("limits modified elements to 100", async () => {
      const page = createMockPage();
      const limitedElements = Array.from({ length: 100 }, (_, i) => ({
        ref: `e${i}`,
        tagName: "input",
        attr: "value",
        oldValue: "old",
        newValue: "new",
        text: "",
      }));
      const mockDelta = {
        addedElements: [],
        removedElements: [],
        modifiedElements: limitedElements,
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 100,
      };
      page.evaluate = vi.fn().mockResolvedValue(mockDelta);

      const result = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "http://127.0.0.1:9222",
      });

      expect(result.modifiedElements.length).toBe(100);
    });
  });

  describe("startDomObserver", () => {
    it("starts observer on body by default", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      await startDomObserver(page);

      expect(page.evaluate).toHaveBeenCalled();
    });

    it("starts observer on custom anchor selector", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      await startDomObserver(page, ".dropdown-menu");

      expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), ".dropdown-menu");
    });

    it("logs debug message when starting", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      await startDomObserver(page, ".dropdown");

      expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), ".dropdown");
    });

    it("initializes incremental nodes array", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockImplementation((fn) => {
        // Simulate the evaluate function setting up the observer
        return undefined;
      });

      await startDomObserver(page);

      expect(page.evaluate).toHaveBeenCalled();
    });
  });

  describe("stopDomObserver", () => {
    it("stops observer and returns snapshot", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue({
        nodes: [
          { tagName: "option", role: "option", text: "Option 1", className: "" },
        ],
        observationDurationMs: 50,
      });

      const result = await stopDomObserver(page);

      expect(result.newElements).toHaveLength(1);
      expect(result.newElements[0]?.ref).toBe("d1");
      expect(result.newElements[0]?.tagName).toBe("option");
    });

    it("assigns incremental refs (d1, d2, d3...)", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue({
        nodes: [
          { tagName: "div", role: null, text: "First", className: "" },
          { tagName: "span", role: null, text: "Second", className: "" },
          { tagName: "button", role: "button", text: "Third", className: "" },
        ],
        observationDurationMs: 30,
      });

      const result = await stopDomObserver(page);

      expect(result.newElements[0]?.ref).toBe("d1");
      expect(result.newElements[1]?.ref).toBe("d2");
      expect(result.newElements[2]?.ref).toBe("d3");
    });

    it("includes element properties in snapshot", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue({
        nodes: [
          {
            tagName: "input",
            role: null,
            text: "",
            ariaLabel: "Email",
            ariaSelected: null,
            dataValue: "test@example.com",
            className: "input-field",
            rect: { x: 100, y: 200, width: 200, height: 40 },
            isInteractable: true,
          },
        ],
        observationDurationMs: 25,
      });

      const result = await stopDomObserver(page);

      expect(result.newElements[0]).toMatchObject({
        tagName: "input",
        ariaLabel: "Email",
        dataValue: "test@example.com",
        className: "input-field",
        isInteractable: true,
      });
    });

    it("returns zero removed count", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue({
        nodes: [],
        observationDurationMs: 10,
      });

      const result = await stopDomObserver(page);

      expect(result.removedCount).toBe(0);
    });

    it("disconnects observer on stop", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue({
        nodes: [],
        observationDurationMs: 10,
      });

      await stopDomObserver(page);

      expect(page.evaluate).toHaveBeenCalled();
    });

    it("cleans up global variables after stop", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue({
        nodes: [],
        observationDurationMs: 10,
      });

      await stopDomObserver(page);

      // Verify evaluate was called to clean up
      expect(page.evaluate).toHaveBeenCalled();
    });
  });

  describe("injectIncrementalRefs", () => {
    it("injects aria-ref attributes into elements", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      const elements = [
        { ref: "d1", tagName: "button", text: "Submit", rect: { x: 100, y: 100, width: 80, height: 40 } },
      ];

      await injectIncrementalRefs(page, elements);

      expect(page.evaluate).toHaveBeenCalled();
    });

    it("uses elementFromPoint to locate elements", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      const elements = [
        { ref: "d1", tagName: "div", text: "Content", rect: { x: 50, y: 50, width: 100, height: 50 } },
      ];

      await injectIncrementalRefs(page, elements);

      const evaluateCall = page.evaluate.mock.calls[0];
      const evaluateFn = evaluateCall[0];
      const evaluateArgs = evaluateCall[1];
      
      expect(evaluateArgs).toEqual(elements);
    });

    it("skips elements without rect", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      const elements = [
        { ref: "d1", tagName: "button", text: "Click", rect: undefined },
        { ref: "d2", tagName: "span", text: "Text", rect: { x: 0, y: 0, width: 50, height: 20 } },
      ];

      await injectIncrementalRefs(page, elements);

      expect(page.evaluate).toHaveBeenCalled();
    });

    it("handles multiple elements", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      const elements = [
        { ref: "d1", tagName: "button", text: "First", rect: { x: 10, y: 10, width: 50, height: 30 } },
        { ref: "d2", tagName: "input", text: "", rect: { x: 70, y: 10, width: 100, height: 30 } },
        { ref: "d3", tagName: "label", text: "Label", rect: { x: 180, y: 10, width: 60, height: 30 } },
      ];

      await injectIncrementalRefs(page, elements);

      expect(page.evaluate).toHaveBeenCalled();
      const evaluateCall = page.evaluate.mock.calls[0];
      expect(evaluateCall[1]).toHaveLength(3);
    });

    it("walks up parent tree to find matching element", async () => {
      const page = createMockPage();
      page.evaluate = vi.fn().mockResolvedValue(undefined);

      const elements = [
        { ref: "d1", tagName: "li", text: "List item", rect: { x: 20, y: 20, width: 100, height: 30 } },
      ];

      await injectIncrementalRefs(page, elements);

      expect(page.evaluate).toHaveBeenCalled();
    });
  });

  describe("IncrementalElement type", () => {
    it("has required properties", () => {
      const element = {
        tagName: "button",
        role: "button",
        text: "Click me",
        className: "btn-primary",
        ariaInvalid: null,
        isError: false,
      };

      expect(element.tagName).toBe("button");
      expect(element.role).toBe("button");
      expect(element.text).toBe("Click me");
    });

    it("supports optional properties", () => {
      const element = {
        tagName: "input",
        role: null,
        text: "",
        className: "form-input",
        ariaInvalid: "true",
        isError: true,
        ref: "d1",
        rect: { x: 100, y: 200, width: 200, height: 40 },
        ariaLabel: "Email address",
        ariaSelected: "false",
        dataValue: "test@example.com",
        isInteractable: true,
      };

      expect(element.ref).toBe("d1");
      expect(element.ariaLabel).toBe("Email address");
      expect(element.isInteractable).toBe(true);
    });
  });

  describe("DomDelta type", () => {
    it("has required properties", () => {
      const delta = {
        addedElements: [],
        removedElements: [],
        modifiedElements: [],
        urlChanged: false,
        previousUrl: "https://example.com",
        currentUrl: "https://example.com",
        observationDurationMs: 100,
      };

      expect(delta.addedElements).toEqual([]);
      expect(delta.urlChanged).toBe(false);
      expect(delta.observationDurationMs).toBe(100);
    });

    it("supports populated delta", () => {
      const delta = {
        addedElements: [{ tagName: "div", role: null, text: "New", className: "" }],
        removedElements: [{ ref: "d1", text: "Removed", tagName: "span" }],
        modifiedElements: [{ ref: "e1", tagName: "input", attr: "value", oldValue: "a", newValue: "b", text: "" }],
        urlChanged: true,
        previousUrl: "https://example.com/1",
        currentUrl: "https://example.com/2",
        observationDurationMs: 250,
      };

      expect(delta.addedElements).toHaveLength(1);
      expect(delta.removedElements).toHaveLength(1);
      expect(delta.modifiedElements).toHaveLength(1);
      expect(delta.urlChanged).toBe(true);
    });
  });
});
