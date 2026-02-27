import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../browser/pw-ai-module.js", () => {
  return {
    getPwAiModule: async () => ({
      clickViaPlaywright: vi.fn(),
      typeViaPlaywright: vi.fn(),
      pressKeyViaPlaywright: vi.fn(),
      hoverViaPlaywright: vi.fn(),
      scrollIntoViewViaPlaywright: vi.fn(),
      dragViaPlaywright: vi.fn(),
      selectOptionViaPlaywright: vi.fn(),
      fillFormViaPlaywright: vi.fn().mockResolvedValue({ results: [] }),
      resizeViewportViaPlaywright: vi.fn(),
      waitForViaPlaywright: vi.fn(),
      evaluateViaPlaywright: vi.fn(),
      navigateViaPlaywright: vi.fn().mockResolvedValue({ url: "about:blank" }),
      closePageViaPlaywright: vi.fn(),
      discoverDropdownOptionsViaPlaywright: vi.fn().mockResolvedValue({ options: [] }),
      closeDropdownViaPlaywright: vi.fn(),
      queryElementStateViaPlaywright: vi.fn(),
      queryElementStatesViaPlaywright: vi.fn(),
      detectBlockingElementViaPlaywright: vi.fn(),
      dismissBlockerViaPlaywright: vi.fn(),
      armDialogViaPlaywright: vi.fn(),
      waitForDownloadViaPlaywright: vi.fn(),
      downloadViaPlaywright: vi.fn(),
      takeScreenshotViaPlaywright: vi.fn().mockResolvedValue({ buffer: Buffer.from("") }),
      screenshotWithLabelsViaPlaywright: vi.fn().mockResolvedValue({ buffer: Buffer.from(""), labels: 0, skipped: 0 }),
      highlightViaPlaywright: vi.fn(),
      armFileUploadViaPlaywright: vi.fn(),
      setInputFilesViaPlaywright: vi.fn(),
      snapshotAiViaPlaywright: vi.fn(),
      snapshotDeltaViaPlaywright: vi.fn(),
    }),
  };
});

import { registerBrowserAgentActRoutes } from "../../browser/routes/agent.act.js";

function makeApp(evaluateEnabled = true) {
  const app = express();
  app.use(express.json());

  const ctx = {
    state: () => ({ resolved: { evaluateEnabled } }),
    forProfile: () => ({
      profile: { name: "default", cdpUrl: "http://127.0.0.1:9222" },
      ensureTabAvailable: async () => ({ targetId: "t1", url: "about:blank" }),
      stopRunningBrowser: async () => undefined,
    }),
    mapTabError: () => null,
  } as any;

  registerBrowserAgentActRoutes(app as any, ctx);
  return app;
}

describe("contract: POST /act edge contracts", () => {
  it("returns stable 400 contract when kind is missing", async () => {
    const res = await request(makeApp()).post("/act").send({});

    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ ok: false, error: "kind is required" });
  });

  it("returns stable 403 contract when evaluate is forbidden", async () => {
    const res = await request(makeApp(false)).post("/act").send({
      kind: "evaluate",
      fn: "() => 1",
    });

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error).toContain("disabled");
  });
});
