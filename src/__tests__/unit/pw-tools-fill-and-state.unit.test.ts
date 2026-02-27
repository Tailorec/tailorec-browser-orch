import { describe, expect, it } from "vitest";
import { type ElementState, type FillResult, fillAndVerifyField } from "../../browser/pw-tools-core.interactions.js";

function createMockLocator(initialValue: string) {
  let currentValue = initialValue;
  const calls: string[] = [];
  const attributes: Record<string, string> = {};

  const locator = {
    inputValue: async () => {
      calls.push("inputValue");
      return currentValue;
    },
    innerText: async () => {
      calls.push("innerText");
      return currentValue;
    },
    fill: async (val: string) => {
      calls.push(`fill(${val})`);
      currentValue = val;
    },
    pressSequentially: async (val: string) => {
      calls.push(`pressSequentially(${val})`);
      currentValue = val;
    },
    click: async () => {
      calls.push("click");
    },
    getAttribute: async (name: string) => {
      calls.push(`getAttribute(${name})`);
      return attributes[name] || null;
    },
    selectText: async () => {
      calls.push("selectText");
    },
    _setAttributes: (attrs: Record<string, string>) => {
      Object.assign(attributes, attrs);
    },
    _getCalls: () => calls,
  };

  return locator;
}

describe("unit: pw tools fill and state", () => {
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

  it("fillAndVerifyField: skips when values already match", async () => {
    const locator = createMockLocator("hello");
    const mockPage = { keyboard: { type: async (_: string) => undefined } } as any;

    const result = await fillAndVerifyField(mockPage, locator as any, "ref1", "hello", "text", 1000);

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("skip");
    expect(locator._getCalls()).toEqual(["inputValue"]);
  });

  it("fillAndVerifyField: uses fill strategy when first fill works", async () => {
    const locator = createMockLocator("old");
    const mockPage = { keyboard: { type: async (_: string) => undefined } } as any;

    const result = await fillAndVerifyField(mockPage, locator as any, "ref1", "new", "text", 1000);

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("fill");
    expect(locator._getCalls()).toContain("fill(new)");
  });

  it("fillAndVerifyField: fallback to pressSequentially when fill fails to stick", async () => {
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
      fill: async (val: string) => {
        if (val === "new") fillCount = 1;
      },
      pressSequentially: async (_val: string) => {
        fillCount = 3;
      },
      getAttribute: async () => null,
      click: async () => undefined,
      selectText: async () => undefined,
    };
    const mockPage = { keyboard: { type: async (_: string) => undefined } } as any;

    const result = await fillAndVerifyField(mockPage, locator as any, "ref1", "new", "text", 1000);

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("pressSequentially");
  });

  it("fillAndVerifyField: special date handling for native date inputs", async () => {
    const locator = createMockLocator("");
    locator._setAttributes({ type: "date" });
    const mockPage = { keyboard: { type: async (_: string) => undefined } } as any;

    const result = await fillAndVerifyField(mockPage, locator as any, "ref1", "2024-01-15", "date", 1000);

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("fill");
    expect(locator._getCalls()).toContain("fill(2024-01-15)");
  });

  it("fillAndVerifyField: special tel handling for masked inputs", async () => {
    let typedText = "";
    const locator = createMockLocator("");
    locator._setAttributes({ type: "tel", placeholder: "(###) ###-####" });

    const customPage = {
      keyboard: {
        type: async (text: string) => {
          typedText = text;
          await (locator as any).fill("(123) 456-7890");
        },
      },
    } as any;

    const result = await fillAndVerifyField(
      customPage,
      locator as any,
      "ref1",
      "123-456-7890",
      "tel",
      1000,
    );

    expect(result.matched).toBe(true);
    expect(result.strategy).toBe("pressSequentially");
    expect(typedText).toBe("1234567890");
  });
});
