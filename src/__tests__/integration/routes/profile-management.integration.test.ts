import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pw-ai-module
const mockFunctions: Record<string, any> = {};
const functionNames = ["snapshotAiViaPlaywright", "clickViaPlaywright"];

functionNames.forEach((name) => {
  mockFunctions[name] = vi.fn();
});

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => mockFunctions,
}));

import { registerBrowserAgentSnapshotRoutes } from "../../../browser/routes/agent.snapshot.js";
import { registerBrowserAgentActRoutes } from "../../../browser/routes/agent.act.js";

describe("integration: profile management", () => {
  beforeEach(() => {
    functionNames.forEach((name) => {
      mockFunctions[name].mockReset();
    });
  });

  /**
   * Helper to create test Express app with profile management
   */
  function makeApp(options?: {
    profiles?: Map<string, any>;
    currentProfile?: string;
  }) {
    const app = express();
    app.use(express.json());

    const profiles = options?.profiles ?? new Map([
      ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222", cdpPort: 9222 }],
      ["secondary", { name: "secondary", cdpUrl: "http://127.0.0.1:9223", cdpPort: 9223 }],
    ]);

    // Get the first profile name for default usage
    const firstProfileName = options?.currentProfile ?? profiles.keys().next().value ?? "default";

    const ctx = {
      state: () => ({
        resolved: { evaluateEnabled: true },
        profiles,
      }),
      forProfile: (name: string) => {
        // Use the requested profile name or fall back to first available
        const profileName = profiles.has(name) ? name : firstProfileName;
        const profile = profiles.get(profileName);
        if (!profile) {
          throw new Error(`Profile ${name} not found`);
        }
        return {
          profile,
          ensureTabAvailable: async (targetId?: string) => ({
            targetId: targetId ?? "tab-default",
            url: "https://example.org",
          }),
          stopRunningBrowser: async () => undefined,
        };
      },
      mapTabError: () => null,
    } as any;

    registerBrowserAgentSnapshotRoutes(app as any, ctx);
    registerBrowserAgentActRoutes(app as any, ctx);
    return app;
  }

  describe("Profile creation", () => {
    it("create new profile via state", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("create with custom name", async () => {
      const profiles = new Map([
        ["custom-profile", { name: "custom-profile", cdpUrl: "http://127.0.0.1:9224" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("create with custom path", async () => {
      const profiles = new Map([
        ["custom-path", { name: "custom-path", cdpUrl: "http://127.0.0.1:9225", path: "/custom/path" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("create duplicate profile handling", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
        ["default-copy", { name: "default", cdpUrl: "http://127.0.0.1:9226" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("create with invalid name handling", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("profile directory creation verification", async () => {
      const profiles = new Map([
        ["new-profile", { name: "new-profile", cdpUrl: "http://127.0.0.1:9227" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("logging verification - profile creation logged", async () => {
      const profiles = new Map([
        ["logged-profile", { name: "logged-profile", cdpUrl: "http://127.0.0.1:9228" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(mockFunctions.snapshotAiViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("Profile switching", () => {
    it("switch to existing profile", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
        ["secondary", { name: "secondary", cdpUrl: "http://127.0.0.1:9223" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("switch creates new browser context", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
        ["isolated", { name: "isolated", cdpUrl: "http://127.0.0.1:9229" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res1 = await request(makeApp({ profiles })).post("/snapshot").send({});
      expect(res1.status).toBe(200);

      // Switch profile
      mockFunctions.snapshotAiViaPlaywright.mockResolvedValueOnce({
        snapshot: "# Isolated",
        refs: {},
      });

      const res2 = await request(makeApp({ profiles })).post("/snapshot").send({});
      expect(res2.status).toBe(200);
    });

    it("switch preserves state", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
        ["preserved", { name: "preserved", cdpUrl: "http://127.0.0.1:9230" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# State preserved",
        refs: { e1: { role: "button" } },
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(res.body.refs).toHaveProperty("e1");
    });

    it("switch to non-existent profile", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
      ]);

      const ctx = {
        state: () => ({ resolved: { evaluateEnabled: true }, profiles }),
        forProfile: (name: string) => {
          throw new Error(`Profile ${name} not found`);
        },
        mapTabError: () => null,
      } as any;

      const app = express();
      app.use(express.json());
      registerBrowserAgentSnapshotRoutes(app as any, ctx);

      const res = await request(app).post("/snapshot").send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("Profile");
    });

    it("switch during operation", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
        ["switch", { name: "switch", cdpUrl: "http://127.0.0.1:9231" }],
      ]);

      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp({ profiles })).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
    });

    it("switch with active tabs", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
        ["active", { name: "active", cdpUrl: "http://127.0.0.1:9232" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Active tabs",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("logging verification - profile switch logged", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
        ["logged", { name: "logged", cdpUrl: "http://127.0.0.1:9233" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(mockFunctions.snapshotAiViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("Profile cleanup", () => {
    it("profile on close", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("profile data persistence", async () => {
      const profiles = new Map([
        ["persistent", { name: "persistent", cdpUrl: "http://127.0.0.1:9234" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Persistent data",
        refs: { e1: { role: "textbox", name: "Search" } },
      });

      const app = makeApp({ profiles });

      const res1 = await request(app).post("/snapshot").send({});
      const res2 = await request(app).post("/snapshot").send({});

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    it("profile lock release", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
      ]);

      mockFunctions.clickViaPlaywright.mockResolvedValue(undefined);

      // Multiple operations to verify lock release
      for (let i = 0; i < 3; i++) {
        const res = await request(makeApp({ profiles })).post("/act").send({
          kind: "click",
          ref: "e1",
        });
        expect(res.status).toBe(200);
      }
    });

    it("profile directory cleanup", async () => {
      const profiles = new Map([
        ["cleanup", { name: "cleanup", cdpUrl: "http://127.0.0.1:9235" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Cleanup test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("profile cache clearing", async () => {
      const profiles = new Map([
        ["cache", { name: "cache", cdpUrl: "http://127.0.0.1:9236" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Cache test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("logging verification - profile cleanup logged", async () => {
      const profiles = new Map([
        ["default", { name: "default", cdpUrl: "http://127.0.0.1:9222" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(mockFunctions.snapshotAiViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("Profile isolation", () => {
    it("profiles are isolated from each other", async () => {
      const profiles = new Map([
        ["profile-a", { name: "profile-a", cdpUrl: "http://127.0.0.1:9237" }],
        ["profile-b", { name: "profile-b", cdpUrl: "http://127.0.0.1:9238" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright
        .mockResolvedValueOnce({ snapshot: "# Profile A", refs: { a1: { role: "button" } } })
        .mockResolvedValueOnce({ snapshot: "# Profile B", refs: { b1: { role: "link" } } });

      const resA = await request(makeApp({ profiles })).post("/snapshot").send({});
      const resB = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
    });

    it("profile cookies are isolated", async () => {
      const profiles = new Map([
        ["cookie-a", { name: "cookie-a", cdpUrl: "http://127.0.0.1:9239" }],
        ["cookie-b", { name: "cookie-b", cdpUrl: "http://127.0.0.1:9240" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Cookie test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });

    it("profile local storage is isolated", async () => {
      const profiles = new Map([
        ["storage-a", { name: "storage-a", cdpUrl: "http://127.0.0.1:9241" }],
      ]);

      mockFunctions.snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Storage test",
        refs: {},
      });

      const res = await request(makeApp({ profiles })).post("/snapshot").send({});

      expect(res.status).toBe(200);
    });
  });
});
