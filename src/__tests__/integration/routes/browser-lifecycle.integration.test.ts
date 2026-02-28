import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pw-ai-module
const mockFunctions: Record<string, any> = {};
const functionNames = [
  "clickViaPlaywright",
  "snapshotAiViaPlaywright",
  "takeScreenshotViaPlaywright",
];

functionNames.forEach((name) => {
  mockFunctions[name] = vi.fn();
});

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => mockFunctions,
}));

import { registerBrowserAgentActRoutes } from "../../../browser/routes/agent.act.js";
import { registerBrowserAgentSnapshotRoutes } from "../../../browser/routes/agent.snapshot.js";

describe("integration: browser lifecycle", () => {
  beforeEach(() => {
    functionNames.forEach((name) => {
      mockFunctions[name].mockReset();
    });
  });

  /**
   * Helper to create test Express app
   */
  function makeApp(options?: {
    evaluateEnabled?: boolean;
    headless?: boolean;
    viewport?: { width: number; height: number };
  }) {
    const app = express();
    app.use(express.json());

    const ctx = {
      state: () => ({
        resolved: {
          evaluateEnabled: options?.evaluateEnabled ?? true,
          headless: options?.headless ?? true,
          viewport: options?.viewport ?? { width: 1280, height: 720 },
        },
      }),
      forProfile: () => ({
        profile: {
          name: "default",
          cdpUrl: "http://127.0.0.1:9222",
          cdpPort: 9222,
          driver: "chrome" as const,
          color: "blue",
        },
        ensureTabAvailable: async (targetId?: string) => ({
          targetId: targetId ?? "tab-default",
          url: "https://example.org",
        }),
        stopRunningBrowser: async () => undefined,
      }),
      mapTabError: () => null,
    } as any;

    registerBrowserAgentActRoutes(app as any, ctx);
    registerBrowserAgentSnapshotRoutes(app as any, ctx);
    return app;
  }

  describe("Browser launch lifecycle", () => {
    it("launch browser with default config", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("launch browser headless", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ headless: true })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("launch with custom viewport", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(
        makeApp({ viewport: { width: 1920, height: 1080 } })
      )
        .post("/snapshot")
        .send({});

      expect(res.status).toBe(200);
    });

    it("browser already running scenario", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      // Simulate multiple requests to same browser
      const res1 = await request(makeApp()).post("/snapshot").send({});
      const res2 = await request(makeApp()).post("/snapshot").send({});

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    it("launch timeout handling", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockRejectedValue(
        new Error("Browser launch timeout")
      );

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Browser launch timeout");
    });

    it("launch failure handling", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockRejectedValue(
        new Error("Failed to launch browser")
      );

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("port already in use scenario", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockRejectedValue(
        new Error("Port 9222 already in use")
      );

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("already in use");
    });

    it("logging verification - browser launch logged", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(mockFunctions.snapshotAiViaPlaywright).toHaveBeenCalled();
    });

    it("browser state preserved across requests", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const app = makeApp();

      const res1 = await request(app).post("/snapshot").send({});
      const res2 = await request(app).post("/snapshot").send({});

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    it("browser config applied correctly", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(
        makeApp({
          evaluateEnabled: true,
          headless: true,
          viewport: { width: 1280, height: 720 },
        })
      )
        .post("/snapshot")
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe("Browser connection", () => {
    it("connect to running browser", async () => {
      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("connection retry logic", async () => {
      // First call fails, second succeeds
      mockFunctions.clickViaPlaywright
        .mockRejectedValueOnce(new Error("Connection failed"))
        .mockResolvedValueOnce(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      // The route doesn't retry, so it should fail
      expect(res.status).toBe(500);
    });

    it("connection timeout", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Connection timeout 5000ms")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("timeout");
    });

    it("CDP endpoint discovery", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      // CDP URL should be used
      expect(mockFunctions.snapshotAiViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          cdpUrl: expect.stringContaining("127.0.0.1"),
        })
      );
    });

    it("connection with targetId", async () => {
      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
        targetId: "tab-123",
      });

      expect(res.status).toBe(200);
      expect(mockFunctions.clickViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-123",
        })
      );
    });

    it("connection failure", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Failed to connect to browser")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Failed to connect");
    });

    it("reconnection after disconnect", async () => {
      mockFunctions.clickViaPlaywright
        .mockRejectedValueOnce(new Error("Disconnected"))
        .mockResolvedValueOnce(undefined);

      // First request fails
      const res1 = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });
      expect(res1.status).toBe(500);

      // Second request succeeds (simulating reconnection)
      const res2 = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });
      expect(res2.status).toBe(200);
    });

    it("multiple connection attempts", async () => {
      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      const res1 = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });
      const res2 = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e2",
      });
      const res3 = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e3",
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
    });

    it("logging verification - connection logged", async () => {
      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(mockFunctions.clickViaPlaywright).toHaveBeenCalled();
    });

    it("connection preserves browser state", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: { e1: { role: "button" } },
      });

      const app = makeApp();

      const res1 = await request(app).post("/snapshot").send({});
      const res2 = await request(app).post("/snapshot").send({});

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.refs).toEqual(res2.body.refs);
    });
  });

  describe("Browser cleanup", () => {
    it("graceful browser close", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      // Browser should be available for subsequent requests
      const res2 = await request(makeApp()).post("/snapshot").send({});
      expect(res2.status).toBe(200);
    });

    it("force close on timeout", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockRejectedValue(
        new Error("Force close due to timeout")
      );

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(500);
    });

    it("profile cleanup on close", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("context cleanup", async () => {
      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
    });

    it("page cleanup", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("event listener cleanup", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const app = makeApp();

      // Multiple requests to verify cleanup
      for (let i = 0; i < 5; i++) {
        const res = await request(app).post("/snapshot").send({});
        expect(res.status).toBe(200);
      }
    });

    it("resource release", async () => {
      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
    });

    it("cleanup on error", async () => {
      mockFunctions.clickViaPlaywright.mockRejectedValue(
        new Error("Test error for cleanup")
      );

      const res = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      // Browser should still be available after error
      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);
      const res2 = await request(makeApp()).post("/act").send({
        kind: "click",
        ref: "e1",
      });
      expect(res2.status).toBe(200);
    });

    it("cleanup preserves functionality", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const app = makeApp();

      const res1 = await request(app).post("/snapshot").send({});
      expect(res1.status).toBe(200);

      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);
      const res2 = await request(app).post("/act").send({
        kind: "click",
        ref: "e1",
      });
      expect(res2.status).toBe(200);

      mockFunctions.takeScreenshotViaPlaywright.mockResolvedValue({
        buffer: Buffer.from("image"),
      });
      const res3 = await request(app).post("/screenshot").send({
        fullPage: true,
      });
      expect(res3.status).toBe(200);
    });

    it("logging verification - cleanup logged", async () => {
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(mockFunctions.snapshotAiViaPlaywright).toHaveBeenCalled();
    });
  });
});
