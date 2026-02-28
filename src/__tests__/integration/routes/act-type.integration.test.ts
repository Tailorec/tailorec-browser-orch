import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pw-ai-module to avoid real browser calls
const typeViaPlaywright = vi.fn();

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => ({
    typeViaPlaywright,
  }),
}));

import { registerBrowserAgentActRoutes } from "../../../browser/routes/agent.act.js";

describe("integration: /act - type action", () => {
  beforeEach(() => {
    typeViaPlaywright.mockReset();
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

  describe("POST /act (type) - Basic Functionality", () => {
    it("basic text typing", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Hello World",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.targetId).toBe("tab-default");
      expect(typeViaPlaywright).toHaveBeenCalledTimes(1);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
          text: "Hello World",
        })
      );
    });

    it("type with submit option", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Search query",
        submit: true,
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          submit: true,
        })
      );
    });

    it("type with slowly option", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Password123",
        slowly: true,
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          slowly: true,
        })
      );
    });

    it("type with timeoutMs option", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test text",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 5000,
        })
      );
    });

    it("response structure verification", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("type with explicit targetId", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
        targetId: "tab-456",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-456");
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-456",
        })
      );
    });

    it("type with submit false (explicit)", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
        submit: false,
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          submit: false,
        })
      );
    });

    it("type with slowly false (explicit)", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
        slowly: false,
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          slowly: false,
        })
      );
    });

    it("type with all options combined", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Complete test",
        submit: true,
        slowly: true,
        timeoutMs: 10000,
        targetId: "tab-combo",
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
          text: "Complete test",
          submit: true,
          slowly: true,
          timeoutMs: 10000,
          targetId: "tab-combo",
        })
      );
    });
  });

  describe("POST /act (type) - Error Handling", () => {
    it("error: missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        text: "Test",
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: missing text", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("text is required");
    });

    it("error: text is not a string", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: 123,
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("text is required");
    });

    it("error: element not found", async () => {
      typeViaPlaywright.mockRejectedValue(new Error("Element not found: e1"));

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Element not found");
    });

    it("error: element not fillable", async () => {
      typeViaPlaywright.mockRejectedValue(new Error("Element is not fillable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("not fillable");
    });

    it("error: timeout exceeded", async () => {
      typeViaPlaywright.mockRejectedValue(new Error("Timeout 5000ms exceeded"));

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Timeout");
    });

    it("error: browser unavailable", async () => {
      typeViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Browser unavailable");
    });
  });

  describe("POST /act (type) - Edge Cases", () => {
    it("special characters handling", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Special chars: @#$%^&*()_+-=[]{}|;':\",./<>?",
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Special chars: @#$%^&*()_+-=[]{}|;':\",./<>?",
        })
      );
    });

    it("empty text handling", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "",
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "",
        })
      );
    });

    it("long text handling (>200 chars)", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);
      const longText = "A".repeat(500);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: longText,
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          text: longText,
        })
      );
    });

    it("unicode characters handling", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Unicode: 你好世界 🌍 Привет",
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Unicode: 你好世界 🌍 Привет",
        })
      );
    });

    it("newline characters handling", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Line 1\nLine 2\nLine 3",
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Line 1\nLine 2\nLine 3",
        })
      );
    });

    it("whitespace only text", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "   ",
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "   ",
        })
      );
    });

    it("logging verification - type request logged", async () => {
      typeViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
      });

      expect(res.status).toBe(200);
      expect(typeViaPlaywright).toHaveBeenCalled();
    });
  });
});
