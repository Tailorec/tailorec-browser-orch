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
    }),
  };
});

import { registerBrowserAgentActRoutes } from "../../browser/routes/agent.act.js";

describe("integration: /act validation", () => {
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

  it("returns 400 when kind is missing", async () => {
    const res = await request(makeApp()).post("/act").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("kind is required");
  });

  it("rejects selector usage for non-wait actions", async () => {
    const res = await request(makeApp()).post("/act").send({ kind: "click", selector: "#x" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("selector");
  });

  it("rejects evaluate action when evaluate is disabled", async () => {
    const res = await request(makeApp(false)).post("/act").send({ kind: "evaluate", fn: "() => 1" });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("disabled");
  });

  it("returns 400 for click without ref", async () => {
    const res = await request(makeApp()).post("/act").send({ kind: "click" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("ref is required");
  });

  it("validates screenshot constraints", async () => {
    const res = await request(makeApp())
      .post("/screenshot")
      .send({ ref: "e1", element: "#id" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("mutually exclusive");
  });
});
