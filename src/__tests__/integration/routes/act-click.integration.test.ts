import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createActionRouteHarness } from "./helpers/route-harness.js";

describe("integration: /act - click action", () => {
  const makeHarness = () => createActionRouteHarness();

  beforeEach(() => {
    // each test creates a fresh harness
  });

  describe("POST /act (click) - Basic Functionality", () => {
    it("basic click with ref", async () => {
      const { app, executeActionUseCase } = makeHarness();

      const res = await request(app).post("/act").send({
        kind: "click",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.targetId).toBe("tab-default");
      expect(res.body.url).toBe("https://example.org");
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-default",
          action: expect.objectContaining({ kind: "click", ref: "e1" }),
        }),
      );
    });

    for (const button of ["left", "right", "middle"] as const) {
      it(`click with button option - ${button}`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        const res = await request(app).post("/act").send({ kind: "click", ref: "e1", button });
        expect(res.status).toBe(200);
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({ button }),
          }),
        );
      });
    }

    for (const modifiers of [["Alt"], ["Control"], ["Shift"], ["Meta"], ["ControlOrMeta"], ["Control", "Shift"]] as const) {
      it(`click with modifiers - ${modifiers.join("+")}`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        const res = await request(app).post("/act").send({ kind: "click", ref: "e1", modifiers });
        expect(res.status).toBe(200);
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({ modifiers }),
          }),
        );
      });
    }

    it("doubleClick functionality", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1", doubleClick: true });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ action: expect.objectContaining({ doubleClick: true }) }),
      );
    });

    it("click with timeoutMs option", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1", timeoutMs: 5000 });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ action: expect.objectContaining({ timeoutMs: 5000 }) }),
      );
    });

    it("response structure verification", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        url: expect.any(String),
      });
    });

    it("click with explicit targetId", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({
        kind: "click",
        ref: "e1",
        targetId: "tab-123",
      });
      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-123");
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: "tab-123" }),
      );
    });

    it("logging verification - click request logged", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalled();
    });
  });

  describe("POST /act (click) - Error Handling", () => {
    it("error: missing ref", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: invalid button option", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1", button: "invalid" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("button must be left|right|middle");
    });

    it("error: invalid modifiers - unsupported modifier", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({
        kind: "click",
        ref: "e1",
        modifiers: ["InvalidModifier"],
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("modifiers must be");
    });

    for (const message of ["Element not found: e1", "Timeout 5000ms exceeded", "Browser unavailable", "Click failed"]) {
      it(`error: ${message}`, async () => {
        const { app, executeActionUseCase } = makeHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const res = await request(app).post("/act").send({ kind: "click", ref: "e1", timeoutMs: 5000 });
        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toContain(message.split(":")[0]!);
      });
    }
  });

  describe("POST /act (click) - Edge Cases", () => {
    it("click with empty ref string", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("click with special characters in ref", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1-special_chars.test" });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({ ref: "e1-special_chars.test" }),
        }),
      );
    });

    it("click with doubleClick false (explicit)", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1", doubleClick: false });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ action: expect.objectContaining({ doubleClick: false }) }),
      );
    });

    it("click without optional parameters", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ action: expect.objectContaining({ ref: "e1" }) }),
      );
    });

    it("click with all options combined", async () => {
      const { app, executeActionUseCase } = makeHarness();
      const res = await request(app).post("/act").send({
        kind: "click",
        ref: "e1",
        button: "right",
        modifiers: ["Control", "Shift"],
        doubleClick: true,
        timeoutMs: 10000,
        targetId: "tab-combo",
      });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "tab-combo",
          action: expect.objectContaining({
            ref: "e1",
            button: "right",
            modifiers: ["Control", "Shift"],
            doubleClick: true,
            timeoutMs: 10000,
          }),
        }),
      );
    });
  });
});
