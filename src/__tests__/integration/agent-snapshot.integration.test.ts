import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const snapshotAiViaPlaywright = vi.fn();
const snapshotDeltaViaPlaywright = vi.fn();

vi.mock("../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => ({
    snapshotAiViaPlaywright,
    snapshotDeltaViaPlaywright,
  }),
}));

import { registerBrowserAgentSnapshotRoutes } from "../../browser/routes/agent.snapshot.js";

describe("integration: /snapshot routes", () => {
  beforeEach(() => {
    snapshotAiViaPlaywright.mockReset();
    snapshotDeltaViaPlaywright.mockReset();
  });

  function makeApp() {
    const app = express();
    app.use(express.json());

    const ctx = {
      state: () => ({ resolved: { evaluateEnabled: true } }),
      forProfile: () => ({
        profile: { name: "default", cdpUrl: "http://127.0.0.1:9222" },
        ensureTabAvailable: async (targetId?: string) => ({
          targetId: targetId || "tab-default",
          url: "https://example.org",
        }),
        stopRunningBrowser: async () => undefined,
      }),
      mapTabError: () => null,
    } as any;

    registerBrowserAgentSnapshotRoutes(app as any, ctx);
    return app;
  }

  it("POST /snapshot forwards options to playwright module", async () => {
    snapshotAiViaPlaywright.mockResolvedValue({ markdown: "# snapshot" });

    const res = await request(makeApp()).post("/snapshot").send({
      targetId: "tab-9",
      timeoutMs: 2500,
      maxChars: 10_000,
      interactiveOnly: true,
      compact: true,
      maxDepth: 4,
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.targetId).toBe("tab-9");
    expect(snapshotAiViaPlaywright).toHaveBeenCalledWith({
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "tab-9",
      timeoutMs: 2500,
      maxChars: 10000,
      options: {
        interactive: true,
        compact: true,
        maxDepth: 4,
      },
    });
  });

  it("POST /snapshot/delta rejects invalid action", async () => {
    const res = await request(makeApp()).post("/snapshot/delta").send({ action: "pause" });

    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ ok: false, error: "action must be 'start' or 'stop'" });
  });

  it("POST /snapshot/delta returns delta payload for stop action", async () => {
    snapshotDeltaViaPlaywright.mockResolvedValue({
      addedElements: [{ ref: "e1", role: "button", text: "Buy" }],
    });

    const res = await request(makeApp()).post("/snapshot/delta").send({
      action: "stop",
      anchorRef: "e99",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.targetId).toBe("tab-default");
    expect(snapshotDeltaViaPlaywright).toHaveBeenCalledWith({
      cdpUrl: "http://127.0.0.1:9222",
      targetId: "tab-default",
      action: "stop",
      anchorRef: "e99",
    });
  });
});
