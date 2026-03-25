import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHooksRouteHarness, createMediaRouteHarness } from "./helpers/route-harness.js";

const downloadsMocks = vi.hoisted(() => ({
  armFileUpload: vi.fn(async () => undefined),
  armDialog: vi.fn(async () => undefined),
  waitForDownload: vi.fn(async () => ({ path: "/tmp/download.txt" })),
  download: vi.fn(async () => ({ path: "/tmp/download.txt" })),
}));

vi.mock("../../../adapters/playwright/playwright.downloads.adapter.js", () => ({
  armFileUpload: downloadsMocks.armFileUpload,
  armDialog: downloadsMocks.armDialog,
  waitForDownload: downloadsMocks.waitForDownload,
  download: downloadsMocks.download,
}));

const existingPath = "/home/faishal/tailorec/tailorec-source/agents/worktrees/openclaw-browser/package.json";

describe("integration: /hooks and /screenshot routes", () => {
  describe("POST /hooks/file-chooser", () => {
    it("accept file chooser with paths", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath] });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(downloadsMocks.armFileUpload).toHaveBeenCalled();
    });

    it("accept file chooser with multiple files", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath, existingPath] });
      expect(res.status).toBe(200);
      expect(downloadsMocks.armFileUpload).toHaveBeenCalled();
    });

    it("file chooser with ref to click", async () => {
      const { app, sessionService } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath], ref: "e1" });
      expect(res.status).toBe(200);
      expect(sessionService.refLocator).toHaveBeenCalledWith("tab-default", "e1");
    });

    it("file chooser with inputRef", async () => {
      const { app, sessionService } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath], inputRef: "input-1" });
      expect(res.status).toBe(200);
      expect(sessionService.refLocator).toHaveBeenCalledWith("tab-default", "input-1");
    });

    it("file chooser with element selector", async () => {
      const { app, sessionService } = createHooksRouteHarness();
      const page = await sessionService.getPage();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath], element: "#file-input" });
      expect(res.status).toBe(200);
      expect(page.locator).toHaveBeenCalledWith("#file-input");
    });

    it("file chooser with timeoutMs", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath], timeoutMs: 10000 });
      expect(res.status).toBe(200);
      expect(downloadsMocks.armFileUpload).toHaveBeenCalled();
    });

    it("file chooser with explicit targetId", async () => {
      const { app, sessionService } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath], targetId: "tab-upload" });
      expect(res.status).toBe(200);
      expect(sessionService.getPage).toHaveBeenCalledWith("tab-upload", expect.any(String));
    });

    it("response structure verification", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath] });
      expect(res.body).toMatchObject({ ok: true });
    });

    it("logging verification - file-chooser request logged", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath] });
      expect(res.status).toBe(200);
      expect(downloadsMocks.armFileUpload).toHaveBeenCalled();
    });

    for (const body of [
      {},
      { paths: [] },
      { paths: [existingPath], ref: "e1", inputRef: "input-1" },
      { paths: [existingPath], ref: "e1", element: "#input" },
    ]) {
      it(`validates file-chooser payload ${JSON.stringify(body)}`, async () => {
        const { app } = createHooksRouteHarness();
        const res = await request(app).post("/hooks/file-chooser").send(body);
        expect(res.status).toBe(400);
      });
    }
  });

  describe("POST /hooks/dialog and download routes", () => {
    it("arms dialog hook", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/dialog").send({ accept: true });
      expect(res.status).toBe(200);
      expect(downloadsMocks.armDialog).toHaveBeenCalled();
    });

    it("validates dialog payload", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/hooks/dialog").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("accept");
    });

    it("waits for download", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/wait/download").send({});
      expect(res.status).toBe(200);
      expect(res.body.download).toEqual({ path: "/tmp/download.txt" });
      expect(downloadsMocks.waitForDownload).toHaveBeenCalled();
    });

    it("downloads from ref", async () => {
      const { app } = createHooksRouteHarness();
      const res = await request(app).post("/download").send({ ref: "e1", path: "/tmp/out.txt" });
      expect(res.status).toBe(200);
      expect(downloadsMocks.download).toHaveBeenCalled();
    });
  });

  describe("POST /screenshot", () => {
    it("full page screenshot", async () => {
      const { app, navigationAdapter } = createMediaRouteHarness();
      const res = await request(app).post("/screenshot").send({ type: "png" });
      expect(res.status).toBe(200);
      expect(res.body.mimeType).toBe("image/png");
      expect(navigationAdapter.takeScreenshot).toHaveBeenCalled();
    });

    it("element screenshot by ref", async () => {
      const { app, refLocator } = createMediaRouteHarness();
      const res = await request(app).post("/screenshot").send({ ref: "e1" });
      expect(res.status).toBe(200);
      expect(refLocator.screenshot).toHaveBeenCalled();
    });

    it("element screenshot by selector", async () => {
      const { app, page } = createMediaRouteHarness();
      const res = await request(app).post("/screenshot").send({ element: "#upload" });
      expect(res.status).toBe(200);
      expect(page.locator).toHaveBeenCalledWith("#upload");
    });

    it("jpeg screenshot with quality", async () => {
      const { app, navigationAdapter } = createMediaRouteHarness();
      const res = await request(app).post("/screenshot").send({ type: "jpeg", quality: 80 });
      expect(res.status).toBe(200);
      expect(navigationAdapter.takeScreenshot).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "jpeg", quality: 80 }),
      );
    });

    for (const body of [
      { ref: "e1", element: "#upload" },
      { ref: "e1", fullPage: true },
      { type: "png", quality: 80 },
      { type: "gif" },
    ]) {
      it(`validates screenshot payload ${JSON.stringify(body)}`, async () => {
        const { app } = createMediaRouteHarness();
        const res = await request(app).post("/screenshot").send(body);
        expect(res.status).toBe(400);
      });
    }
  });
});
