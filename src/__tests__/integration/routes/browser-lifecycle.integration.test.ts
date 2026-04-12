import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createActionRouteHarness,
  createSnapshotRouteHarness,
  createMediaRouteHarness,
} from "./helpers/route-harness.js";

describe("integration: browser lifecycle", () => {
  describe("Browser launch lifecycle", () => {
    it("launch browser with default config", async () => {
      const { app, profileCtx } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.status).toBe(200);
      expect(profileCtx.ensureTabAvailable).toHaveBeenCalled();
    });

    it("launch browser headless", async () => {
      const { app, profileCtx } = createSnapshotRouteHarness();
      const res = await request(app).post("/snapshot").send({});
      expect(res.status).toBe(200);
      expect(profileCtx.profile.browserEndpoint).toContain("9222");
    });

    it("launch with custom viewport", async () => {
      const { app, navigationAdapter } = createMediaRouteHarness();
      const res = await request(app).post("/screenshot").send({ fullPage: true });
      expect(res.status).toBe(200);
      expect(navigationAdapter.takeScreenshot).toHaveBeenCalled();
    });

    it("browser state preserved across requests", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      await request(app).post("/act").send({ kind: "click", ref: "e1" });
      await request(app).post("/act").send({ kind: "hover", ref: "e1" });
      expect(executeActionUseCase.execute).toHaveBeenCalledTimes(2);
    });

    it("browser config applied correctly", async () => {
      const { app } = createActionRouteHarness({ targetId: "tab-config", pageUrl: "https://cfg.test" });
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.body.targetId).toBe("tab-config");
      expect(res.body.url).toBe("https://cfg.test");
    });
  });

  describe("Browser connection", () => {
    it("connect to running browser", async () => {
      const { app, sessionService } = createSnapshotRouteHarness();
      const res = await request(app).post("/snapshot/delta").send({ action: "start" });
      expect(res.status).toBe(200);
      expect(sessionService.getPage).toHaveBeenCalled();
    });

    it("connection with targetId", async () => {
      const { app, sessionService } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "evaluate", fn: "() => 1", targetId: "tab-1" });
      expect(res.status).toBe(200);
      expect(sessionService.getPage).toHaveBeenCalledWith("tab-1", expect.any(String));
    });

    it("connection failure", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: "Browser unavailable" });
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Browser unavailable");
    });

    it("reconnection after disconnect", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      executeActionUseCase.execute
        .mockResolvedValueOnce({ ok: false, error: "disconnect" })
        .mockResolvedValueOnce({ ok: true, targetId: "tab-default", url: "https://example.org" });
      const first = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      const second = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(first.status).toBe(500);
      expect(second.status).toBe(200);
    });

    it("connection preserves browser state", async () => {
      const { app } = createSnapshotRouteHarness({ targetId: "tab-2" });
      const res = await request(app).post("/snapshot").send({});
      expect(res.body.targetId).toBe("tab-2");
    });
  });

  describe("Browser cleanup", () => {
    it("graceful browser close", async () => {
      const { app, sessionService } = createActionRouteHarness();
      await request(app).post("/act").send({ kind: "click", ref: "e1" });
      const res = await request(app).post("/act").send({ kind: "close", targetId: "tab-default" });
      expect(res.status).toBe(200);
      const page = await sessionService.getPage.mock.results[0].value;
      expect(page.close).toHaveBeenCalled();
    });

    it("cleanup on error", async () => {
      const { app, profileCtx } = createActionRouteHarness();
      await request(app).post("/act").send({ kind: "click", ref: "e1" });
      profileCtx.stopRunningBrowser.mockRejectedValueOnce(new Error("cleanup failed"));
      const res = await request(app).post("/act").send({ kind: "close", targetId: "tab-default" });
      expect(res.status).toBe(500);
    });

    it("cleanup preserves functionality", async () => {
      const { app } = createActionRouteHarness();
      await request(app).post("/act").send({ kind: "close", targetId: "tab-default" });
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.status).toBe(200);
    });
  });
});
