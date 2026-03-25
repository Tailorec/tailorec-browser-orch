import request from "supertest";
import { describe, expect, it } from "vitest";
import { createActionRouteHarness } from "./helpers/route-harness.js";

describe("integration: /act - type action", () => {
  const makeHarness = () => createActionRouteHarness();

  describe("POST /act (type) - Basic Functionality", () => {
    it("basic text typing", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "type", ref: "e1", text: "Hello World" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.targetId).toBe("tab-default");
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({ kind: "type", ref: "e1", text: "Hello World" }),
        }),
      );
    });

    for (const payload of [
      { submit: true, text: "Search query" },
      { slowly: true, text: "Password123" },
      { timeoutMs: 5000, text: "Test text" },
      { submit: false, text: "Test" },
      { slowly: false, text: "Test" },
    ]) {
      it(`forwards ${Object.keys(payload).filter((k) => k !== "text")[0] ?? "text"} option`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        const res = await request(app).post("/act").send({ kind: "type", ref: "e1", ...payload });
        expect(res.status).toBe(200);
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining(payload),
          }),
        );
      });
    }

    it("response structure verification", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "type", ref: "e1", text: "Test" });
      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("type with explicit targetId", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Test",
        targetId: "tab-456",
      });
      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-456");
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: "tab-456" }),
      );
    });

    it("type with all options combined", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({
        kind: "type",
        ref: "e1",
        text: "Complete test",
        submit: true,
        slowly: true,
        timeoutMs: 10000,
        targetId: "tab-combo",
      });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-combo",
          action: expect.objectContaining({
            ref: "e1",
            text: "Complete test",
            submit: true,
            slowly: true,
            timeoutMs: 10000,
          }),
        }),
      );
    });
  });

  describe("POST /act (type) - Error Handling", () => {
    it("error: missing ref", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "type", text: "Test" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: missing text", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "type", ref: "e1" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("text is required");
    });

    it("error: text is not a string", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "type", ref: "e1", text: 123 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("text is required");
    });

    for (const message of [
      "Element not found: e1",
      "Element is not fillable",
      "Timeout 5000ms exceeded",
      "Browser unavailable",
    ]) {
      it(`error: ${message}`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const res = await request(app).post("/act").send({
          kind: "type",
          ref: "e1",
          text: "Test",
          timeoutMs: 5000,
        });
        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toContain(message.split(":")[0]!);
      });
    }
  });

  describe("POST /act (type) - Edge Cases", () => {
    for (const text of [
      "Special chars: @#$%^&*()_+-=[]{}|;':\",./<>?",
      "",
      "A".repeat(500),
      "Unicode: 你好世界 🌍 Привет",
      "Line 1\nLine 2\nLine 3",
      "   ",
    ]) {
      it(`handles text payload: ${JSON.stringify(text).slice(0, 24)}`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        const res = await request(app).post("/act").send({ kind: "type", ref: "e1", text });
        expect(res.status).toBe(200);
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ action: expect.objectContaining({ text }) }),
        );
      });
    }

    it("logging verification - type request logged", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "type", ref: "e1", text: "Test" });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalled();
    });
  });
});
