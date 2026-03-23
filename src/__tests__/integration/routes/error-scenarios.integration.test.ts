import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all pw-ai-module functions
const mockFunctions: Record<string, any> = {};
const functionNames = [
  "clickViaPlaywright",
  "typeViaPlaywright",
  "pressKeyViaPlaywright",
  "hoverViaPlaywright",
  "scrollIntoViewViaPlaywright",
  "dragViaPlaywright",
  "selectOptionViaPlaywright",
  "fillFormViaPlaywright",
  "waitForViaPlaywright",
  "evaluateViaPlaywright",
  "navigateViaPlaywright",
  "closePageViaPlaywright",
  "discoverDropdownOptionsViaPlaywright",
  "closeDropdownViaPlaywright",
  "queryElementStateViaPlaywright",
  "queryElementStatesViaPlaywright",
  "detectBlockingElementViaPlaywright",
  "dismissBlockerViaPlaywright",
  "armFileUploadViaPlaywright",
  "setInputFilesViaPlaywright",
  "armDialogViaPlaywright",
  "takeScreenshotViaPlaywright",
  "screenshotWithLabelsViaPlaywright",
  "snapshotAiViaPlaywright",
  "snapshotDeltaViaPlaywright",
];

functionNames.forEach((name) => {
  mockFunctions[name] = vi.fn();
});

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => mockFunctions,
}));

import { registerBrowserAgentActRoutes } from "../../../browser/routes/agent.act.js";
import { registerBrowserAgentSnapshotRoutes } from "../../../browser/routes/agent.snapshot.js";

describe("integration: error scenarios", () => {
  beforeEach(() => {
    functionNames.forEach((name) => {
      mockFunctions[name].mockReset();
    });
  });

  /**
   * Helper to create test Express app with all routes
   */
  function makeApp(options?: {
    evaluateEnabled?: boolean;
    profileExists?: boolean;
  }) {
    const app = express();
    app.use(express.json());

    const profileExists = options?.profileExists ?? true;

    const ctx = {
      state: () => ({
        resolved: { evaluateEnabled: options?.evaluateEnabled ?? true },
      }),
      forProfile: (name: string) => {
        if (!profileExists) {
          throw new Error(`Profile ${name} not found`);
        }
        return {
          profile: {
            name,
            cdpUrl: "http://127.0.0.1:9222",
          },
          ensureTabAvailable: async (targetId?: string) => ({
            targetId: targetId ?? "tab-default",
            url: "https://example.org",
          }),
          stopRunningBrowser: async () => undefined,
        };
      },
      mapTabError: () => null,
    } as any;

    registerBrowserAgentActRoutes(app as any, ctx);
    registerBrowserAgentSnapshotRoutes(app as any, ctx);
    return app;
  }

  describe("Browser unavailable scenarios", () => {
    it("/snapshot when browser unavailable", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Browser unavailable");
    });

    it("/act click when browser unavailable", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("/act type when browser unavailable", async () => {
      mockFunctions.typeViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "test",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("/screenshot when browser unavailable", async () => {
      mockFunctions.takeScreenshotViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/screenshot").send({
        fullPage: true,
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("/hooks/file-chooser when browser unavailable", async () => {
      mockFunctions.armFileUploadViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/hooks/file-chooser").send({
        paths: ["/file.txt"],
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("/hooks/dialog when browser unavailable", async () => {
      mockFunctions.armDialogViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/hooks/dialog").send({
        accept: true,
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("/act wait when browser unavailable", async () => {
      mockFunctions.waitForViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("/act navigate when browser unavailable", async () => {
      mockFunctions.navigateViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://example.com",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("/act fill when browser unavailable", async () => {
      mockFunctions.fillFormViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "test" }],
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("/act evaluate when browser unavailable", async () => {
      mockFunctions.evaluateViaPlaywright.mockRejectedValue(
        new Error("Browser unavailable")
      );

      const res = await request(makeApp({ evaluateEnabled: true }))
        .post("/act")
        .send({
          kind: "evaluate",
          fn: "() => 1",
        });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });
  });

  describe("Element not found scenarios", () => {
    it("/act click with invalid ref", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Element not found: invalid-ref")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "invalid-ref",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("/act type with invalid ref", async () => {
      mockFunctions.typeViaPlaywright.mockRejectedValue(
        new Error("Element not found")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "invalid",
        text: "test",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("/act fill with invalid ref", async () => {
      mockFunctions.fillFormViaPlaywright.mockRejectedValue(
        new Error("Element not found")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
        fields: [{ ref: "invalid", type: "text", value: "test" }],
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("/screenshot with invalid ref", async () => {
      mockFunctions.takeScreenshotViaPlaywright.mockRejectedValue(
        new Error("Element not found")
      );

      const res = await request(makeApp()).post("/screenshot").send({
        ref: "invalid",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("/act wait for non-existent element", async () => {
      mockFunctions.waitForViaPlaywright.mockRejectedValue(
        new Error("Element never appeared")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#non-existent",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("never appeared");
    });

    it("/act query_state for missing element", async () => {
      mockFunctions.queryElementStateViaPlaywright.mockRejectedValue(
        new Error("Element not found")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "missing",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("/act discover_dropdown on missing element", async () => {
      mockFunctions.discoverDropdownOptionsViaPlaywright.mockRejectedValue(
        new Error("Element not found")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "missing",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("/act hover on missing element", async () => {
      mockFunctions.hoverViaPlaywright.mockRejectedValue(
        new Error("Element not found")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
        ref: "missing",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("/act drag with missing startRef", async () => {
      mockFunctions.dragViaPlaywright.mockRejectedValue(
        new Error("Element not found")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        startRef: "missing",
        endRef: "e2",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("/act select on missing element", async () => {
      mockFunctions.selectOptionViaPlaywright.mockRejectedValue(
        new Error("Element not found")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "missing",
        values: ["option1"],
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });
  });

  describe("Timeout scenarios", () => {
    it("/act click timeout", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Timeout 5000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Timeout");
    });

    it("/act type timeout", async () => {
      mockFunctions.typeViaPlaywright.mockRejectedValue(
        new Error("Timeout 5000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "test",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Timeout");
    });

    it("/act wait timeout", async () => {
      mockFunctions.waitForViaPlaywright.mockRejectedValue(
        new Error("Timeout 10000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        selector: "#element",
        timeoutMs: 10000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Timeout");
    });

    it("/hooks/file-chooser timeout", async () => {
      mockFunctions.armFileUploadViaPlaywright.mockRejectedValue(
        new Error("Timeout 10000ms exceeded")
      );

      const res = await request(makeApp()).post("/hooks/file-chooser").send({
        paths: ["/file.txt"],
        timeoutMs: 10000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Timeout");
    });

    it("/hooks/dialog timeout", async () => {
      mockFunctions.armDialogViaPlaywright.mockRejectedValue(
        new Error("Timeout 10000ms exceeded")
      );

      const res = await request(makeApp()).post("/hooks/dialog").send({
        accept: true,
        timeoutMs: 10000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Timeout");
    });

    it("/screenshot timeout", async () => {
      mockFunctions.takeScreenshotViaPlaywright.mockRejectedValue(
        new Error("Timeout exceeded")
      );

      const res = await request(makeApp()).post("/screenshot").send({
        fullPage: true,
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Timeout");
    });

    it("/act navigate timeout", async () => {
      mockFunctions.navigateViaPlaywright.mockRejectedValue(
        new Error("Navigation timeout 30000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
        url: "https://slow.com",
        timeoutMs: 30000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("timeout");
    });

    it("/act wait loadState timeout", async () => {
      mockFunctions.waitForViaPlaywright.mockRejectedValue(
        new Error("waitForLoadState: networkidle Timeout 5000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        loadState: "networkidle",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(408);
      expect(res.body.error).toContain("timed out");
      expect(res.body.code).toBe("WAIT_LOAD_STATE_TIMEOUT");
    });

    it("custom timeout values respected", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Timeout 1000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        timeoutMs: 1000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("1000ms");
    });

    it("timeout error format includes details", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Timeout 5000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe("Validation error scenarios", () => {
    it("missing required kind field", async () => {
      const res = await request(makeApp()).post("/act").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("kind is required");
    });

    it("invalid kind value", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "invalid-action",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("kind is required");
    });

    it("missing ref for click", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("missing text for type", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("text is required");
    });

    it("missing key for press", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "press",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("key is required");
    });

    it("missing url for navigate", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "navigate",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("url is required");
    });

    it("missing fn for evaluate", async () => {
      const res = await request(makeApp({ evaluateEnabled: true }))
        .post("/act")
        .send({
          kind: "evaluate",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("fn is required");
    });

    it("missing fields for fill", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "fill",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("fields are required");
    });

    it("missing paths for file-chooser", async () => {
      const res = await request(makeApp()).post("/hooks/file-chooser").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("paths are required");
    });

    it("missing accept for dialog", async () => {
      const res = await request(makeApp()).post("/hooks/dialog").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("accept is required");
    });

    it("invalid button value for click", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        button: "invalid",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("button must be left|right|middle");
    });

    it("invalid modifiers for click", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["InvalidModifier"],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("modifiers must be");
    });

    it("invalid screenshot format", async () => {
      const res = await request(makeApp()).post("/screenshot").send({
        type: "gif",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("png");
    });

    it("ref and element mutually exclusive for screenshot", async () => {
      const res = await request(makeApp()).post("/screenshot").send({
        ref: "e1",
        element: "#selector",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("mutually exclusive");
    });

    it("empty request body", async () => {
      const res = await request(makeApp()).post("/act").send({});

      expect(res.status).toBe(400);
    });

    it("selector usage for non-wait actions", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        selector: "#element",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("selector");
    });

    it("invalid timeoutMs value (negative)", async () => {
      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        timeoutMs: -100,
      });

      // Should still work as toNumber handles negative values
      expect(res.status).toBe(200);
    });

    it("invalid quality value for screenshot", async () => {
      mockFunctions.takeScreenshotViaPlaywright.mockRejectedValue(
        new Error("Invalid quality")
      );

      const res = await request(makeApp()).post("/screenshot").send({
        quality: 150,
      });

      expect(res.status).toBe(500);
    });

    it("missing startRef for drag", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        endRef: "e2",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("startRef and endRef are required");
    });

    it("missing values for select", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref and values are required");
    });
  });

  describe("Configuration error scenarios", () => {
    it("evaluate disabled by config", async () => {
      const res = await request(makeApp({ evaluateEnabled: false }))
        .post("/act")
        .send({
          kind: "evaluate",
          fn: "() => 1",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("disabled");
    });

    it("evaluate disabled error includes docs link", async () => {
      const res = await request(makeApp({ evaluateEnabled: false }))
        .post("/act")
        .send({
          kind: "evaluate",
          fn: "() => 1",
        });

      expect(res.body.error).toContain("Docs:");
    });

    it("profile not found", async () => {
      const app = makeApp({ profileExists: false });

      const res = await request(app).post("/snapshot").send({});

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Profile");
    });

    it("wait fn disabled when evaluateEnabled false", async () => {
      mockFunctions.waitForViaPlaywright.mockRejectedValue(
        new Error("fn is disabled")
      );

      const res = await request(makeApp({ evaluateEnabled: false }))
        .post("/act")
        .send({
          kind: "wait",
          fn: "() => true",
        });

      // The route should reject fn when evaluate is disabled
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("disabled");
    });

    it("unsupported act kind", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "unsupported-kind",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("kind is required");
    });
  });

  describe("Error response format consistency", () => {
    it("all errors include ok: false", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Test error")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.body.ok).toBe(false);
    });

    it("all errors include error message", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Specific error message")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.body.error).toBeTruthy();
      expect(res.body.error).toContain("Specific error message");
    });

    it("400 errors for validation failures", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
      });

      expect(res.status).toBe(400);
    });

    it("500 errors for server failures", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Server error")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(500);
    });

    it("403 errors for forbidden actions", async () => {
      const res = await request(makeApp({ evaluateEnabled: false }))
        .post("/act")
        .send({
          kind: "evaluate",
          fn: "() => 1",
        });

      expect(res.status).toBe(403);
    });

    it("408 errors for timeout", async () => {
      mockFunctions.waitForViaPlaywright.mockRejectedValue(
        new Error("waitForLoadState: networkidle Timeout 5000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        loadState: "networkidle",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(408);
    });

    it("error details object present for timeouts", async () => {
      mockFunctions.waitForViaPlaywright.mockRejectedValue(
        new Error("waitForLoadState: networkidle Timeout 5000ms exceeded")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "wait",
        loadState: "networkidle",
        timeoutMs: 5000,
      });

      expect(res.body.details).toBeTruthy();
      expect(res.body.details.kind).toBe("wait");
    });
  });
});
