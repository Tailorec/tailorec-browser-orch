import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createActionRouteHarness,
  createSnapshotRouteHarness,
  createHooksRouteHarness,
  createMediaRouteHarness,
} from "./helpers/route-harness.js";

const existingPath = "/home/faishal/tailorec/tailorec-source/agents/worktrees/openclaw-browser/package.json";

describe("integration: error scenarios", () => {
  describe("Browser unavailable scenarios", () => {
    it("/snapshot when browser unavailable", async () => {
      const { app, takeSnapshotUseCase } = createSnapshotRouteHarness();
      takeSnapshotUseCase.execute.mockResolvedValueOnce({ ok: false, error: "Browser unavailable" });
      const res = await request(app).post("/snapshot").send({});
      expect(res.status).toBe(500);
    });

    for (const body of [
      { kind: "click", ref: "e1" },
      { kind: "type", ref: "e1", text: "Test" },
      { kind: "wait", selector: ".ready" },
      { kind: "navigate", url: "https://example.com" },
      { kind: "fill", fields: [{ ref: "e1", type: "text", value: "Test" }] },
      { kind: "evaluate", fn: "() => 1" },
    ]) {
      it(`/act ${body.kind} when browser unavailable`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: "Browser unavailable" });
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(500);
        expect(res.body.error).toContain("Browser unavailable");
      });
    }

    it("/screenshot when browser unavailable", async () => {
      const { app, navigationAdapter } = createMediaRouteHarness();
      navigationAdapter.takeScreenshot.mockRejectedValueOnce(new Error("Browser unavailable"));
      const res = await request(app).post("/screenshot").send({});
      expect(res.status).toBe(500);
    });

    it("/hooks/file-chooser when browser unavailable", async () => {
      const { app, sessionService } = createHooksRouteHarness();
      sessionService.getPage.mockRejectedValueOnce(new Error("Browser unavailable"));
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath] });
      expect(res.status).toBe(500);
    });
  });

  describe("Element not found scenarios", () => {
    for (const body of [
      { kind: "click", ref: "bad-ref" },
      { kind: "type", ref: "bad-ref", text: "Test" },
      { kind: "fill", fields: [{ ref: "bad-ref", type: "text", value: "Test" }] },
      { kind: "wait", selector: ".never" },
      { kind: "hover", ref: "bad-ref" },
      { kind: "drag", startRef: "missing", endRef: "e2" },
      { kind: "select", ref: "missing", values: ["a"] },
    ]) {
      it(`/act ${body.kind} with missing element`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: "Element not found" });
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(500);
        expect(res.body.error).toContain("Element not found");
      });
    }

    it("/screenshot with invalid ref", async () => {
      const { app, refLocator } = createMediaRouteHarness();
      refLocator.screenshot.mockRejectedValueOnce(new Error("Element not found"));
      const res = await request(app).post("/screenshot").send({ ref: "bad-ref" });
      expect(res.status).toBe(500);
    });

    it("/act query_state for missing element", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.queryElementState.mockRejectedValueOnce(new Error("Element not found"));
      const res = await request(app).post("/act").send({ kind: "query_state", ref: "bad-ref" });
      expect(res.status).toBe(500);
    });

    it("/act discover_dropdown on missing element", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.discoverDropdownOptions.mockRejectedValueOnce(new Error("Element not found"));
      const res = await request(app).post("/act").send({ kind: "discover_dropdown", ref: "bad-ref" });
      expect(res.status).toBe(500);
    });
  });

  describe("Timeout scenarios", () => {
    for (const body of [
      { kind: "click", ref: "e1", timeoutMs: 5000 },
      { kind: "type", ref: "e1", text: "Test", timeoutMs: 5000 },
      { kind: "wait", selector: ".ready", timeoutMs: 5000 },
      { kind: "navigate", url: "https://example.com", timeoutMs: 5000 },
    ]) {
      it(`/act ${body.kind} timeout`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: "Timeout 5000ms exceeded" });
        const res = await request(app).post("/act").send(body);
        expect([408, 500]).toContain(res.status);
      });
    }

    it("/hooks/file-chooser timeout", async () => {
      const { app, sessionService } = createHooksRouteHarness();
      sessionService.getPage.mockRejectedValueOnce(new Error("Timeout 10000ms exceeded"));
      const res = await request(app).post("/hooks/file-chooser").send({ paths: [existingPath], timeoutMs: 10000 });
      expect(res.status).toBe(500);
    });

    it("/screenshot timeout", async () => {
      const { app, navigationAdapter } = createMediaRouteHarness();
      navigationAdapter.takeScreenshot.mockRejectedValueOnce(new Error("Timeout 5000ms exceeded"));
      const res = await request(app).post("/screenshot").send({});
      expect(res.status).toBe(500);
    });
  });

  describe("Validation error scenarios", () => {
    for (const [path, body, status] of [
      ["/act", {}, 400],
      ["/act", { kind: "unknown" }, 400],
      ["/act", { kind: "click" }, 400],
      ["/act", { kind: "type", ref: "e1" }, 400],
      ["/act", { kind: "press" }, 400],
      ["/act", { kind: "navigate" }, 400],
      ["/act", { kind: "evaluate" }, 400],
      ["/act", { kind: "fill" }, 400],
      ["/hooks/file-chooser", {}, 400],
      ["/hooks/dialog", {}, 400],
      ["/act", { kind: "click", ref: "e1", button: "bad" }, 400],
      ["/act", { kind: "click", ref: "e1", modifiers: ["Bad"] }, 400],
      ["/screenshot", { type: "gif" }, 400],
      ["/screenshot", { ref: "e1", element: "#x" }, 400],
      ["/act", { kind: "click", ref: "e1", selector: "#legacy" }, 400],
      ["/screenshot", { type: "jpeg", quality: 200 }, 400],
      ["/act", { kind: "drag", endRef: "e2" }, 400],
      ["/act", { kind: "select", ref: "e1" }, 400],
    ] as const) {
      it(`validates ${path} with body ${JSON.stringify(body)}`, async () => {
        const hooks = createHooksRouteHarness();
        const action = createActionRouteHarness();
        const media = createMediaRouteHarness();
        const app = path.startsWith("/hooks") ? hooks.app : path === "/screenshot" ? media.app : action.app;
        const res = await request(app).post(path).send(body);
        expect(res.status).toBe(status);
      });
    }
  });

  describe("Configuration error scenarios", () => {
    it("evaluate disabled by config", async () => {
      const { app } = createActionRouteHarness({ evaluateEnabled: false });
      const res = await request(app).post("/act").send({ kind: "evaluate", fn: "() => 1" });
      expect(res.status).toBe(403);
    });

    it("wait fn disabled when evaluateEnabled false", async () => {
      const { app } = createActionRouteHarness({ evaluateEnabled: false });
      const res = await request(app).post("/act").send({ kind: "wait", fn: "() => true" });
      expect(res.status).toBe(403);
    });
  });

  describe("Error response format consistency", () => {
    it("all errors include ok: false", async () => {
      const { app } = createActionRouteHarness({ evaluateEnabled: false });
      const res = await request(app).post("/act").send({ kind: "evaluate", fn: "() => 1" });
      expect(res.body.ok).toBe(false);
    });

    it("all errors include error message", async () => {
      const { app } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "click" });
      expect(typeof res.body.error).toBe("string");
    });
  });
});
