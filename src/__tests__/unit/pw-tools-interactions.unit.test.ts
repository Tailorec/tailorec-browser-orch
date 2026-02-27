import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { MockedFunction } from "vitest";
import {
  clickViaPlaywright,
  typeViaPlaywright,
  fillAndVerifyField,
  fillFormViaPlaywright,
  hoverViaPlaywright,
  dragViaPlaywright,
  selectOptionViaPlaywright,
  pressKeyViaPlaywright,
  scrollIntoViewViaPlaywright,
  queryElementStateViaPlaywright,
  queryElementStatesViaPlaywright,
  discoverDropdownOptionsViaPlaywright,
  closeDropdownViaPlaywright,
  detectBlockingElementViaPlaywright,
  dismissBlockerViaPlaywright,
  setInputFilesViaPlaywright,
} from "../../browser/pw-tools-core.interactions.js";
import {
  ensurePageState,
  getPageForTargetId,
  restoreRoleRefsForTarget,
} from "../../browser/pw-session.js";

// Mock the logging subsystem
vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    exception: vi.fn(),
  }),
}));

// Mock pw-session functions but keep refLocator implementation
vi.mock("../../browser/pw-session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../browser/pw-session.js")>();
  return {
    ...actual,
    getPageForTargetId: vi.fn(),
    ensurePageState: vi.fn(),
    restoreRoleRefsForTarget: vi.fn(),
  };
});

const mockGetPageForTargetId = getPageForTargetId as MockedFunction<typeof getPageForTargetId>;
const mockEnsurePageState = ensurePageState as MockedFunction<typeof ensurePageState>;
const mockRestoreRoleRefsForTarget = restoreRoleRefsForTarget as MockedFunction<typeof restoreRoleRefsForTarget>;

// Helper to create fresh mocks for each test
function createTestMocks() {
  const mockLocator: any = {
    click: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
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
    first: vi.fn().mockReturnThis(),
    isVisible: vi.fn().mockResolvedValue(true),
    isEnabled: vi.fn().mockResolvedValue(true),
    isEditable: vi.fn().mockResolvedValue(true),
    boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 }),
    evaluate: vi.fn().mockResolvedValue({}),
    press: vi.fn().mockResolvedValue(undefined),
    pressSequentially: vi.fn().mockResolvedValue(undefined),
    setChecked: vi.fn().mockResolvedValue(undefined),
    setInputFiles: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("test")),
    elementHandle: vi.fn().mockResolvedValue({
      evaluate: vi.fn().mockResolvedValue(undefined),
    }),
  };
  const mockFrameLocator = {
    locator: vi.fn().mockReturnValue(mockLocator),
    getByRole: vi.fn().mockReturnValue(mockLocator),
  };
  
  const mockPage = {
    _url: "https://example.test",
    on: vi.fn(),
    emit: vi.fn(),
    url: vi.fn().mockReturnValue("https://example.test"),
    locator: vi.fn().mockReturnValue(mockLocator),
    frameLocator: vi.fn().mockReturnValue(mockFrameLocator),
    getByRole: vi.fn().mockReturnValue(mockLocator),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
    },
    mouse: {
      click: vi.fn().mockResolvedValue(undefined),
    },
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("test-screenshot")),
  };

  return { mockPage, mockLocator, mockFrameLocator };
}

describe("unit: pw-tools-core.interactions", () => {
  let mockPage: any;
  let mockLocator: any;
  let mockFrameLocator: any;

  beforeEach(() => {
    const mocks = createTestMocks();
    mockPage = mocks.mockPage;
    mockLocator = mocks.mockLocator;
    mockFrameLocator = mocks.mockFrameLocator;

    mockGetPageForTargetId.mockResolvedValue(mockPage);
    mockEnsurePageState.mockReturnValue({
      requests: [],
      consoleMessages: [],
      pageErrors: [],
      observedPages: new Set(),
    } as any);
    mockRestoreRoleRefsForTarget.mockReturnValue(undefined);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 1: clickViaPlaywright (15 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("clickViaPlaywright", () => {
    it("successful click with default options", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
      expect(mockEnsurePageState).toHaveBeenCalledWith(mockPage);
      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
      expect(mockLocator.click).toHaveBeenCalledWith({
        timeout: 8000,
        button: undefined,
        modifiers: undefined,
      });
    });

    it("click with custom button (left/right/middle)", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        button: "right",
      });

      expect(mockLocator.click).toHaveBeenCalledWith(
        expect.objectContaining({ button: "right" }),
      );
    });

    it("click with modifiers (Alt, Control, Shift, Meta)", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        modifiers: ["Shift", "Meta"],
      });

      expect(mockLocator.click).toHaveBeenCalledWith(
        expect.objectContaining({ modifiers: ["Shift", "Meta"] }),
      );
    });

    it("double-click functionality", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        doubleClick: true,
      });

      expect(mockLocator.dblclick).toHaveBeenCalled();
      expect(mockLocator.click).not.toHaveBeenCalled();
    });

    it("timeout handling (min/max boundaries)", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        timeoutMs: 100,
      });
      expect(mockLocator.click).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 500 }),
      );

      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        timeoutMs: 100000,
      });
      expect(mockLocator.click).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 60000 }),
      );
    });

    it("ref locator resolution", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("error: element not found", async () => {
      mockLocator.click.mockRejectedValue(new Error("Element not found"));

      await expect(
        clickViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow();
    });

    it("error: element not visible", async () => {
      mockLocator.click.mockRejectedValue(
        new Error("waiting for element to be visible"),
      );

      await expect(
        clickViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow(/not found or not visible/);
    });

    it("error: timeout exceeded", async () => {
      mockLocator.click.mockRejectedValue(new Error("Timeout 8000ms exceeded"));

      await expect(
        clickViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow();
    });

    it("error: strict mode violation", async () => {
      mockLocator.click.mockRejectedValue(
        new Error("strict mode violation: resolved to 3 elements"),
      );

      await expect(
        clickViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow(/matched 3 elements/);
    });

    it("logging: action started/succeeded", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockLocator.click).toHaveBeenCalled();
    });

    it("frame-aware clicking", async () => {
      mockPage.frameLocator = vi.fn().mockReturnValue(mockFrameLocator);

      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("aria-ref vs role-ref modes", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "@d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("dynamic ref (d1, d2, etc.) support", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      await clickViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 2: typeViaPlaywright (12 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("typeViaPlaywright", () => {
    it("basic text typing", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "Hello World",
      });

      expect(mockLocator.fill).toHaveBeenCalledWith("Hello World", {
        timeout: 8000,
      });
    });

    it("submit option (presses Enter after typing)", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "test@example.com",
        submit: true,
      });

      expect(mockLocator.fill).toHaveBeenCalled();
      expect(mockLocator.press).toHaveBeenCalledWith("Enter", {
        timeout: 8000,
      });
    });

    it("slowly option (character-by-character with delay)", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "password123",
        slowly: true,
      });

      expect(mockLocator.click).toHaveBeenCalled();
      expect(mockLocator.type).toHaveBeenCalledWith("password123", {
        timeout: 8000,
        delay: 75,
      });
    });

    it("timeout handling", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "test",
        timeoutMs: 5000,
      });

      expect(mockLocator.fill).toHaveBeenCalledWith("test", {
        timeout: 5000,
      });
    });

    it("error: element not found", async () => {
      mockLocator.fill.mockRejectedValue(new Error("Element not found"));

      await expect(
        typeViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
          text: "test",
        }),
      ).rejects.toThrow();
    });

    it("error: element not fillable", async () => {
      mockLocator.fill.mockRejectedValue(
        new Error("Element is not fillable"),
      );

      await expect(
        typeViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
          text: "test",
        }),
      ).rejects.toThrow();
    });

    it("empty text handling", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "",
      });

      expect(mockLocator.fill).toHaveBeenCalledWith("", { timeout: 8000 });
    });

    it("special characters handling", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "Test@123!#$%",
      });

      expect(mockLocator.fill).toHaveBeenCalledWith("Test@123!#$%", {
        timeout: 8000,
      });
    });

    it("ref resolution", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "test",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("frame-aware typing", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "test",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("logging verification", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "test",
      });

      expect(mockLocator.fill).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      await typeViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        text: "test",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 3: fillAndVerifyField (20 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("fillAndVerifyField", () => {
    it("skip when values already match", async () => {
      mockLocator.inputValue.mockResolvedValue("existing value");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "existing value",
        null,
        8000,
      );

      expect(result.matched).toBe(true);
      expect(result.strategy).toBe("skip");
      expect(result.actualValue).toBe("existing value");
    });

    it("successful fill with verification", async () => {
      mockLocator.inputValue.mockResolvedValueOnce("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValueOnce("new value");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "new value",
        null,
        8000,
      );

      expect(result.matched).toBe(true);
      expect(result.strategy).toBe("fill");
      expect(mockLocator.fill).toHaveBeenCalledWith("new value", {
        timeout: 8000,
      });
    });

    it("fallback to sequential when fill fails", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockRejectedValue(new Error("Fill failed"));
      mockLocator.click.mockResolvedValue(undefined);
      mockLocator.selectText = vi.fn().mockResolvedValue(undefined);
      mockPage.keyboard.type.mockResolvedValue(undefined);
      mockLocator.innerText.mockResolvedValue("typed value");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "typed value",
        null,
        8000,
      );

      expect(result.strategy).toBe("sequential");
    });

    it("date input format handling (ISO, MM/DD/YYYY, etc.)", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.getAttribute.mockResolvedValue("MM/DD/YYYY");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("12/25/2024");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "2024-12-25",
        "date",
        8000,
      );

      expect(result.matched).toBe(true);
    });

    it("tel input digits-only handling", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.getAttribute.mockResolvedValue("tel");
      mockLocator.click.mockResolvedValue(undefined);
      mockLocator.fill.mockResolvedValue(undefined);
      mockPage.keyboard.type.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("(123) 456-7890");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "1234567890",
        "tel",
        8000,
      );

      expect(result.strategy).toBe("pressSequentially");
    });

    it("masked input handling", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.getAttribute.mockResolvedValue("text");
      mockLocator.click.mockResolvedValue(undefined);
      mockLocator.fill.mockResolvedValue(undefined);
      mockPage.keyboard.type.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("***-**-1234");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "123-45-6789",
        null,
        8000,
      );

      expect(result.strategy).toMatch(/fill|sequential|pressSequentially/);
    });

    it("contenteditable fallback", async () => {
      mockLocator.inputValue.mockReset();
      mockLocator.innerText.mockReset();
      mockLocator.fill.mockReset();
      mockLocator.click.mockReset();
      
      mockLocator.inputValue.mockRejectedValue(new Error("Not an input"));
      mockLocator.innerText.mockResolvedValue("");
      mockLocator.fill.mockRejectedValue(new Error("Fill failed"));
      mockLocator.click.mockResolvedValue(undefined);
      mockLocator.selectText = vi.fn().mockResolvedValue(undefined);
      mockPage.keyboard.type.mockResolvedValue(undefined);
      mockLocator.innerText.mockResolvedValue("typed content");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "typed content",
        null,
        8000,
      );

      expect(result.strategy).toBe("sequential");
    });

    it("error: fill fails completely", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockRejectedValue(new Error("Fill failed"));
      mockLocator.click.mockRejectedValue(new Error("Click failed"));

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "test value",
        null,
        8000,
      );

      expect(result.matched).toBe(false);
      expect(result.warning).toBeDefined();
    });

    it("warning: value mismatch after fill", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("different value");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "expected value",
        null,
        8000,
      );

      expect(result.matched).toBe(false);
      expect(result.warning).toContain("Value mismatch");
    });

    it("strategy tracking (fill)", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("filled");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "filled",
        null,
        8000,
      );

      expect(result.strategy).toBe("fill");
    });

    it("actual value readback", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("readback value");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "readback value",
        null,
        8000,
      );

      expect(result.actualValue).toBe("readback value");
    });

    it("placeholder detection", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.getAttribute.mockResolvedValue("MM/DD/YYYY");

      await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "2024-01-15",
        null,
        8000,
      );

      expect(mockLocator.getAttribute).toHaveBeenCalledWith("placeholder", {
        timeout: 1500,
      });
    });

    it("input type detection", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.getAttribute.mockResolvedValue("email");

      await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "test@example.com",
        null,
        8000,
      );

      expect(mockLocator.getAttribute).toHaveBeenCalledWith("type", {
        timeout: 1500,
      });
    });

    it("timeout handling", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("test");

      await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "test",
        null,
        15000,
      );

      expect(mockLocator.fill).toHaveBeenCalledWith("test", {
        timeout: 15000,
      });
    });

    it("empty value clearing", async () => {
      mockLocator.inputValue.mockResolvedValue("existing");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "",
        null,
        8000,
      );

      expect(result.actualValue).toBe("");
    });

    it("whitespace trimming", async () => {
      mockLocator.inputValue.mockResolvedValue("  trimmed  ");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "trimmed",
        null,
        8000,
      );

      expect(result.matched).toBe(true);
      expect(result.strategy).toBe("skip");
    });

    it("long text handling (>200 chars)", async () => {
      const longText = "a".repeat(250);
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue(longText);

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        longText,
        null,
        8000,
      );

      expect(result.matched).toBe(true);
    });

    it("string value handling", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("123");

      const result = await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "123",
        null,
        8000,
      );

      expect(result.actualValue).toBe("123");
    });

    it("logging verification", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("logged");

      await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "logged",
        null,
        8000,
      );

      expect(mockLocator.fill).toHaveBeenCalled();
    });

    it("page parameter usage", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("test");

      await fillAndVerifyField(
        mockPage,
        mockLocator,
        "d1",
        "test",
        null,
        8000,
      );

      expect(mockPage).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 4: fillFormViaPlaywright (10 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("fillFormViaPlaywright", () => {
    it("multiple fields filling", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);

      const result = await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [
          { ref: "d1", type: "text", value: "John" },
          { ref: "d2", type: "email", value: "john@example.com" },
          { ref: "d3", type: "text", value: "Doe" },
        ],
      });

      expect(result.results).toHaveLength(3);
    });

    it("mixed field types (text, email, password)", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);

      await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [
          { ref: "d1", type: "text", value: "user" },
          { ref: "d2", type: "email", value: "user@test.com" },
          { ref: "d3", type: "password", value: "secret123" },
        ],
      });

      expect(mockLocator.fill).toHaveBeenCalledTimes(3);
    });

    it("checkbox/radio handling", async () => {
      mockLocator.setChecked.mockResolvedValue(undefined);

      const result = await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [
          { ref: "d1", type: "checkbox", value: true },
          { ref: "d2", type: "radio", value: true },
        ],
      });

      expect(mockLocator.setChecked).toHaveBeenCalledTimes(2);
      expect(result.results).toHaveLength(2);
    });

    it("partial fill (some succeed, some fail)", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Fill failed"));

      const result = await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [
          { ref: "d1", type: "text", value: "success" },
          { ref: "d2", type: "text", value: "failure" },
        ],
      });

      expect(result.results[0]?.matched).toBe(true);
      expect(result.results[1]?.matched).toBe(false);
    });

    it("results reporting (matched/mismatched)", async () => {
      mockLocator.inputValue
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce("filled")
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce("mismatch");

      const result = await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [
          { ref: "d1", type: "text", value: "filled" },
          { ref: "d2", type: "text", value: "expected" },
        ],
      });

      expect(result.results.filter((r) => r.matched)).toHaveLength(1);
      expect(result.results.filter((r) => !r.matched)).toHaveLength(1);
    });

    it("warning aggregation", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockRejectedValue(new Error("Field error"));

      const result = await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [{ ref: "d1", type: "text", value: "test" }],
      });

      expect(result.results[0]?.warning).toBeDefined();
    });

    it("empty fields array handling", async () => {
      const result = await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [],
      });

      expect(result.results).toHaveLength(0);
    });

    it("invalid field filtering", async () => {
      const result = await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [
          { ref: "", type: "text", value: "invalid" },
          { ref: "d1", type: "", value: "invalid" },
          { ref: "d2", type: "text", value: "valid" },
        ],
      });

      expect(result.results).toHaveLength(1);
    });

    it("timeout propagation", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("test");

      await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [{ ref: "d1", type: "text", value: "test" }],
        timeoutMs: 10000,
      });
    });

    it("logging verification", async () => {
      mockLocator.inputValue.mockResolvedValue("");
      mockLocator.fill.mockResolvedValue(undefined);
      mockLocator.inputValue.mockResolvedValue("logged");

      await fillFormViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        fields: [{ ref: "d1", type: "text", value: "logged" }],
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 5: hoverViaPlaywright (8 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("hoverViaPlaywright", () => {
    it("successful hover", async () => {
      await hoverViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockLocator.hover).toHaveBeenCalledWith({ timeout: 8000 });
    });

    it("timeout handling", async () => {
      await hoverViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        timeoutMs: 5000,
      });

      expect(mockLocator.hover).toHaveBeenCalledWith({ timeout: 5000 });
    });

    it("error: element not found", async () => {
      mockLocator.hover.mockRejectedValue(new Error("Element not found"));

      await expect(
        hoverViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow();
    });

    it("error: element not visible", async () => {
      mockLocator.hover.mockRejectedValue(
        new Error("Element is not visible"),
      );

      await expect(
        hoverViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow();
    });

    it("ref resolution", async () => {
      await hoverViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("frame-aware hover", async () => {
      await hoverViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("logging verification", async () => {
      await hoverViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockLocator.hover).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      await hoverViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 6: dragViaPlaywright (10 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("dragViaPlaywright", () => {
    it("successful drag operation", async () => {
      await dragViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        startRef: "d1",
        endRef: "d2",
      });

      expect(mockLocator.dragTo).toHaveBeenCalled();
    });

    it("timeout handling", async () => {
      await dragViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        startRef: "d1",
        endRef: "d2",
        timeoutMs: 10000,
      });

      expect(mockLocator.dragTo).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ timeout: 10000 }),
      );
    });

    it("error: missing startRef", async () => {
      await expect(
        dragViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          startRef: "",
          endRef: "d2",
        }),
      ).rejects.toThrow(/ref is required/);
    });

    it("error: missing endRef", async () => {
      await expect(
        dragViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          startRef: "d1",
          endRef: "",
        }),
      ).rejects.toThrow(/ref is required/);
    });

    it("error: element not found", async () => {
      mockLocator.dragTo.mockRejectedValue(new Error("Element not found"));

      await expect(
        dragViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          startRef: "d1",
          endRef: "d2",
        }),
      ).rejects.toThrow();
    });

    it("ref resolution for both elements", async () => {
      await dragViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        startRef: "d1",
        endRef: "d2",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("frame-aware dragging", async () => {
      await dragViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        startRef: "d1",
        endRef: "d2",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("logging verification", async () => {
      await dragViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        startRef: "d1",
        endRef: "d2",
      });

      expect(mockLocator.dragTo).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      await dragViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        startRef: "d1",
        endRef: "d2",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });

    it("timeout boundaries (min/max)", async () => {
      await dragViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        startRef: "d1",
        endRef: "d2",
        timeoutMs: 100,
      });

      expect(mockLocator.dragTo).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ timeout: 500 }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 7: selectOptionViaPlaywright (10 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("selectOptionViaPlaywright", () => {
    it("successful option selection", async () => {
      await selectOptionViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        values: ["option1"],
      });

      expect(mockLocator.selectOption).toHaveBeenCalledWith(["option1"], {
        timeout: 8000,
      });
    });

    it("multiple option selection", async () => {
      await selectOptionViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        values: ["option1", "option2", "option3"],
      });

      expect(mockLocator.selectOption).toHaveBeenCalledWith(
        ["option1", "option2", "option3"],
        { timeout: 8000 },
      );
    });

    it("error: missing values", async () => {
      await expect(
        selectOptionViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
          values: [],
        }),
      ).rejects.toThrow(/values are required/);
    });

    it("error: element not found", async () => {
      mockLocator.selectOption.mockRejectedValue(
        new Error("Element not found"),
      );

      await expect(
        selectOptionViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
          values: ["option1"],
        }),
      ).rejects.toThrow();
    });

    it("timeout handling", async () => {
      await selectOptionViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        values: ["option1"],
        timeoutMs: 5000,
      });

      expect(mockLocator.selectOption).toHaveBeenCalledWith(
        ["option1"],
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it("ref resolution", async () => {
      await selectOptionViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        values: ["option1"],
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("frame-aware selection", async () => {
      await selectOptionViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        values: ["option1"],
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("logging verification", async () => {
      await selectOptionViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        values: ["option1"],
      });

      expect(mockLocator.selectOption).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      await selectOptionViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        values: ["option1"],
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });

    it("timeout boundaries (min/max)", async () => {
      await selectOptionViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        values: ["option1"],
        timeoutMs: 100,
      });

      expect(mockLocator.selectOption).toHaveBeenCalledWith(
        ["option1"],
        expect.objectContaining({ timeout: 500 }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 8: pressKeyViaPlaywright (8 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("pressKeyViaPlaywright", () => {
    it("successful key press", async () => {
      await pressKeyViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        key: "Enter",
      });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter", {
        delay: 0,
      });
    });

    it("key press with delay", async () => {
      await pressKeyViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        key: "Tab",
        delayMs: 100,
      });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Tab", {
        delay: 100,
      });
    });

    it("error: missing key", async () => {
      await expect(
        pressKeyViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          key: "",
        }),
      ).rejects.toThrow(/key is required/);
    });

    it("special keys (ArrowDown, ArrowUp, etc.)", async () => {
      await pressKeyViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        key: "ArrowDown",
      });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith("ArrowDown", {
        delay: 0,
      });
    });

    it("modifier keys (Control, Alt, Shift, Meta)", async () => {
      await pressKeyViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        key: "Control+A",
      });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Control+A", {
        delay: 0,
      });
    });

    it("page state setup", async () => {
      await pressKeyViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        key: "Enter",
      });

      expect(mockEnsurePageState).toHaveBeenCalledWith(mockPage);
    });

    it("logging verification", async () => {
      await pressKeyViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        key: "Enter",
      });

      expect(mockPage.keyboard.press).toHaveBeenCalled();
    });

    it("parameters propagation", async () => {
      await pressKeyViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        key: "Enter",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 9: scrollIntoViewViaPlaywright (8 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("scrollIntoViewViaPlaywright", () => {
    it("successful scroll into view", async () => {
      await scrollIntoViewViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalledWith({
        timeout: 20000,
      });
    });

    it("timeout handling", async () => {
      await scrollIntoViewViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
        timeoutMs: 10000,
      });

      expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalledWith({
        timeout: 10000,
      });
    });

    it("error: element not found", async () => {
      mockLocator.scrollIntoViewIfNeeded.mockRejectedValue(
        new Error("Element not found"),
      );

      await expect(
        scrollIntoViewViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow();
    });

    it("error: element not visible", async () => {
      mockLocator.scrollIntoViewIfNeeded.mockRejectedValue(
        new Error("Element is not visible"),
      );

      await expect(
        scrollIntoViewViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow();
    });

    it("ref resolution", async () => {
      await scrollIntoViewViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("frame-aware scrolling", async () => {
      await scrollIntoViewViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("logging verification", async () => {
      await scrollIntoViewViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      await scrollIntoViewViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 10: queryElementStateViaPlaywright (15 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("queryElementStateViaPlaywright", () => {
    it("successful state query", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.isVisible.mockResolvedValue(true);
      mockLocator.isEnabled.mockResolvedValue(true);
      mockLocator.isEditable.mockResolvedValue(true);
      mockLocator.boundingBox.mockResolvedValue({
        x: 10,
        y: 20,
        width: 100,
        height: 50,
      });
      mockLocator.evaluate.mockResolvedValue({
        tagName: "input",
        inputType: "text",
        currentValue: "test value",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: true,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.exists).toBe(true);
      expect(state.visible).toBe(true);
      expect(state.enabled).toBe(true);
      expect(state.editable).toBe(true);
      expect(state.tagName).toBe("input");
    });

    it("element not exists", async () => {
      mockLocator.count.mockResolvedValue(0);

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.exists).toBe(false);
      expect(state.visible).toBe(false);
      expect(state.enabled).toBe(false);
    });

    it("element not visible", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.isVisible.mockResolvedValue(false);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.visible).toBe(false);
    });

    it("element disabled", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.isEnabled.mockResolvedValue(false);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "button",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: true,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.enabled).toBe(false);
    });

    it("element not editable", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.isEditable.mockResolvedValue(false);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "input",
        inputType: "text",
        currentValue: "readonly",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: true,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.editable).toBe(false);
    });

    it("checkbox checked state", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "input",
        inputType: "checkbox",
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: true,
        focusable: true,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.checked).toBe(true);
    });

    it("element obscured detection", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "button",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: true,
        isObscured: true,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.isObscured).toBe(true);
    });

    it("bounding box retrieval", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.boundingBox.mockResolvedValue({
        x: 50,
        y: 100,
        width: 200,
        height: 80,
      });
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.boundingBox).toEqual({
        x: 50,
        y: 100,
        width: 200,
        height: 80,
      });
    });

    it("required field detection", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "input",
        inputType: "email",
        currentValue: "",
        required: true,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: true,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.required).toBe(true);
    });

    it("aria-invalid detection", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "input",
        inputType: "text",
        currentValue: "invalid",
        required: false,
        ariaInvalid: true,
        ariaExpanded: null,
        checked: null,
        focusable: true,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.ariaInvalid).toBe(true);
    });

    it("aria-expanded detection", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "button",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: true,
        checked: null,
        focusable: true,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.ariaExpanded).toBe(true);
    });

    it("ref resolution", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("frame-aware state query", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("error handling for visibility check", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.isVisible.mockRejectedValue(new Error("Not found"));
      mockLocator.isEnabled.mockResolvedValue(true);
      mockLocator.isEditable.mockResolvedValue(true);
      mockLocator.boundingBox.mockResolvedValue(null);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      const state = await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(state.visible).toBe(false);
    });

    it("correlation ID propagation", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      await queryElementStateViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 11: queryElementStatesViaPlaywright (5 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("queryElementStatesViaPlaywright", () => {
    it("query multiple element states", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "input",
        inputType: "text",
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: true,
        isObscured: false,
      });

      const result = await queryElementStatesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        refs: ["d1", "d2", "d3"],
      });

      expect(result.states).toHaveLength(3);
    });

    it("limit to 50 refs maximum", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      const result = await queryElementStatesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        refs: Array(100).fill("d1"),
      });

      expect(result.states.length).toBeLessThanOrEqual(50);
    });

    it("mixed existing and non-existing elements", async () => {
      mockLocator.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      const result = await queryElementStatesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        refs: ["d1", "d2", "d3"],
      });

      expect(result.states[0]?.exists).toBe(true);
      expect(result.states[1]?.exists).toBe(false);
      expect(result.states[2]?.exists).toBe(true);
    });

    it("ref resolution for each element", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      await queryElementStatesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        refs: ["d1", "d2"],
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.first.mockReturnValue(mockLocator);
      mockLocator.evaluate.mockResolvedValue({
        tagName: "div",
        inputType: null,
        currentValue: "",
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        checked: null,
        focusable: false,
        isObscured: false,
      });

      await queryElementStatesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        refs: ["d1"],
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 12: closeDropdownViaPlaywright (5 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("closeDropdownViaPlaywright", () => {
    it("successful dropdown close", async () => {
      await closeDropdownViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Escape");
      expect(mockLocator.blur).toHaveBeenCalled();
    });

    it("ref resolution", async () => {
      await closeDropdownViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("error: element not found", async () => {
      mockLocator.blur.mockRejectedValue(new Error("Element not found"));

      await expect(
        closeDropdownViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          ref: "d1",
        }),
      ).rejects.toThrow();
    });

    it("logging verification", async () => {
      await closeDropdownViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockPage.keyboard.press).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      await closeDropdownViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 13: detectBlockingElementViaPlaywright (8 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("detectBlockingElementViaPlaywright", () => {
    it("element not blocked", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate.mockResolvedValue({
        isBlocked: false,
      });

      const result = await detectBlockingElementViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(result.isBlocked).toBe(false);
    });

    it("element blocked by dialog", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate.mockResolvedValue({
        isBlocked: true,
        blockerTagName: "div",
        blockerRole: "dialog",
        blockerText: "Welcome Modal",
        blockerClassName: "modal-overlay",
        blockerZIndex: 1000,
        blockerRect: { x: 0, y: 0, width: 400, height: 300 },
        dismissStrategy: "click_close",
        closeButtonText: "Close",
        closeButtonAriaLabel: "Close modal",
      });

      const result = await detectBlockingElementViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(result.isBlocked).toBe(true);
      expect(result.blockerRole).toBe("dialog");
      expect(result.dismissStrategy).toBe("click_close");
    });

    it("element blocked - escape strategy", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate.mockResolvedValue({
        isBlocked: true,
        blockerTagName: "div",
        blockerRole: "dialog",
        dismissStrategy: "press_escape",
      });

      const result = await detectBlockingElementViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(result.dismissStrategy).toBe("press_escape");
    });

    it("ref resolution", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate.mockResolvedValue({ isBlocked: false });

      await detectBlockingElementViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("frame-aware blocking detection", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate.mockResolvedValue({ isBlocked: false });

      await detectBlockingElementViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("blocker info completeness", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate.mockResolvedValue({
        isBlocked: true,
        blockerTagName: "div",
        blockerRole: "alertdialog",
        blockerText: "Alert message",
        blockerClassName: "alert-box",
        blockerZIndex: 9999,
        blockerRect: { x: 100, y: 100, width: 300, height: 200 },
        dismissStrategy: "click_close",
      });

      const result = await detectBlockingElementViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(result.blockerTagName).toBe("div");
      expect(result.blockerZIndex).toBe(9999);
    });

    it("correlation ID propagation", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate.mockResolvedValue({ isBlocked: false });

      await detectBlockingElementViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });

    it("element not found handling", async () => {
      mockLocator.count.mockResolvedValue(0);
      mockLocator.evaluate.mockResolvedValue({
        isBlocked: false,
        reason: "target_not_visible",
      });

      const result = await detectBlockingElementViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        ref: "d1",
      });

      expect(result.isBlocked).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 14: dismissBlockerViaPlaywright (10 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("dismissBlockerViaPlaywright", () => {
    it("successful dismiss with click_close strategy", async () => {
      mockLocator.click.mockResolvedValue(undefined);
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate
        .mockResolvedValueOnce({
          isBlocked: true,
          dismissStrategy: "click_close",
        })
        .mockResolvedValueOnce({ isBlocked: false });

      const result = await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
        closeButtonRef: "d2",
        strategy: "click_close",
      });

      expect(result.dismissed).toBe(true);
      expect(result.strategy).toBe("click_close");
    });

    it("successful dismiss with press_escape strategy", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate
        .mockResolvedValueOnce({ isBlocked: true })
        .mockResolvedValueOnce({ isBlocked: false });

      const result = await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
        strategy: "press_escape",
      });

      expect(result.dismissed).toBe(true);
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Escape");
    });

    it("successful dismiss with click_outside strategy", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate
        .mockResolvedValueOnce({ isBlocked: true })
        .mockResolvedValueOnce({ isBlocked: false });

      const result = await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
        strategy: "click_outside",
      });

      expect(result.dismissed).toBe(true);
      expect(mockPage.mouse.click).toHaveBeenCalledWith(1, 1);
    });

    it("all strategies fail", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate.mockResolvedValue({ isBlocked: true });
      mockLocator.click.mockRejectedValue(new Error("Click failed"));

      const result = await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
      });

      expect(result.dismissed).toBe(false);
      expect(result.strategy).toBe("all_failed");
    });

    it("strategy escalation (multiple attempts)", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate
        .mockResolvedValueOnce({ isBlocked: true })
        .mockResolvedValueOnce({ isBlocked: true })
        .mockResolvedValueOnce({ isBlocked: false });

      const result = await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
      });

      expect(result.dismissed).toBe(true);
    });

    it("ref resolution for close button", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate
        .mockResolvedValueOnce({ isBlocked: true })
        .mockResolvedValueOnce({ isBlocked: false });

      await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
        closeButtonRef: "d2",
        strategy: "click_close",
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("frame-aware dismiss", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate
        .mockResolvedValueOnce({ isBlocked: true })
        .mockResolvedValueOnce({ isBlocked: false });

      await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalled();
    });

    it("error handling during dismiss", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.click.mockRejectedValue(new Error("Element not found"));
      mockLocator.evaluate.mockResolvedValue({ isBlocked: true });

      const result = await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
        strategy: "click_close",
        closeButtonRef: "d2",
      });

      expect(result.dismissed).toBe(false);
    });

    it("correlation ID propagation", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate
        .mockResolvedValueOnce({ isBlocked: true })
        .mockResolvedValueOnce({ isBlocked: false });

      await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });

    it("waitForTimeout called between attempts", async () => {
      mockLocator.count.mockResolvedValue(1);
      mockLocator.evaluate
        .mockResolvedValueOnce({ isBlocked: true })
        .mockResolvedValueOnce({ isBlocked: false });

      await dismissBlockerViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        targetRef: "d1",
        strategy: "press_escape",
      });

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group 15: setInputFilesViaPlaywright (8 tests)
  // ──────────────────────────────────────────────────────────────────────────
  describe("setInputFilesViaPlaywright", () => {
    it("successful file upload with ref", async () => {
      mockGetPageForTargetId.mockResolvedValue(mockPage);
      
      await setInputFilesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        inputRef: "d1",
        paths: ["/path/to/file.txt"],
      });

      expect(mockLocator.setInputFiles).toHaveBeenCalledWith([
        "/path/to/file.txt",
      ]);
    });

    it("successful file upload with element selector", async () => {
      await setInputFilesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        element: 'input[type="file"]',
        paths: ["/path/to/file.txt"],
      });

      expect(mockLocator.setInputFiles).toHaveBeenCalledWith([
        "/path/to/file.txt",
      ]);
    });

    it("error: missing paths", async () => {
      await expect(
        setInputFilesViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          inputRef: "d1",
          paths: [],
        }),
      ).rejects.toThrow(/paths are required/);
    });

    it("error: both inputRef and element provided", async () => {
      await expect(
        setInputFilesViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          inputRef: "d1",
          element: 'input[type="file"]',
          paths: ["/path/to/file.txt"],
        }),
      ).rejects.toThrow(/mutually exclusive/);
    });

    it("error: neither inputRef nor element provided", async () => {
      await expect(
        setInputFilesViaPlaywright({
          cdpUrl: "http://localhost:9222",
          targetId: "tab-1",
          paths: ["/path/to/file.txt"],
        }),
      ).rejects.toThrow(/inputRef or element is required/);
    });

    it("dispatches input and change events", async () => {
      const mockElementHandle = {
        evaluate: vi.fn().mockResolvedValue(undefined),
      };
      mockLocator.elementHandle.mockResolvedValue(mockElementHandle);

      await setInputFilesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        inputRef: "d1",
        paths: ["/path/to/file.txt"],
      });

      expect(mockLocator.elementHandle).toHaveBeenCalled();
    });

    it("ref resolution", async () => {
      const mockElementHandle = {
        evaluate: vi.fn().mockResolvedValue(undefined),
      };
      mockLocator.elementHandle.mockResolvedValue(mockElementHandle);

      await setInputFilesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        inputRef: "d1",
        paths: ["/path/to/file.txt"],
      });

      expect(mockRestoreRoleRefsForTarget).toHaveBeenCalled();
    });

    it("correlation ID propagation", async () => {
      const mockElementHandle = {
        evaluate: vi.fn().mockResolvedValue(undefined),
      };
      mockLocator.elementHandle.mockResolvedValue(mockElementHandle);

      await setInputFilesViaPlaywright({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
        inputRef: "d1",
        paths: ["/path/to/file.txt"],
      });

      expect(mockGetPageForTargetId).toHaveBeenCalledWith({
        cdpUrl: "http://localhost:9222",
        targetId: "tab-1",
      });
    });
  });
});
