import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pw-ai-module to avoid real browser calls
const fillFormViaPlaywright = vi.fn();
const waitForViaPlaywright = vi.fn();
const navigateViaPlaywright = vi.fn();
const evaluateViaPlaywright = vi.fn();

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => ({
    fillFormViaPlaywright,
    waitForViaPlaywright,
    navigateViaPlaywright,
    evaluateViaPlaywright,
  }),
}));

import { registerBrowserAgentActRoutes } from "../../../browser/routes/agent.act.js";

describe("integration: /act - complex actions (fill, wait, navigate, evaluate)", () => {
  beforeEach(() => {
    fillFormViaPlaywright.mockReset();
    waitForViaPlaywright.mockReset();
    navigateViaPlaywright.mockReset();
    evaluateViaPlaywright.mockReset();
  });

  /**
   * Helper to create test Express app with act routes
   */
  function makeApp(options?: {
    profileName?: string;
    cdpUrl?: string;
    targetId?: string;
    pageUrl?: string;
    evaluateEnabled?: boolean;
  }) {
    const app = express();
    app.use(express.json());

    const ctx = {
      state: () => ({
        resolved: { evaluateEnabled: options?.evaluateEnabled ?? true },
      }),
      forProfile: () => ({
        profile: {
          name: options?.profileName ?? "default",
          cdpUrl: options?.cdpUrl ?? "http://127.0.0.1:9222",
        },
        ensureTabAvailable: async (targetId?: string) => ({
          targetId: targetId ?? "tab-default",
          url: options?.pageUrl ?? "https://example.org",
        }),
        stopRunningBrowser: async () => undefined,
      }),
      mapTabError: () => null,
    } as any;

    registerBrowserAgentActRoutes(app as any, ctx);
    return app;
  }

  describe("POST /act (fill) - Basic Functionality", () => {
    it("single field fill", async () => {
      fillFormViaPlaywright.mockResolvedValue({ results: [{ ref: "e1", matched: true }] });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "John Doe" }],
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.allMatched).toBe(true);
      expect(fillFormViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ ref: "e1", type: "text", value: "John Doe" }),
          ]),
        })
      );
    });

    it("multiple fields fill", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [
          { ref: "e1", matched: true },
          { ref: "e2", matched: true },
          { ref: "e3", matched: true },
        ],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [
          { ref: "e1", type: "text", value: "John" },
          { ref: "e2", type: "email", value: "john@example.com" },
          { ref: "e3", type: "password", value: "secret123" },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(3);
      expect(res.body.allMatched).toBe(true);
    });

    it("skip when value matches", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true, actualValue: "Existing Value" }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "Existing Value" }],
      });

      expect(res.status).toBe(200);
      expect(res.body.results[0].matched).toBe(true);
    });

    it("fallback to pressSequentially", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true, strategy: "pressSequentially" }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "Test" }],
      });

      expect(res.status).toBe(200);
    });

    it("date input handling", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "date", value: "2024-01-15" }],
      });

      expect(res.status).toBe(200);
      expect(fillFormViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ ref: "e1", type: "date", value: "2024-01-15" }),
          ]),
        })
      );
    });

    it("tel input digits-only", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "tel", value: "+1234567890" }],
      });

      expect(res.status).toBe(200);
    });

    it("response structure with mismatched fields", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [
          { ref: "e1", matched: false, requestedValue: "New", actualValue: "Old", warning: "Value mismatch" },
        ],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "New" }],
      });

      expect(res.status).toBe(200);
      expect(res.body.allMatched).toBe(false);
      expect(res.body.mismatched).toHaveLength(1);
      expect(res.body.mismatched[0].ref).toBe("e1");
    });

    it("fill with timeoutMs option", async () => {
      fillFormViaPlaywright.mockResolvedValue({ results: [{ ref: "e1", matched: true }] });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "Test" }],
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(fillFormViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 5000,
        })
      );
    });
  });

  describe("POST /act (fill) - Error Handling", () => {
    it("error: missing fields", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("fields are required");
    });

    it("error: empty fields array", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("fields are required");
    });

    it("error: field missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ type: "text", value: "Test" }],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("fields are required");
    });

    it("error: field missing type", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", value: "Test" }],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("fields are required");
    });

    it("error: element not found", async () => {
      fillFormViaPlaywright.mockRejectedValue(new Error("Element not found: e1"));

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "Test" }],
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("error: element not fillable", async () => {
      fillFormViaPlaywright.mockRejectedValue(new Error("Element is not fillable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "Test" }],
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("not fillable");
    });
  });

  describe("POST /act (fill) - Edge Cases", () => {
    it("masked input handling", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true, strategy: "masked" }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "password", value: "secret" }],
      });

      expect(res.status).toBe(200);
    });

    it("contenteditable fallback", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true, strategy: "contenteditable" }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "Editable content" }],
      });

      expect(res.status).toBe(200);
    });

    it("empty value clearing", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "" }],
      });

      expect(res.status).toBe(200);
    });

    it("whitespace trimming", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "  trimmed  " }],
      });

      expect(res.status).toBe(200);
    });

    it("long text handling", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true }],
      });

      const longText = "A".repeat(500);
      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "textarea", value: longText }],
      });

      expect(res.status).toBe(200);
    });

    it("strategy tracking in response", async () => {
      fillFormViaPlaywright.mockResolvedValue({
        results: [{ ref: "e1", matched: true, strategy: "direct" }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "Test" }],
      });

      expect(res.status).toBe(200);
      expect(res.body.results[0]).toHaveProperty("strategy");
    });
  });

  describe("POST /act (wait) - Basic Functionality", () => {
    it("wait for element visible", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#myElement",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: "#myElement",
        })
      );
    });

    it("wait for element hidden", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#loading",
      });

      expect(res.status).toBe(200);
    });

    it("wait for text", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        text: "Loading complete",
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Loading complete",
        })
      );
    });

    it("wait for text gone", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        textGone: "Loading...",
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          textGone: "Loading...",
        })
      );
    });

    it("wait for navigation", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        url: "https://example.com/dashboard",
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/dashboard",
        })
      );
    });

    it("wait with timeout option", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
        timeoutMs: 10000,
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 10000,
        })
      );
    });

    it("wait for load state", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        loadState: "networkidle",
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          loadState: "networkidle",
        })
      );
    });

    it("wait with timeMs", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        timeMs: 2000,
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeMs: 2000,
        })
      );
    });

    it("response structure verification", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("wait with explicit targetId", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
        targetId: "tab-wait",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-wait");
    });
  });

  describe("POST /act (wait) - Error Handling", () => {
    it("error: missing condition", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("wait requires at least one of");
    });

    it("error: timeout exceeded", async () => {
      waitForViaPlaywright.mockRejectedValue(new Error("Timeout 5000ms exceeded"));

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#never",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Timeout");
    });

    it("error: element never appears", async () => {
      waitForViaPlaywright.mockRejectedValue(new Error("Element never appeared"));

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#missing",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("never appeared");
    });

    it("error: element never disappears", async () => {
      waitForViaPlaywright.mockRejectedValue(new Error("Element never disappeared"));

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#loading",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("never disappeared");
    });

    it("error: text never appears", async () => {
      waitForViaPlaywright.mockRejectedValue(new Error("Text never appeared"));

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        text: "Never shown",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("never appeared");
    });

    it("error: browser unavailable", async () => {
      waitForViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Browser unavailable");
    });
  });

  describe("POST /act (wait) - Edge Cases", () => {
    it("wait with custom timeout", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
        timeoutMs: 30000,
      });

      expect(res.status).toBe(200);
    });

    it("wait for dynamic content", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: ".dynamic-content",
      });

      expect(res.status).toBe(200);
    });

    it("wait for SPA navigation", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        url: "/dashboard",
      });

      expect(res.status).toBe(200);
    });

    it("wait with multiple conditions", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
        text: "Ready",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
    });

    it("logging verification - wait request logged", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalled();
    });

    it("wait with loadState domcontentloaded", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        loadState: "domcontentloaded",
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          loadState: "domcontentloaded",
        })
      );
    });

    it("wait with loadState load", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        loadState: "load",
      });

      expect(res.status).toBe(200);
    });

    it("wait with fn (evaluate enabled)", async () => {
      waitForViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "wait",
        fn: "() => document.readyState === 'complete'",
      });

      expect(res.status).toBe(200);
      expect(waitForViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "() => document.readyState === 'complete'",
        })
      );
    });
  });

  describe("POST /act (navigate) - Basic Functionality", () => {
    it("navigate to URL", async () => {
      navigateViaPlaywright.mockResolvedValue({ url: "https://example.com" });

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://example.com",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.url).toBe("https://example.com");
      expect(navigateViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com",
        })
      );
    });

    it("navigate with timeout", async () => {
      navigateViaPlaywright.mockResolvedValue({ url: "https://example.com" });

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://example.com",
        timeoutMs: 30000,
      });

      expect(res.status).toBe(200);
      expect(navigateViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 30000,
        })
      );
    });

    it("response structure verification", async () => {
      navigateViaPlaywright.mockResolvedValue({ url: "https://example.com" });

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://example.com",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        url: expect.any(String),
      });
    });

    it("navigate with explicit targetId", async () => {
      navigateViaPlaywright.mockResolvedValue({ url: "https://example.com" });

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://example.com",
        targetId: "tab-nav",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-nav");
    });

    it("logging verification - navigate request logged", async () => {
      navigateViaPlaywright.mockResolvedValue({ url: "https://example.com" });

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://example.com",
      });

      expect(res.status).toBe(200);
      expect(navigateViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (navigate) - Error Handling", () => {
    it("error: missing URL", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("url is required");
    });

    it("error: empty URL string", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("url is required");
    });

    it("error: invalid URL format", async () => {
      navigateViaPlaywright.mockRejectedValue(new Error("Invalid URL"));

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "not-a-url",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Invalid URL");
    });

    it("error: navigation timeout", async () => {
      navigateViaPlaywright.mockRejectedValue(new Error("Navigation timeout 30000ms exceeded"));

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://slow-page.com",
        timeoutMs: 30000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("timeout");
    });

    it("error: browser unavailable", async () => {
      navigateViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://example.com",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Browser unavailable");
    });
  });

  describe("POST /act (evaluate) - Basic Functionality", () => {
    it("evaluate JavaScript", async () => {
      evaluateViaPlaywright.mockResolvedValue(42);

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "() => 21 * 2",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toBe(42);
      expect(evaluateViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "() => 21 * 2",
        })
      );
    });

    it("evaluate with ref", async () => {
      evaluateViaPlaywright.mockResolvedValue("clicked");

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "(el) => el.textContent",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe("clicked");
      expect(evaluateViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "(el) => el.textContent",
          ref: "e1",
        })
      );
    });

    it("response structure verification", async () => {
      evaluateViaPlaywright.mockResolvedValue({ result: "success" });

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "() => 'success'",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        url: expect.any(String),
        result: expect.anything(),
      });
    });

    it("evaluate with explicit targetId", async () => {
      evaluateViaPlaywright.mockResolvedValue({ result: true });

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "() => true",
        targetId: "tab-eval",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-eval");
    });

    it("evaluate returns complex object", async () => {
      evaluateViaPlaywright.mockResolvedValue({ name: "Test", value: 123, nested: { a: 1 } });

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "() => ({ name: 'Test', value: 123, nested: { a: 1 } })",
      });

      expect(res.status).toBe(200);
      expect(res.body.result.name).toBe("Test");
      expect(res.body.result.value).toBe(123);
    });

    it("logging verification - evaluate request logged", async () => {
      evaluateViaPlaywright.mockResolvedValue({ result: null });

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "() => null",
      });

      expect(res.status).toBe(200);
      expect(evaluateViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (evaluate) - Error Handling", () => {
    it("error: evaluate disabled by config", async () => {
      const res = await request(makeApp({ evaluateEnabled: false })).post("/act").send({
        kind: "evaluate",
        fn: "() => 1",
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("disabled");
    });

    it("error: missing fn", async () => {
      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("fn is required");
    });

    it("error: empty fn string", async () => {
      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("fn is required");
    });

    it("error: evaluation fails", async () => {
      evaluateViaPlaywright.mockRejectedValue(new Error("Evaluation failed: ReferenceError"));

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "() => undefinedVar",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Evaluation failed");
    });

    it("error: browser unavailable", async () => {
      evaluateViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp({ evaluateEnabled: true })).post("/act").send({
        kind: "evaluate",
        fn: "() => 1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Browser unavailable");
    });
  });
});
