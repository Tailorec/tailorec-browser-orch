import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionService } from "../../core/services/interaction.service.js";
import { DiscoveryService } from "../../core/services/discovery.service.js";
import { PlaywrightInteractionsAdapter } from "../../adapters/playwright/playwright.interactions.adapter.js";

function createTestMocks() {
  const locator: any = {
    click: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    dragTo: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    blur: vi.fn().mockResolvedValue(undefined),
    inputValue: vi.fn().mockResolvedValue(""),
    innerText: vi.fn().mockResolvedValue(""),
    getAttribute: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(1),
    first: vi.fn(),
    isVisible: vi.fn().mockResolvedValue(true),
    isEnabled: vi.fn().mockResolvedValue(true),
    isEditable: vi.fn().mockResolvedValue(true),
    boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 }),
    evaluate: vi.fn().mockResolvedValue({
      tagName: "input",
      inputType: "text",
      currentValue: "hello",
      required: false,
      ariaInvalid: false,
      ariaExpanded: null,
      checked: null,
      focusable: true,
      isObscured: false,
    }),
    press: vi.fn().mockResolvedValue(undefined),
    pressSequentially: vi.fn().mockResolvedValue(undefined),
    selectText: vi.fn().mockResolvedValue(undefined),
    setChecked: vi.fn().mockResolvedValue(undefined),
    setInputFiles: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
  };
  locator.first.mockReturnValue(locator);

  const page: any = {
    _url: "https://example.test",
    url: vi.fn(() => "https://example.test"),
    locator: vi.fn(() => locator),
    getByText: vi.fn(() => ({ first: vi.fn(() => ({ waitFor: vi.fn().mockResolvedValue(undefined) })) })),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
    },
    mouse: {
      click: vi.fn().mockResolvedValue(undefined),
    },
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
  };

  const locateRef = vi.fn(() => locator);

  return { page, locator, locateRef };
}

describe("unit: pw-tools-core.interactions", () => {
  const interactionService = new InteractionService();
  const discoveryService = new DiscoveryService();
  const adapter = new PlaywrightInteractionsAdapter();

  let page: any;
  let locator: any;
  let locateRef: any;

  beforeEach(() => {
    ({ page, locator, locateRef } = createTestMocks());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("click actions", () => {
    it("successful click with default options", async () => {
      await interactionService.executeAction(page, { kind: "click", ref: "d1" }, locateRef);
      expect(locator.click).toHaveBeenCalledWith({
        timeout: 8000,
        button: undefined,
        modifiers: undefined,
      });
    });

    it("click with custom button", async () => {
      await interactionService.executeAction(
        page,
        { kind: "click", ref: "d1", button: "right" },
        locateRef,
      );
      expect(locator.click).toHaveBeenCalledWith(expect.objectContaining({ button: "right" }));
    });

    it("click with modifiers", async () => {
      await interactionService.executeAction(
        page,
        { kind: "click", ref: "d1", modifiers: ["Shift", "Meta"] },
        locateRef,
      );
      expect(locator.click).toHaveBeenCalledWith(
        expect.objectContaining({ modifiers: ["Shift", "Meta"] }),
      );
    });

    it("double-click functionality", async () => {
      await interactionService.executeAction(
        page,
        { kind: "click", ref: "d1", doubleClick: true },
        locateRef,
      );
      expect(locator.dblclick).toHaveBeenCalled();
      expect(locator.click).not.toHaveBeenCalled();
    });

    it("passes through explicit timeout", async () => {
      await interactionService.executeAction(
        page,
        { kind: "click", ref: "d1", timeoutMs: 5000 },
        locateRef,
      );
      expect(locator.click).toHaveBeenCalledWith(expect.objectContaining({ timeout: 5000 }));
    });

    it("uses resolver for aria-style refs", async () => {
      await interactionService.executeAction(page, { kind: "click", ref: "@d1" }, locateRef);
      expect(locateRef).toHaveBeenCalledWith("d1");
    });

    it("propagates click errors", async () => {
      locator.click.mockRejectedValueOnce(new Error("Element not found"));
      await expect(
        interactionService.executeAction(page, { kind: "click", ref: "d1" }, locateRef),
      ).rejects.toThrow("Element not found");
    });
  });

  describe("type actions", () => {
    it("basic text typing", async () => {
      await interactionService.executeAction(
        page,
        { kind: "type", ref: "d1", text: "Hello World" },
        locateRef,
      );
      expect(locator.fill).toHaveBeenCalledWith("Hello World", { timeout: 8000 });
    });

    it("supports submit option", async () => {
      await interactionService.executeAction(
        page,
        { kind: "type", ref: "d1", text: "test@example.com", submit: true },
        locateRef,
      );
      expect(locator.press).toHaveBeenCalledWith("Enter", { timeout: 8000 });
    });

    it("supports slowly option", async () => {
      await interactionService.executeAction(
        page,
        { kind: "type", ref: "d1", text: "password123", slowly: true },
        locateRef,
      );
      expect(locator.click).toHaveBeenCalledWith({ timeout: 8000 });
      expect(locator.type).toHaveBeenCalledWith("password123", {
        timeout: 8000,
        delay: 75,
      });
    });

    it("supports clear option", async () => {
      await interactionService.executeAction(
        page,
        { kind: "type", ref: "d1", text: "test", clear: true },
        locateRef,
      );
      expect(locator.clear).toHaveBeenCalledWith({ timeout: 8000 });
    });

    it("passes through timeout", async () => {
      await interactionService.executeAction(
        page,
        { kind: "type", ref: "d1", text: "test", timeoutMs: 5000 },
        locateRef,
      );
      expect(locator.fill).toHaveBeenCalledWith("test", { timeout: 5000 });
    });

    it("propagates fill failures", async () => {
      locator.fill.mockRejectedValueOnce(new Error("Element is not fillable"));
      await expect(
        interactionService.executeAction(
          page,
          { kind: "type", ref: "d1", text: "test" },
          locateRef,
        ),
      ).rejects.toThrow("Element is not fillable");
    });
  });

  describe("fill actions", () => {
    it("fills multiple text fields", async () => {
      locator.inputValue
        .mockResolvedValueOnce("Alice")
        .mockResolvedValueOnce("alice@example.com");

      const result = await interactionService.executeAction(
        page,
        {
          kind: "fill",
          fields: [
            { ref: "name", type: "text", value: "Alice" },
            { ref: "email", type: "email", value: "alice@example.com" },
          ],
        },
        locateRef,
      );

      expect((result.result as any).results).toHaveLength(2);
      expect(locator.fill).toHaveBeenCalledTimes(2);
    });

    it("handles checkbox values", async () => {
      const result = await interactionService.executeAction(
        page,
        { kind: "fill", fields: [{ ref: "agree", type: "checkbox", value: true }] },
        locateRef,
      );

      expect(locator.setChecked).toHaveBeenCalledWith(true, { timeout: 8000 });
      expect((result.result as any).results[0]).toMatchObject({
        ref: "agree",
        matched: true,
        requestedValue: "true",
      });
    });

    it("handles radio values", async () => {
      await interactionService.executeAction(
        page,
        { kind: "fill", fields: [{ ref: "opt", type: "radio", value: "1" }] },
        locateRef,
      );
      expect(locator.setChecked).toHaveBeenCalledWith(true, { timeout: 8000 });
    });

    it("falls back to keyboard typing when fill throws", async () => {
      locator.fill.mockRejectedValueOnce(new Error("fill failed"));
      locator.inputValue.mockResolvedValueOnce("typed");

      await interactionService.executeAction(
        page,
        { kind: "fill", fields: [{ ref: "bio", type: "text", value: "typed" }] },
        locateRef,
      );

      expect(locator.click).toHaveBeenCalledWith({ timeout: 3000 });
      expect(locator.selectText).toHaveBeenCalled();
      expect(page.keyboard.type).toHaveBeenCalledWith("typed", { delay: 30 });
    });

    it("returns mismatched result when verification fails", async () => {
      locator.inputValue.mockResolvedValueOnce("wrong");

      const result = await interactionService.executeAction(
        page,
        { kind: "fill", fields: [{ ref: "bio", type: "text", value: "expected" }] },
        locateRef,
      );

      expect((result.result as any).results[0]).toMatchObject({
        matched: false,
        actualValue: "wrong",
      });
    });

    it("propagates timeout to fill", async () => {
      locator.inputValue.mockResolvedValueOnce("value");
      await interactionService.executeAction(
        page,
        { kind: "fill", timeoutMs: 1234, fields: [{ ref: "bio", type: "text", value: "value" }] },
        locateRef,
      );
      expect(locator.fill).toHaveBeenCalledWith("value", { timeout: 1234 });
    });

    it("uses current adapter skip strategy when values already match", async () => {
      locator.inputValue.mockResolvedValueOnce("existing");

      const result = await adapter.fill(page, "bio", { value: "existing" });

      expect(result).toMatchObject({
        matched: true,
        strategy: "skip",
        actualValue: "existing",
      });
    });

    it("uses adapter fallback strategy when fill does not stick", async () => {
      locator.inputValue
        .mockResolvedValueOnce("old")
        .mockResolvedValueOnce("still old")
        .mockResolvedValueOnce("new");

      const result = await adapter.fill(page, "bio", { value: "new" });

      expect(locator.pressSequentially).toHaveBeenCalledWith("new", {
        delay: 40,
        timeout: 8000,
      });
      expect(result.strategy).toBe("pressSequentially");
      expect(result.matched).toBe(true);
    });
  });

  describe("hover, drag, select, press, and scroll actions", () => {
    it("hovers target element", async () => {
      await interactionService.executeAction(page, { kind: "hover", ref: "d1" }, locateRef);
      expect(locator.hover).toHaveBeenCalledWith({ timeout: 8000 });
    });

    it("drags between refs", async () => {
      await interactionService.executeAction(
        page,
        { kind: "drag", startRef: "a1", endRef: "b2" },
        locateRef,
      );
      expect(locator.dragTo).toHaveBeenCalledWith(locator, { timeout: 8000 });
      expect(locateRef).toHaveBeenCalledWith("a1");
      expect(locateRef).toHaveBeenCalledWith("b2");
    });

    it("selects one option", async () => {
      await interactionService.executeAction(
        page,
        { kind: "select", ref: "country", values: ["IN"] },
        locateRef,
      );
      expect(locator.selectOption).toHaveBeenCalledWith(["IN"], { timeout: 8000 });
    });

    it("presses keyboard key", async () => {
      await interactionService.executeAction(page, { kind: "press", key: "Enter" }, locateRef);
      expect(page.keyboard.press).toHaveBeenCalledWith("Enter", { delay: 0 });
    });

    it("supports delayed key presses", async () => {
      await interactionService.executeAction(
        page,
        { kind: "press", key: "Tab", delayMs: 50 },
        locateRef,
      );
      expect(page.keyboard.press).toHaveBeenCalledWith("Tab", { delay: 50 });
    });

    it("scrolls element into view", async () => {
      await interactionService.executeAction(
        page,
        { kind: "scrollIntoView", ref: "section" },
        locateRef,
      );
      expect(locator.scrollIntoViewIfNeeded).toHaveBeenCalledWith({ timeout: 8000 });
    });

    it("resizes viewport", async () => {
      await interactionService.executeAction(
        page,
        { kind: "resize", width: 1200, height: 800 },
        locateRef,
      );
      expect(page.setViewportSize).toHaveBeenCalledWith({ width: 1200, height: 800 });
    });

    it("clamps viewport dimensions", async () => {
      await interactionService.executeAction(
        page,
        { kind: "resize", width: -5, height: 0 },
        locateRef,
      );
      expect(page.setViewportSize).toHaveBeenCalledWith({ width: 1, height: 1 });
    });

    it("closes page", async () => {
      await interactionService.executeAction(page, { kind: "close" }, locateRef);
      expect(page.close).toHaveBeenCalled();
    });
  });

  describe("wait and evaluate actions", () => {
    it("waits for a duration", async () => {
      await interactionService.executeAction(page, { kind: "wait", timeMs: 500 }, locateRef);
      expect(page.waitForTimeout).toHaveBeenCalledWith(500);
    });

    it("waits for text", async () => {
      await interactionService.executeAction(page, { kind: "wait", text: "Ready" }, locateRef);
      expect(page.getByText).toHaveBeenCalledWith("Ready");
    });

    it("waits for selector", async () => {
      await interactionService.executeAction(
        page,
        { kind: "wait", selector: ".ready", timeoutMs: 1234 },
        locateRef,
      );
      expect(page.locator).toHaveBeenCalledWith(".ready");
    });

    it("waits for URL", async () => {
      await interactionService.executeAction(
        page,
        { kind: "wait", url: "**/done", timeoutMs: 3210 },
        locateRef,
      );
      expect(page.waitForURL).toHaveBeenCalledWith("**/done", { timeout: 3210 });
    });

    it("waits for load state", async () => {
      await interactionService.executeAction(
        page,
        { kind: "wait", loadState: "networkidle", timeoutMs: 1111 },
        locateRef,
      );
      expect(page.waitForLoadState).toHaveBeenCalledWith("networkidle", { timeout: 1111 });
    });

    it("waits for function", async () => {
      await interactionService.executeAction(
        page,
        { kind: "wait", fn: "() => true", timeoutMs: 2222 },
        locateRef,
      );
      expect(page.waitForFunction).toHaveBeenCalledWith("() => true", { timeout: 2222 });
    });

    it("evaluates page-scoped function", async () => {
      page.evaluate.mockResolvedValueOnce(42);

      const result = await interactionService.executeAction(
        page,
        { kind: "evaluate", fn: "() => 42" },
        locateRef,
      );

      expect(result.result).toBe(42);
    });

    it("evaluates ref-scoped function through locator", async () => {
      locator.evaluate.mockResolvedValueOnce("ok");

      const result = await interactionService.executeAction(
        page,
        { kind: "evaluate", ref: "d1", fn: "(el) => el.tagName" },
        locateRef,
      );

      expect(locator.evaluate).toHaveBeenCalled();
      expect(result.result).toBe("ok");
    });
  });

  describe("queryElementState", () => {
    it("returns populated element state", async () => {
      const result = await discoveryService.queryElementState(page, "d1", locateRef);

      expect(result).toMatchObject({
        ref: "d1",
        exists: true,
        visible: true,
        enabled: true,
        editable: true,
        tagName: "input",
      });
    });

    it("returns non-existent state when locator count is zero", async () => {
      locator.count.mockResolvedValueOnce(0);

      const result = await discoveryService.queryElementState(page, "d1", locateRef);

      expect(result).toMatchObject({
        exists: false,
        visible: false,
        boundingBox: null,
      });
    });

    it("handles invisible elements", async () => {
      locator.isVisible.mockRejectedValueOnce(new Error("hidden"));
      const result = await discoveryService.queryElementState(page, "d1", locateRef);
      expect(result.visible).toBe(false);
    });

    it("handles disabled elements", async () => {
      locator.isEnabled.mockRejectedValueOnce(new Error("disabled"));
      const result = await discoveryService.queryElementState(page, "d1", locateRef);
      expect(result.enabled).toBe(false);
    });

    it("handles non-editable elements", async () => {
      locator.isEditable.mockRejectedValueOnce(new Error("readonly"));
      const result = await discoveryService.queryElementState(page, "d1", locateRef);
      expect(result.editable).toBe(false);
    });

    it("handles missing bounding box", async () => {
      locator.boundingBox.mockRejectedValueOnce(new Error("no box"));
      const result = await discoveryService.queryElementState(page, "d1", locateRef);
      expect(result.boundingBox).toBeNull();
    });

    it("preserves complex DOM metadata", async () => {
      locator.evaluate.mockResolvedValueOnce({
        tagName: "input",
        inputType: "checkbox",
        currentValue: "",
        required: true,
        ariaInvalid: true,
        ariaExpanded: true,
        checked: true,
        focusable: true,
        isObscured: true,
      });

      const result = await discoveryService.queryElementState(page, "d1", locateRef);

      expect(result).toMatchObject({
        required: true,
        ariaInvalid: true,
        ariaExpanded: true,
        checked: true,
        isObscured: true,
      });
    });
  });

  describe("dropdown discovery and closing", () => {
    it("discovers options on click", async () => {
      const startSpy = vi.spyOn(discoveryService as any, "startDomObserver");
      const stopSpy = vi
        .spyOn(discoveryService as any, "stopDomObserver")
        .mockResolvedValue({
          addedElements: [{ tagName: "li", role: "option", text: "One", className: "", isError: false }],
          removedElements: [],
          modifiedElements: [],
          urlChanged: false,
          previousUrl: page.url(),
          currentUrl: page.url(),
          observationDurationMs: 12,
        });
      const injectSpy = vi.spyOn(discoveryService as any, "injectIncrementalRefs").mockResolvedValue(undefined);

      const result = await discoveryService.discoverDropdownOptions(page, "menu", undefined, 5000, locateRef);

      expect(startSpy).toHaveBeenCalled();
      expect(locator.click).toHaveBeenCalled();
      expect(page.waitForTimeout).toHaveBeenCalledWith(500);
      expect(injectSpy).toHaveBeenCalled();
      expect(result.dropdownOpen).toBe(true);
      stopSpy.mockRestore();
    });

    it("falls back to ArrowDown when click finds nothing", async () => {
      vi.spyOn(discoveryService as any, "startDomObserver").mockResolvedValue({ observing: true });
      const stopSpy = vi
        .spyOn(discoveryService as any, "stopDomObserver")
        .mockResolvedValueOnce({
          addedElements: [],
          removedElements: [],
          modifiedElements: [],
          urlChanged: false,
          previousUrl: page.url(),
          currentUrl: page.url(),
          observationDurationMs: 1,
        })
        .mockResolvedValueOnce({
          addedElements: [{ tagName: "li", role: "option", text: "Two", className: "", isError: false }],
          removedElements: [],
          modifiedElements: [],
          urlChanged: false,
          previousUrl: page.url(),
          currentUrl: page.url(),
          observationDurationMs: 1,
        });
      vi.spyOn(discoveryService as any, "injectIncrementalRefs").mockResolvedValue(undefined);

      const result = await discoveryService.discoverDropdownOptions(page, "menu", undefined, 5000, locateRef);

      expect(page.keyboard.press).toHaveBeenCalledWith("ArrowDown");
      expect(result.triggerMethod).toBe("arrowdown");
      stopSpy.mockRestore();
    });

    it("falls back to typeahead when configured", async () => {
      vi.spyOn(discoveryService as any, "startDomObserver").mockResolvedValue({ observing: true });
      const stopSpy = vi
        .spyOn(discoveryService as any, "stopDomObserver")
        .mockResolvedValueOnce({
          addedElements: [],
          removedElements: [],
          modifiedElements: [],
          urlChanged: false,
          previousUrl: page.url(),
          currentUrl: page.url(),
          observationDurationMs: 1,
        })
        .mockResolvedValueOnce({
          addedElements: [],
          removedElements: [],
          modifiedElements: [],
          urlChanged: false,
          previousUrl: page.url(),
          currentUrl: page.url(),
          observationDurationMs: 1,
        })
        .mockResolvedValueOnce({
          addedElements: [{ tagName: "li", role: "option", text: "Three", className: "", isError: false }],
          removedElements: [],
          modifiedElements: [],
          urlChanged: false,
          previousUrl: page.url(),
          currentUrl: page.url(),
          observationDurationMs: 1,
        });
      vi.spyOn(discoveryService as any, "injectIncrementalRefs").mockResolvedValue(undefined);

      const result = await discoveryService.discoverDropdownOptions(page, "menu", "thr", 5000, locateRef);

      expect(locator.pressSequentially).toHaveBeenCalledWith("thr", { delay: 50 });
      expect(result.triggerMethod).toBe("typeahead");
      stopSpy.mockRestore();
    });

    it("closes dropdown with escape and blur", async () => {
      await discoveryService.closeDropdown(page, "menu", locateRef);
      expect(page.keyboard.press).toHaveBeenCalledWith("Escape");
      expect(locator.blur).toHaveBeenCalled();
    });

    it("suppresses blur errors while closing dropdown", async () => {
      locator.blur.mockRejectedValueOnce(new Error("no blur"));
      await expect(discoveryService.closeDropdown(page, "menu", locateRef)).resolves.toBeUndefined();
      expect(page.keyboard.press).toHaveBeenCalledWith("Escape");
    });
  });

  describe("blocking element detection and dismissal", () => {
    it("returns null when no blocker is detected", async () => {
      locator.evaluate.mockResolvedValueOnce({ isBlocked: false });
      const result = await discoveryService.detectBlockingElement(page, "target", locateRef);
      expect(result).toEqual({ isBlocked: false });
    });

    it("returns blocker metadata", async () => {
      locator.evaluate.mockResolvedValueOnce({
        isBlocked: true,
        blockerTagName: "div",
        blockerRole: "dialog",
        blockerText: "Cookie banner",
        dismissStrategy: "click_close",
      });
      const result = await discoveryService.detectBlockingElement(page, "target", locateRef);
      expect(result).toMatchObject({
        isBlocked: true,
        blockerRole: "dialog",
        dismissStrategy: "click_close",
      });
    });

    it("dismisses blocker with close button ref", async () => {
      const detectSpy = vi
        .spyOn(discoveryService, "detectBlockingElement")
        .mockResolvedValueOnce({ isBlocked: false });

      const result = await discoveryService.dismissBlocker(
        page,
        "target",
        "click_close",
        "close-btn",
        locateRef,
      );

      expect(result).toEqual({ dismissed: true, strategy: "click_close" });
      expect(locator.click).toHaveBeenCalledWith({ timeout: 3000 });
      detectSpy.mockRestore();
    });

    it("dismisses blocker with escape strategy", async () => {
      const detectSpy = vi
        .spyOn(discoveryService, "detectBlockingElement")
        .mockResolvedValueOnce({ isBlocked: false });

      const result = await discoveryService.dismissBlocker(page, "target", "press_escape", undefined, locateRef);

      expect(result).toEqual({ dismissed: true, strategy: "press_escape" });
      expect(page.keyboard.press).toHaveBeenCalledWith("Escape");
      detectSpy.mockRestore();
    });

    it("dismisses blocker with click outside strategy", async () => {
      const detectSpy = vi
        .spyOn(discoveryService, "detectBlockingElement")
        .mockResolvedValueOnce({ isBlocked: false });

      const result = await discoveryService.dismissBlocker(page, "target", "click_outside", undefined, locateRef);

      expect(result).toEqual({ dismissed: true, strategy: "click_outside" });
      expect(page.mouse.click).toHaveBeenCalledWith(1, 1);
      detectSpy.mockRestore();
    });

    it("returns all_failed when dismissal strategies do not clear blocker", async () => {
      const detectSpy = vi.spyOn(discoveryService, "detectBlockingElement").mockResolvedValue({
        isBlocked: true,
      } as any);

      const result = await discoveryService.dismissBlocker(page, "target", undefined, undefined, locateRef);

      expect(result).toEqual({ dismissed: false, strategy: "all_failed" });
      expect(page.waitForTimeout).toHaveBeenCalledWith(500);
      detectSpy.mockRestore();
    });
  });
});
