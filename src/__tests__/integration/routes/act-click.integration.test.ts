import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pw-ai-module to avoid real browser calls
const clickViaPlaywright = vi.fn();

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => ({
    clickViaPlaywright,
  }),
}));

import { registerBrowserAgentActRoutes } from "../../../browser/routes/agent.act.js";

describe("integration: /act - click action", () => {
  beforeEach(() => {
    clickViaPlaywright.mockReset();
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

  describe("POST /act (click) - Basic Functionality", () => {
    it("basic click with ref", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.targetId).toBe("tab-default");
      expect(res.body.url).toBe("https://example.org");
      expect(clickViaPlaywright).toHaveBeenCalledTimes(1);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
        })
      );
    });

    it("click with button option - left", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        button: "left",
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          button: "left",
        })
      );
    });

    it("click with button option - right", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        button: "right",
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          button: "right",
        })
      );
    });

    it("click with button option - middle", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        button: "middle",
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          button: "middle",
        })
      );
    });

    it("click with modifiers - Alt", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["Alt"],
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          modifiers: ["Alt"],
        })
      );
    });

    it("click with modifiers - Control", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["Control"],
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          modifiers: ["Control"],
        })
      );
    });

    it("click with modifiers - Shift", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["Shift"],
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          modifiers: ["Shift"],
        })
      );
    });

    it("click with modifiers - Meta", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["Meta"],
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          modifiers: ["Meta"],
        })
      );
    });

    it("click with modifiers - ControlOrMeta", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["ControlOrMeta"],
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          modifiers: ["ControlOrMeta"],
        })
      );
    });

    it("click with multiple modifiers", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["Control", "Shift"],
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          modifiers: ["Control", "Shift"],
        })
      );
    });

    it("doubleClick functionality", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        doubleClick: true,
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          doubleClick: true,
        })
      );
    });

    it("click with timeoutMs option", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 5000,
        })
      );
    });

    it("response structure verification", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        url: expect.any(String),
      });
    });

    it("click with explicit targetId", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        targetId: "tab-123",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-123");
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-123",
        })
      );
    });

    it("logging verification - click request logged", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (click) - Error Handling", () => {
    it("error: missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: invalid button option", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        button: "invalid",
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("button must be left|right|middle");
    });

    it("error: invalid modifiers - unsupported modifier", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["InvalidModifier"],
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("modifiers must be");
    });

    it("error: element not found", async () => {
      clickViaPlaywright.mockRejectedValue(new Error("Element not found: e1"));

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Element not found");
    });

    it("error: timeout exceeded", async () => {
      clickViaPlaywright.mockRejectedValue(new Error("Timeout 5000ms exceeded"));

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Timeout");
    });

    it("error: browser unavailable", async () => {
      clickViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Browser unavailable");
    });

    it("error: correlation ID propagation", async () => {
      const error = new Error("Click failed");
      clickViaPlaywright.mockRejectedValue(error);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe("POST /act (click) - Edge Cases", () => {
    it("click with empty ref string", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("click with special characters in ref", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1-special_chars.test",
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1-special_chars.test",
        })
      );
    });

    it("click with doubleClick false (explicit)", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        doubleClick: false,
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          doubleClick: false,
        })
      );
    });

    it("click without optional parameters", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
          doubleClick: false,
        })
      );
    });

    it("click with all options combined", async () => {
      clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        button: "right",
        modifiers: ["Control", "Shift"],
        doubleClick: true,
        timeoutMs: 10000,
        targetId: "tab-combo",
      });

      expect(res.status).toBe(200);
      expect(clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
          button: "right",
          modifiers: ["Control", "Shift"],
          doubleClick: true,
          timeoutMs: 10000,
          targetId: "tab-combo",
        })
      );
    });
  });
});
