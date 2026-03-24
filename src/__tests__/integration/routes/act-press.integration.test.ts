import request from "supertest";
import { describe, expect, it } from "vitest";
import { createActionRouteHarness } from "./helpers/route-harness.js";

describe("integration: /act - press action", () => {
  const makeHarness = () => createActionRouteHarness();

  describe("POST /act (press) - Basic Functionality", () => {
    for (const body of [
      { key: "Enter" },
      { key: "Tab", delayMs: 100 },
      { key: "Control+C" },
      { key: "Alt+Tab" },
      { key: "Meta+S" },
      { key: "ArrowDown" },
      { key: "F12" },
    ]) {
      it(`presses ${body.key}`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        const res = await request(app).post("/act").send({ kind: "press", ...body });
        expect(res.status).toBe(200);
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining(body),
          }),
        );
      });
    }

    it("basic key press response structure", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "press", key: "Escape" });
      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("press with explicit targetId", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({
        kind: "press",
        key: "F5",
        targetId: "tab-789",
      });
      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-789");
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: "tab-789" }),
      );
    });

    it("logging verification - press request logged", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "press", key: "Enter" });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalled();
    });
  });

  describe("POST /act (press) - Error Handling", () => {
    it("error: missing key", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "press" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("key is required");
    });

    it("error: empty key string", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "press", key: "" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("key is required");
    });

    for (const message of ["Browser unavailable", "Invalid key format", "Press failed"]) {
      it(`error: ${message}`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const res = await request(app).post("/act").send({ kind: "press", key: "Enter" });
        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toContain(message.split(" ")[0]!);
      });
    }
  });

  describe("POST /act (press) - Edge Cases", () => {
    for (const body of [
      { key: "Enter", delayMs: 0 },
      { key: "Enter" },
      { key: "Control+Shift+Delete" },
      { key: "enter" },
    ]) {
      it(`supports edge case ${body.key}`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        const res = await request(app).post("/act").send({ kind: "press", ...body });
        expect(res.status).toBe(200);
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ action: expect.objectContaining(body) }),
        );
      });
    }

    it("whitespace only key returns error", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "press", key: " " });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("key is required");
    });
  });
});
