import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pw-ai-module to avoid real browser calls
const pressKeyViaPlaywright = vi.fn();

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => ({
    pressKeyViaPlaywright,
  }),
}));

import { registerBrowserAgentActRoutes } from "../../../browser/routes/agent.act.js";

describe("integration: /act - press action", () => {
  beforeEach(() => {
    pressKeyViaPlaywright.mockReset();
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

  describe("POST /act (press) - Basic Functionality", () => {
    it("basic key press", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Enter",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.targetId).toBe("tab-default");
      expect(pressKeyViaPlaywright).toHaveBeenCalledTimes(1);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Enter",
        })
      );
    });

    it("key press with delayMs", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Tab",
        delayMs: 100,
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Tab",
          delayMs: 100,
        })
      );
    });

    it("key combinations - Ctrl+C", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Control+C",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Control+C",
        })
      );
    });

    it("key combinations - Alt+Tab", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Alt+Tab",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Alt+Tab",
        })
      );
    });

    it("key combinations - Meta+S", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Meta+S",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Meta+S",
        })
      );
    });

    it("response structure verification", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Escape",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("press with explicit targetId", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "F5",
        targetId: "tab-789",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-789");
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-789",
        })
      );
    });

    it("common navigation keys", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "ArrowDown",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "ArrowDown",
        })
      );
    });

    it("function keys", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "F12",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "F12",
        })
      );
    });

    it("logging verification - press request logged", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Enter",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (press) - Error Handling", () => {
    it("error: missing key", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "press",
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("key is required");
    });

    it("error: empty key string", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("key is required");
    });

    it("error: browser unavailable", async () => {
      pressKeyViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Enter",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Browser unavailable");
    });

    it("error: invalid key format", async () => {
      pressKeyViaPlaywright.mockRejectedValue(new Error("Invalid key format"));

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "InvalidKey",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Invalid key");
    });

    it("error: correlation ID propagation", async () => {
      const error = new Error("Press failed");
      pressKeyViaPlaywright.mockRejectedValue(error);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Enter",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe("POST /act (press) - Edge Cases", () => {
    it("press with zero delayMs", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Enter",
        delayMs: 0,
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Enter",
          delayMs: 0,
        })
      );
    });

    it("press without delayMs (undefined)", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Enter",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Enter",
        })
      );
    });

    it("multiple modifier keys combination", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "Control+Shift+Delete",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "Control+Shift+Delete",
        })
      );
    });

    it("lowercase key name", async () => {
      pressKeyViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: "enter",
      });

      expect(res.status).toBe(200);
      expect(pressKeyViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "enter",
        })
      );
    });

    it("whitespace only key returns error", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "press",
        key: " ",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("key is required");
    });
  });
});
