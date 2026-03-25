import { describe, expect, it, vi } from "vitest";
import {
  type ElementState,
  type FillResult,
  PlaywrightInteractionsAdapter,
} from "../../adapters/playwright/playwright.interactions.adapter.js";
import { createMockLocator } from "../helpers/pw-fill-fixtures.js";

function createPage(locator: ReturnType<typeof createMockLocator>) {
  return {
    locator: vi.fn(() => locator),
    keyboard: {
      type: vi.fn(async (_text: string) => undefined),
    },
  } as any;
}

describe("unit: pw tools fill and state", () => {
  const adapter = new PlaywrightInteractionsAdapter();

  it("ElementState structure is correct", () => {
    const expectedState: ElementState = {
      ref: "e1",
      exists: true,
      visible: true,
      enabled: true,
      editable: true,
      focusable: true,
      checked: null,
      tagName: "input",
      inputType: "text",
      currentValue: "hello",
      required: true,
      ariaInvalid: false,
      ariaExpanded: null,
      boundingBox: { x: 10, y: 10, width: 100, height: 100 },
      isObscured: false,
    };

    expect(expectedState.ref).toBe("e1");
    expect(expectedState.visible).toBe(true);
    expect(expectedState.enabled).toBe(true);
    expect(expectedState.tagName).toBe("input");
  });

  it("FillResult structure is correct", () => {
    const result: FillResult = {
      ref: "e1",
      requestedValue: "test",
      actualValue: "test",
      matched: true,
      strategy: "fill",
    };

    expect(result.ref).toBe("e1");
    expect(result.matched).toBe(true);
  });

  it("fill: skips when values already match", async () => {
    const locator = createMockLocator("hello");
    const page = createPage(locator);

    const result = await adapter.fill(page, "ref1", {
      value: "hello",
      type: "text",
      timeoutMs: 1000,
    });

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("skip");
    expect(locator._getCalls()).toEqual(["inputValue"]);
  });

  it("fill: uses fill strategy when first fill works", async () => {
    const locator = createMockLocator("old");
    const page = createPage(locator);

    const result = await adapter.fill(page, "ref1", {
      value: "new",
      type: "text",
      timeoutMs: 1000,
    });

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("fill");
    expect(locator._getCalls()).toContain("fill(new)");
  });

  it("fill: falls back to pressSequentially when fill fails to stick", async () => {
    let fillCount = 0;
    const locator = {
      inputValue: async () => {
        if (fillCount === 0) return "empty";
        if (fillCount === 1) {
          fillCount++;
          return "empty";
        }
        return "new";
      },
      innerText: async () => "",
      fill: async (val: string) => {
        if (val === "new") fillCount = 1;
        if (val === "") fillCount = 2;
      },
      pressSequentially: async (_val: string) => {
        fillCount = 3;
      },
    };
    const page = { locator: vi.fn(() => locator) } as any;

    const result = await adapter.fill(page, "ref1", {
      value: "new",
      type: "text",
      timeoutMs: 1000,
    });

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("pressSequentially");
  });

  it("fill: handles native date inputs through current adapter flow", async () => {
    const locator = createMockLocator("");
    const page = createPage(locator);

    const result = await adapter.fill(page, "ref1", {
      value: "2024-01-15",
      type: "date",
      timeoutMs: 1000,
    });

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("fill");
    expect(locator._getCalls()).toContain("fill(2024-01-15)");
  });

  it("fill: returns a warning when masked/tel-style input still mismatches", async () => {
    const locator = {
      inputValue: vi
        .fn()
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce("(123) 456-7890")
        .mockResolvedValueOnce("(123) 456-7890"),
      innerText: vi.fn().mockResolvedValue(""),
      fill: vi.fn(async (_val: string) => undefined),
      pressSequentially: vi.fn(async (_val: string) => undefined),
    };
    const page = { locator: vi.fn(() => locator) } as any;

    const result = await adapter.fill(page, "ref1", {
      value: "1234567890",
      type: "phone",
      timeoutMs: 1000,
    });

    expect(result.matched).toBe(false);
    expect(result.strategy).toBe("pressSequentially");
    expect(result.warning).toContain("Value mismatch");
  });
});
