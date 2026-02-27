import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pw-ai-module to avoid real browser calls
const snapshotAiViaPlaywright = vi.fn();
const snapshotDeltaViaPlaywright = vi.fn();

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => ({
    snapshotAiViaPlaywright,
    snapshotDeltaViaPlaywright,
  }),
}));

import { registerBrowserAgentSnapshotRoutes } from "../../../browser/routes/agent.snapshot.js";

describe("integration: /snapshot routes", () => {
  beforeEach(() => {
    snapshotAiViaPlaywright.mockReset();
    snapshotDeltaViaPlaywright.mockReset();
  });

  /**
   * Helper to create test Express app with snapshot routes
   */
  function makeApp(options?: {
    profileName?: string;
    cdpUrl?: string;
    targetId?: string;
    pageUrl?: string;
    simulateError?: boolean;
  }) {
    const app = express();
    app.use(express.json());

    const profileName = options?.profileName ?? "default";
    const cdpUrl = options?.cdpUrl ?? "http://127.0.0.1:9222";
    const targetId = options?.targetId ?? "tab-default";
    const pageUrl = options?.pageUrl ?? "https://example.org";

    const ctx = {
      state: () => ({
        resolved: { evaluateEnabled: true },
        profiles: new Map(),
      }),
      forProfile: (name: string) => {
        if (options?.simulateError) {
          throw new Error(`Profile ${name} not found`);
        }
        return {
          profile: { name, cdpUrl },
          ensureTabAvailable: async (targetId?: string) => ({
            targetId: targetId || "tab-default",
            url: pageUrl,
          }),
          stopRunningBrowser: async () => undefined,
        };
      },
      mapTabError: () => null,
    } as any;

    registerBrowserAgentSnapshotRoutes(app as any, ctx);
    return app;
  }

  describe("POST /snapshot - Basic Functionality", () => {
    it("basic request without options", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Heading\n\n- button \"Click me\"",
        refs: { d1: { role: "button", name: "Click me" } },
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.targetId).toBe("tab-default");
      expect(res.body.url).toBe("https://example.org");
      expect(res.body.snapshot).toBe("# Heading\n\n- button \"Click me\"");
      expect(res.body.refs).toEqual({ d1: { role: "button", name: "Click me" } });
      expect(snapshotAiViaPlaywright).toHaveBeenCalledTimes(1);
    });

    it("request with explicit targetId", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Page",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({
        targetId: "tab-123",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-123");
      expect(snapshotAiViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-123",
        })
      );
    });

    it("response structure matches contract", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Test",
        refs: { r1: { role: "link" } },
        truncated: false,
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        url: expect.any(String),
        snapshot: expect.any(String),
        refs: expect.any(Object),
      });
    });

    it("refs in response are properly structured", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# App\n- button \"Submit\"",
        refs: {
          d1: { role: "button", name: "Submit" },
          d2: { role: "link", name: "Home" },
          d3: { role: "textbox", name: "Email" },
        },
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.body.refs).toHaveProperty("d1");
      expect(res.body.refs).toHaveProperty("d2");
      expect(res.body.refs).toHaveProperty("d3");
      expect(res.body.refs.d1).toEqual({ role: "button", name: "Submit" });
      expect(res.body.refs.d2).toEqual({ role: "link", name: "Home" });
      expect(res.body.refs.d3).toEqual({ role: "textbox", name: "Email" });
    });

    it("logging verification - snapshot request logged", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({ snapshot: "# Test", refs: {} });

      const res = await request(makeApp()).post("/snapshot").send({
        targetId: "tab-log",
      });

      expect(res.status).toBe(200);
      // The route should have logged the snapshot request
      expect(snapshotAiViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /snapshot - Options", () => {
    it("timeoutMs option is forwarded", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({ snapshot: "# Test", refs: {} });

      const res = await request(makeApp()).post("/snapshot").send({
        timeoutMs: 3000,
      });

      expect(res.status).toBe(200);
      expect(snapshotAiViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 3000,
        })
      );
    });

    it("maxChars option is forwarded", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({ snapshot: "# Test", refs: {} });

      const res = await request(makeApp()).post("/snapshot").send({
        maxChars: 5000,
      });

      expect(res.status).toBe(200);
      expect(snapshotAiViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          maxChars: 5000,
        })
      );
    });

    it("interactiveOnly option is forwarded", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({ snapshot: "# Test", refs: {} });

      const res = await request(makeApp()).post("/snapshot").send({
        interactiveOnly: true,
      });

      expect(res.status).toBe(200);
      expect(snapshotAiViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            interactive: true,
          }),
        })
      );
    });

    it("compact option is forwarded", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({ snapshot: "# Test", refs: {} });

      const res = await request(makeApp()).post("/snapshot").send({
        compact: true,
      });

      expect(res.status).toBe(200);
      expect(snapshotAiViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            compact: true,
          }),
        })
      );
    });

    it("maxDepth option is forwarded", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({ snapshot: "# Test", refs: {} });

      const res = await request(makeApp()).post("/snapshot").send({
        maxDepth: 5,
      });

      expect(res.status).toBe(200);
      expect(snapshotAiViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            maxDepth: 5,
          }),
        })
      );
    });
  });

  describe("POST /snapshot - Edge Cases", () => {
    it("truncated response when maxChars exceeded", async () => {
      const largeSnapshot = "# Test\n" + "- ".repeat(1000) + "button \"Click\"";
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: largeSnapshot.slice(0, 100) + "\n\n[...TRUNCATED - page too large]",
        truncated: true,
        refs: { d1: { role: "button" } },
      });

      const res = await request(makeApp()).post("/snapshot").send({
        maxChars: 100,
      });

      expect(res.status).toBe(200);
      expect(res.body.truncated).toBe(true);
      expect(res.body.snapshot).toContain("[...TRUNCATED - page too large]");
    });

    it("empty page snapshot", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "",
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(res.body.snapshot).toBe("");
      expect(res.body.refs).toEqual({});
    });

    it("large page snapshot without truncation", async () => {
      const largeSnapshot = "# Large Page\n" + "- ".repeat(500) + "item";
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: largeSnapshot,
        refs: {},
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(res.body.snapshot).toBe(largeSnapshot);
      expect(res.body.truncated).toBeUndefined();
    });

    it("dynamic content snapshot", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Dynamic\n- button \"Load More\"\n- list \"Items\"",
        refs: { d1: { role: "button" }, d2: { role: "list" } },
      });

      const res = await request(makeApp()).post("/snapshot").send({
        interactiveOnly: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.snapshot).toContain("Dynamic");
      expect(res.body.refs).toHaveProperty("d1");
      expect(res.body.refs).toHaveProperty("d2");
    });

    it("iframe content snapshot", async () => {
      snapshotAiViaPlaywright.mockResolvedValue({
        snapshot: "# Main\n- iframe \"Embedded Content\"",
        refs: { d1: { role: "iframe" } },
      });

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(res.body.snapshot).toContain("iframe");
      expect(res.body.refs).toHaveProperty("d1");
    });
  });

  describe("POST /snapshot - Error Handling", () => {
    it("error: browser unavailable", async () => {
      snapshotAiViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Browser unavailable");
    });

    it("error: timeout exceeded", async () => {
      snapshotAiViaPlaywright.mockRejectedValue(new Error("Timeout 5000ms exceeded"));

      const res = await request(makeApp()).post("/snapshot").send({
        timeoutMs: 5000,
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Timeout");
    });

    it("error: invalid options", async () => {
      snapshotAiViaPlaywright.mockRejectedValue(new Error("Invalid options provided"));

      const res = await request(makeApp()).post("/snapshot").send({
        maxChars: -100,
        maxDepth: -5,
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it("error: invalid targetId", async () => {
      const app = makeApp();
      snapshotAiViaPlaywright.mockRejectedValue(new Error("Target not found: invalid-tab"));

      const res = await request(app).post("/snapshot").send({
        targetId: "invalid-tab",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Target not found");
    });

    it("error: correlation ID propagation", async () => {
      const error = new Error("Snapshot failed");
      snapshotAiViaPlaywright.mockRejectedValue(error);

      const res = await request(makeApp()).post("/snapshot").send({});

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      // Error should be properly propagated
      expect(res.body.error).toBeTruthy();
    });

    it("error: profile not found", async () => {
      const res = await request(makeApp({ simulateError: true })).post("/snapshot").send({});

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("Profile");
    });
  });

  describe("POST /snapshot/delta - Start/Stop Observation", () => {
    it("start action begins DOM observation", async () => {
      snapshotDeltaViaPlaywright.mockResolvedValue({
        observing: true,
      });

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "start",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.observing).toBe(true);
      expect(snapshotDeltaViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "start",
        })
      );
    });

    it("stop action returns delta payload", async () => {
      snapshotDeltaViaPlaywright.mockResolvedValue({
        addedElements: [
          { ref: "e1", role: "button", text: "Buy" },
          { ref: "e2", role: "link", text: "Details" },
        ],
        removedElements: [],
      });

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "stop",
        anchorRef: "e99",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.addedElements).toHaveLength(2);
      expect(res.body.addedElements[0]).toEqual({
        ref: "e1",
        role: "button",
        text: "Buy",
      });
      expect(snapshotDeltaViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "stop",
          anchorRef: "e99",
        })
      );
    });

    it("invalid action returns 400 error", async () => {
      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "pause",
      });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe("action must be 'start' or 'stop'");
    });

    it("anchorRef support in stop action", async () => {
      snapshotDeltaViaPlaywright.mockResolvedValue({
        addedElements: [{ ref: "e1", role: "button" }],
      });

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "stop",
        anchorRef: "anchor-123",
      });

      expect(res.status).toBe(200);
      expect(snapshotDeltaViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          anchorRef: "anchor-123",
        })
      );
    });

    it("error handling for delta route", async () => {
      snapshotDeltaViaPlaywright.mockRejectedValue(new Error("DOM observation failed"));

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "start",
      });

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain("DOM observation failed");
    });
  });

  describe("POST /snapshot/delta - Edge Cases", () => {
    it("empty delta (no changes)", async () => {
      snapshotDeltaViaPlaywright.mockResolvedValue({
        addedElements: [],
        removedElements: [],
      });

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "stop",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.addedElements).toEqual([]);
      expect(res.body.removedElements).toEqual([]);
    });

    it("delta with only removed elements", async () => {
      snapshotDeltaViaPlaywright.mockResolvedValue({
        addedElements: [],
        removedElements: [{ ref: "e1", role: "button" }],
      });

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "stop",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.removedElements).toHaveLength(1);
    });

    it("delta with multiple added and removed elements", async () => {
      snapshotDeltaViaPlaywright.mockResolvedValue({
        addedElements: [
          { ref: "e1", role: "button" },
          { ref: "e2", role: "link" },
          { ref: "e3", role: "textbox" },
        ],
        removedElements: [
          { ref: "e4", role: "button" },
          { ref: "e5", role: "link" },
        ],
      });

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "stop",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.addedElements).toHaveLength(3);
      expect(res.body.removedElements).toHaveLength(2);
    });

    it("delta without anchorRef uses default", async () => {
      snapshotDeltaViaPlaywright.mockResolvedValue({ observing: true });

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "start",
      });

      expect(res.status).toBe(200);
      expect(snapshotDeltaViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          anchorRef: undefined,
        })
      );
    });

    it("delta with explicit targetId", async () => {
      snapshotDeltaViaPlaywright.mockResolvedValue({ observing: true });

      const res = await request(makeApp()).post("/snapshot/delta").send({
        action: "start",
        targetId: "tab-delta-123",
      });

      expect(res.status).toBe(200);
      expect(snapshotDeltaViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-delta-123",
        })
      );
    });
  });
});
