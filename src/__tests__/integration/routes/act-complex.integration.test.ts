import request from "supertest";
import { describe, expect, it } from "vitest";
import { createActionRouteHarness } from "./helpers/route-harness.js";

describe("integration: /act - complex actions (fill, wait, navigate, evaluate)", () => {
  describe("POST /act (fill) - Basic Functionality", () => {
    it("single field fill", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      executeActionUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        results: [{ ref: "e1", requestedValue: "Alice", actualValue: "Alice", matched: true, strategy: "fill" }],
        allMatched: true,
      });

      const res = await request(app).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "Alice" }],
      });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({
            kind: "fill",
            fields: [{ ref: "e1", type: "text", value: "Alice" }],
          }),
        }),
      );
    });

    it("multiple fields fill", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      executeActionUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        results: [
          { ref: "e1", requestedValue: "Alice", actualValue: "Alice", matched: true, strategy: "fill" },
          { ref: "e2", requestedValue: "a@example.com", actualValue: "a@example.com", matched: true, strategy: "fill" },
        ],
        allMatched: true,
      });
      const fields = [
        { ref: "e1", type: "text", value: "Alice" },
        { ref: "e2", type: "email", value: "a@example.com" },
      ];
      const res = await request(app).post("/act").send({ kind: "fill", fields });
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ action: expect.objectContaining({ fields }) }),
      );
    });

    for (const strategy of ["skip", "pressSequentially", "fill"] as const) {
      it(`returns strategy ${strategy}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({
          ok: true,
          targetId: "tab-default",
          results: [{ ref: "e1", requestedValue: "v", actualValue: "v", matched: true, strategy }],
          allMatched: true,
        });
        const res = await request(app).post("/act").send({
          kind: "fill",
          fields: [{ ref: "e1", type: "text", value: "v" }],
        });
        expect(res.status).toBe(200);
        expect(res.body.results[0].strategy).toBe(strategy);
      });
    }

    it("response structure with mismatched fields", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      executeActionUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        results: [
          {
            ref: "e1",
            requestedValue: "expected",
            actualValue: "actual",
            matched: false,
            strategy: "pressSequentially",
            warning: "Value mismatch",
          },
        ],
        allMatched: false,
      });
      const res = await request(app).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "expected" }],
      });
      expect(res.status).toBe(200);
      expect(res.body.allMatched).toBe(false);
      expect(res.body.mismatched).toEqual([
        { ref: "e1", requested: "expected", actual: "actual", warning: "Value mismatch" },
      ]);
    });

    it("fill with timeoutMs option", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      const res = await request(app).post("/act").send({
        kind: "fill",
        timeoutMs: 5000,
        fields: [{ ref: "e1", type: "text", value: "Test" }],
      });
      expect(res.status).toBe(200);
      expect(executeActionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ action: expect.objectContaining({ timeoutMs: 5000 }) }),
      );
    });
  });

  describe("POST /act (fill) - Error Handling", () => {
    for (const body of [
      { kind: "fill" },
      { kind: "fill", fields: [] },
      { kind: "fill", fields: [{ type: "text", value: "x" }] },
      { kind: "fill", fields: [{ ref: "e1", value: "x" }] },
    ]) {
      it(`rejects invalid fill payload ${JSON.stringify(body)}`, async () => {
        const { app } = createActionRouteHarness();
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
      });
    }

    for (const message of ["Element not found", "Element is not fillable"]) {
      it(`surfaces fill failure: ${message}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const res = await request(app).post("/act").send({
          kind: "fill",
          fields: [{ ref: "e1", type: "text", value: "Test" }],
        });
        expect(res.status).toBe(500);
        expect(res.body.error).toContain(message);
      });
    }
  });

  describe("POST /act (fill) - Edge Cases", () => {
    for (const field of [
      { ref: "e1", type: "tel", value: "1234567890" },
      { ref: "e1", type: "date", value: "2024-01-01" },
      { ref: "e1", type: "text", value: "" },
      { ref: "e1", type: "text", value: "   " },
      { ref: "e1", type: "text", value: "A".repeat(500) },
    ]) {
      it(`accepts fill edge case type=${field.type} value=${String(field.value).slice(0, 10)}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        const res = await request(app).post("/act").send({ kind: "fill", fields: [field] });
        expect(res.status).toBe(200);
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ action: expect.objectContaining({ fields: [field] }) }),
        );
      });
    }

    it("strategy tracking in response", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      executeActionUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        results: [{ ref: "e1", requestedValue: "X", actualValue: "X", matched: true, strategy: "pressSequentially" }],
        allMatched: true,
      });
      const res = await request(app).post("/act").send({
        kind: "fill",
        fields: [{ ref: "e1", type: "text", value: "X" }],
      });
      expect(res.body.results[0].strategy).toBe("pressSequentially");
    });
  });

  describe("POST /act (wait) - Basic Functionality", () => {
    for (const body of [
      { selector: ".ready" },
      { textGone: "Loading" },
      { text: "Ready" },
      { url: "**/done" },
      { timeoutMs: 5000, selector: ".ready" },
      { loadState: "networkidle" },
      { timeMs: 250 },
      { targetId: "tab-wait", selector: ".ready" },
      { loadState: "domcontentloaded" },
      { loadState: "load" },
      { fn: "() => true" },
    ]) {
      it(`wait forwards payload ${Object.keys(body).join(",")}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        const res = await request(app).post("/act").send({ kind: "wait", ...body });
        expect(res.status).toBe(200);
        const expected = { ...body } as Record<string, unknown>;
        const expectedTargetId = typeof expected.targetId === "string" ? expected.targetId : undefined;
        delete expected.targetId;
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            ...(expectedTargetId ? { targetId: expectedTargetId } : {}),
            action: expect.objectContaining(expected),
          }),
        );
      });
    }

    it("response structure verification", async () => {
      const { app } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "wait", selector: ".ready" });
      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });
  });

  describe("POST /act (wait) - Error Handling", () => {
    it("error: missing condition", async () => {
      const { app } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "wait" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("wait requires at least one");
    });

    for (const message of [
      "Timeout 5000ms exceeded",
      "Element never appears",
      "Element never disappears",
      "Text never appears",
      "Browser unavailable",
    ]) {
      it(`surfaces wait failure: ${message}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const res = await request(app).post("/act").send({ kind: "wait", selector: ".ready", timeoutMs: 5000 });
        expect([408, 500]).toContain(res.status);
        expect(res.body.error).toBeTruthy();
      });
    }
  });

  describe("POST /act (navigate) - Basic Functionality", () => {
    for (const body of [
      { url: "https://example.com" },
      { url: "https://example.com", timeoutMs: 10000 },
      { url: "https://example.com", targetId: "tab-nav" },
    ]) {
      it(`navigates with ${Object.keys(body).join(",")}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        const res = await request(app).post("/act").send({ kind: "navigate", ...body });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        const expected = { ...body } as Record<string, unknown>;
        const expectedTargetId = typeof expected.targetId === "string" ? expected.targetId : undefined;
        delete expected.targetId;
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            ...(expectedTargetId ? { targetId: expectedTargetId } : {}),
            action: expect.objectContaining(expected),
          }),
        );
      });
    }

    it("response structure verification", async () => {
      const { app } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "navigate", url: "https://example.com" });
      expect(res.body).toMatchObject({ ok: true, targetId: expect.any(String), url: expect.any(String) });
    });

    it("logging verification - navigate request logged", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      await request(app).post("/act").send({ kind: "navigate", url: "https://example.com" });
      expect(executeActionUseCase.execute).toHaveBeenCalled();
    });
  });

  describe("POST /act (navigate) - Error Handling", () => {
    for (const body of [{ kind: "navigate" }, { kind: "navigate", url: "" }]) {
      it(`rejects invalid navigation payload ${JSON.stringify(body)}`, async () => {
        const { app } = createActionRouteHarness();
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("url is required");
      });
    }

    for (const message of ["Invalid URL format", "navigation timeout", "Browser unavailable"]) {
      it(`surfaces navigation failure: ${message}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const res = await request(app).post("/act").send({ kind: "navigate", url: "https://example.com" });
        expect(res.status).toBe(500);
        expect(res.body.error).toContain(message.split(" ")[0]!);
      });
    }
  });

  describe("POST /act (evaluate) - Basic Functionality", () => {
    for (const body of [
      { fn: "() => 1" },
      { fn: "(el) => el.textContent", ref: "e1" },
      { fn: "() => ({ ok: true })", targetId: "tab-eval" },
    ]) {
      it(`evaluates payload ${Object.keys(body).join(",")}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({
          ok: true,
          targetId: body.targetId ?? "tab-default",
          url: "https://example.org",
          result: body.ref ? "hello" : { ok: true },
        });
        const res = await request(app).post("/act").send({ kind: "evaluate", ...body });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        const expected = { ...body } as Record<string, unknown>;
        const expectedTargetId = typeof expected.targetId === "string" ? expected.targetId : undefined;
        delete expected.targetId;
        expect(executeActionUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            ...(expectedTargetId ? { targetId: expectedTargetId } : {}),
            action: expect.objectContaining(expected),
          }),
        );
      });
    }

    it("response structure verification", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      executeActionUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        url: "https://example.org",
        result: 42,
      });
      const res = await request(app).post("/act").send({ kind: "evaluate", fn: "() => 42" });
      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        url: expect.any(String),
        result: 42,
      });
    });

    it("logging verification - evaluate request logged", async () => {
      const { app, executeActionUseCase } = createActionRouteHarness();
      executeActionUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        url: "https://example.org",
        result: 1,
      });
      await request(app).post("/act").send({ kind: "evaluate", fn: "() => 1" });
      expect(executeActionUseCase.execute).toHaveBeenCalled();
    });
  });

  describe("POST /act (evaluate) - Error Handling", () => {
    it("error: evaluate disabled by config", async () => {
      const { app } = createActionRouteHarness({ evaluateEnabled: false });
      const res = await request(app).post("/act").send({ kind: "evaluate", fn: "() => 1" });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("disabled by config");
    });

    for (const body of [{ kind: "evaluate" }, { kind: "evaluate", fn: "" }]) {
      it(`rejects invalid evaluate payload ${JSON.stringify(body)}`, async () => {
        const { app } = createActionRouteHarness();
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("fn is required");
      });
    }

    for (const message of ["evaluation fails", "Browser unavailable"]) {
      it(`surfaces evaluate failure: ${message}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const res = await request(app).post("/act").send({ kind: "evaluate", fn: "() => 1" });
        expect(res.status).toBe(500);
        expect(res.body.error).toContain(message.split(" ")[0]!);
      });
    }
  });
});
