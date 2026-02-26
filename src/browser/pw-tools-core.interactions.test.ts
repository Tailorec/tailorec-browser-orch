import assert from "node:assert/strict";
import test from "node:test";
import { fillAndVerifyField } from "./pw-tools-core.interactions.js";

// Mocking helper
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

const mockPage = {
  keyboard: {
    type: async (text: string) => {
      // Mocking keyboard type is harder because it's on page, not locator
    },
  },
} as any;

test("fillAndVerifyField: skips when values already match", async () => {
  const locator = createMockLocator("hello");
  const result = await fillAndVerifyField(
    mockPage,
    locator as any,
    "ref1",
    "hello",
    "text",
    1000,
  );

  assert.equal(result.matched, true);
  assert.equal(result.strategy, "skip");
  assert.deepEqual(locator._getCalls(), ["inputValue"]);
});

test("fillAndVerifyField: uses fill strategy when first fill works", async () => {
  const locator = createMockLocator("old");
  const result = await fillAndVerifyField(
    mockPage,
    locator as any,
    "ref1",
    "new",
    "text",
    1000,
  );

  assert.equal(result.matched, true);
  assert.equal(result.strategy, "fill");
  assert.ok(locator._getCalls().includes("fill(new)"));
});

test("fillAndVerifyField: fallback to pressSequentially when fill fails to stick", async () => {
  let fillCount = 0;
  const locator = {
    inputValue: async () => {
      // Step 0: Initial read
      if (fillCount === 0) {
        return "empty";
      }
      // Step 2: Read back after fill
      if (fillCount === 1) {
        fillCount++;
        return "empty"; // still empty, fill didn't stick
      }
      // After pressSequentially
      return "new";
    },
    fill: async (val: string) => {
      if (val === "new") fillCount = 1;
      if (val === "") { /* clear */ }
    },
    pressSequentially: async (val: string) => {
      fillCount = 3;
    },
    getAttribute: async () => null,
    _getCalls: () => [],
    click: async () => {},
    selectText: async () => {},
  };

  const result = await fillAndVerifyField(
    mockPage,
    locator as any,
    "ref1",
    "new",
    "text",
    1000,
  );

  assert.equal(result.matched, true);
  assert.equal(result.strategy, "pressSequentially");
});

test("fillAndVerifyField: special date handling for native date inputs", async () => {
  const locator = createMockLocator("");
  locator._setAttributes({ type: "date" });
  
  const result = await fillAndVerifyField(
    mockPage,
    locator as any,
    "ref1",
    "2024-01-15",
    "date",
    1000,
  );

  assert.equal(result.matched, true);
  assert.equal(result.strategy, "fill");
  assert.ok(locator._getCalls().includes("fill(2024-01-15)"));
});

test("fillAndVerifyField: special tel handling for masked inputs", async () => {
  let typedText = "";
  const locator = createMockLocator("");
  locator._setAttributes({ type: "tel", placeholder: "(###) ###-####" });
  
  // Mock page keyboard for this test
  const customPage = {
    keyboard: {
      type: async (text: string) => {
        typedText = text;
        // Simulate mask behavior: digits-only input becomes formatted
        await locator.fill("(123) 456-7890"); 
      }
    }
  } as any;

  const result = await fillAndVerifyField(
    customPage,
    locator as any,
    "ref1",
    "123-456-7890",
    "tel",
    1000,
  );

  assert.equal(result.matched, true);
  assert.equal(result.strategy, "pressSequentially");
  assert.equal(typedText, "1234567890"); // Should have typed only digits
});
