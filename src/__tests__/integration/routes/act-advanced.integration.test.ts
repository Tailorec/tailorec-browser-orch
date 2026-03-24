import request from "supertest";
import { describe, expect, it } from "vitest";
import { createActionRouteHarness } from "./helpers/route-harness.js";

describe("integration: /act - advanced actions", () => {
  describe("hover, scroll, drag, and select", () => {
    for (const body of [
      { kind: "hover", ref: "e1" },
      { kind: "hover", ref: "e1", timeoutMs: 5000 },
      { kind: "hover", ref: "e1", targetId: "tab-hover" },
      { kind: "scrollIntoView", ref: "e1" },
      { kind: "scrollIntoView", ref: "e1", timeoutMs: 5000 },
      { kind: "scrollIntoView", ref: "e1", targetId: "tab-scroll" },
      { kind: "drag", startRef: "e1", endRef: "e2" },
      { kind: "drag", startRef: "e1", endRef: "e2", timeoutMs: 5000 },
      { kind: "drag", startRef: "e1", endRef: "e2", targetId: "tab-drag" },
      { kind: "select", ref: "e1", values: ["a"] },
      { kind: "select", ref: "e1", values: ["a", "b"] },
      { kind: "select", ref: "e1", values: ["a"], timeoutMs: 5000 },
      { kind: "select", ref: "e1", values: ["a"], targetId: "tab-select" },
    ] as const) {
      it(`forwards ${body.kind} payload ${JSON.stringify(body)}`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        const res = await request(app).post("/act").send(body);
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

    for (const body of [
      { kind: "hover" },
      { kind: "scrollIntoView" },
      { kind: "drag", endRef: "e2" },
      { kind: "drag", startRef: "e1" },
      { kind: "select", values: ["a"] },
      { kind: "select", ref: "e1" },
      { kind: "select", ref: "e1", values: [] },
    ]) {
      it(`rejects invalid payload ${JSON.stringify(body)}`, async () => {
        const { app } = createActionRouteHarness();
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(400);
      });
    }

    for (const [kind, message] of [
      ["hover", "element not found"],
      ["scrollIntoView", "element not found"],
      ["drag", "element not found"],
      ["select", "element not found"],
    ] as const) {
      it(`surfaces ${kind} execution failure`, async () => {
        const { app, executeActionUseCase } = createActionRouteHarness();
        executeActionUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const payload =
          kind === "drag"
            ? { kind, startRef: "e1", endRef: "e2" }
            : kind === "select"
              ? { kind, ref: "e1", values: ["a"] }
              : { kind, ref: "e1" };
        const res = await request(app).post("/act").send(payload);
        expect(res.status).toBe(500);
        expect(res.body.error).toContain("element");
      });
    }
  });

  describe("query_state", () => {
    it("queries a single ref", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.queryElementState.mockResolvedValueOnce({ ref: "e1", exists: true, visible: true });
      const res = await request(app).post("/act").send({ kind: "query_state", ref: "e1" });
      expect(res.status).toBe(200);
      expect(res.body.state).toEqual({ ref: "e1", exists: true, visible: true });
    });

    it("queries multiple refs", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.queryElementState
        .mockResolvedValueOnce({ ref: "e1", exists: true })
        .mockResolvedValueOnce({ ref: "e2", exists: false });
      const res = await request(app).post("/act").send({ kind: "query_state", refs: ["e1", "e2"] });
      expect(res.status).toBe(200);
      expect(res.body.states).toHaveLength(2);
    });

    it("returns response structure", async () => {
      const { app } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "query_state", ref: "e1" });
      expect(res.body).toMatchObject({ ok: true, targetId: expect.any(String), state: expect.any(Object) });
    });

    it("supports explicit targetId", async () => {
      const { app, sessionService } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "query_state", ref: "e1", targetId: "tab-state" });
      expect(res.status).toBe(200);
      expect(sessionService.getPage).toHaveBeenCalledWith("tab-state", expect.any(String));
    });

    it("rejects missing ref and refs", async () => {
      const { app } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "query_state" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref or refs is required");
    });

    it("surfaces query_state failures", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.queryElementState.mockRejectedValueOnce(new Error("browser unavailable"));
      const res = await request(app).post("/act").send({ kind: "query_state", ref: "e1" });
      expect(res.status).toBe(500);
      expect(res.body.error).toContain("browser unavailable");
    });
  });

  describe("discover_dropdown and close_dropdown", () => {
    for (const body of [
      { kind: "discover_dropdown", ref: "e1" },
      { kind: "discover_dropdown", ref: "e1", searchText: "abc" },
      { kind: "discover_dropdown", ref: "e1", timeoutMs: 5000 },
      { kind: "close_dropdown", ref: "e1" },
      { kind: "close_dropdown", ref: "e1", targetId: "tab-close" },
    ] as const) {
      it(`supports dropdown action ${body.kind}`, async () => {
        const { app, discoveryService } = createActionRouteHarness();
        if (body.kind === "discover_dropdown") {
          discoveryService.discoverDropdownOptions.mockResolvedValueOnce({
            options: [{ ref: "d1", text: "One" }],
            dropdownOpen: true,
            triggerMethod: "click",
          });
        }
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(200);
      });
    }

    it("returns discover_dropdown response structure", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.discoverDropdownOptions.mockResolvedValueOnce({
        options: [],
        dropdownOpen: false,
        triggerMethod: "none",
      });
      const res = await request(app).post("/act").send({ kind: "discover_dropdown", ref: "e1" });
      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        options: expect.any(Array),
        dropdownOpen: expect.any(Boolean),
      });
    });

    for (const body of [{ kind: "discover_dropdown" }, { kind: "close_dropdown" }]) {
      it(`rejects invalid dropdown payload ${JSON.stringify(body)}`, async () => {
        const { app } = createActionRouteHarness();
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("ref is required");
      });
    }

    for (const [kind, message] of [
      ["discover_dropdown", "Element is not a dropdown"],
      ["discover_dropdown", "Element not found"],
      ["close_dropdown", "Element not found"],
    ] as const) {
      it(`surfaces ${kind} failure: ${message}`, async () => {
        const { app, discoveryService } = createActionRouteHarness();
        if (kind === "discover_dropdown") {
          discoveryService.discoverDropdownOptions.mockRejectedValueOnce(new Error(message));
        } else {
          discoveryService.closeDropdown.mockRejectedValueOnce(new Error(message));
        }
        const res = await request(app).post("/act").send({ kind, ref: "e1" });
        expect(res.status).toBe(500);
        expect(res.body.error).toContain(message.split(":")[0]!);
      });
    }
  });

  describe("detect_blocker and dismiss_blocker", () => {
    it("detects blocker", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.detectBlockingElement.mockResolvedValueOnce({
        isBlocked: true,
        blockerRole: "dialog",
        dismissStrategy: "click_close",
      });
      const res = await request(app).post("/act").send({ kind: "detect_blocker", ref: "e1" });
      expect(res.status).toBe(200);
      expect(res.body.isBlocked).toBe(true);
    });

    it("handles no blocker detected", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.detectBlockingElement.mockResolvedValueOnce({ isBlocked: false });
      const res = await request(app).post("/act").send({ kind: "detect_blocker", ref: "e1" });
      expect(res.status).toBe(200);
      expect(res.body.isBlocked).toBe(false);
    });

    it("dismisses blocker with defaults", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.dismissBlocker.mockResolvedValueOnce({ dismissed: true, strategy: "click_close" });
      const res = await request(app).post("/act").send({ kind: "dismiss_blocker", targetRef: "e1" });
      expect(res.status).toBe(200);
      expect(res.body.dismissed).toBe(true);
    });

    it("dismisses blocker with custom strategy", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      discoveryService.dismissBlocker.mockResolvedValueOnce({ dismissed: true, strategy: "press_escape" });
      const res = await request(app).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
        strategy: "press_escape",
      });
      expect(res.status).toBe(200);
      expect(discoveryService.dismissBlocker).toHaveBeenCalledWith(
        expect.anything(),
        "e1",
        "press_escape",
        undefined,
        expect.any(Function),
      );
    });

    it("dismisses blocker with closeButtonRef", async () => {
      const { app, discoveryService } = createActionRouteHarness();
      await request(app).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
        closeButtonRef: "e2",
      });
      expect(discoveryService.dismissBlocker).toHaveBeenCalledWith(
        expect.anything(),
        "e1",
        undefined,
        "e2",
        expect.any(Function),
      );
    });

    it("returns detect_blocker response structure", async () => {
      const { app } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "detect_blocker", ref: "e1" });
      expect(res.body).toMatchObject({ ok: true, targetId: expect.any(String), isBlocked: expect.any(Boolean) });
    });

    it("returns dismiss_blocker response structure", async () => {
      const { app } = createActionRouteHarness();
      const res = await request(app).post("/act").send({ kind: "dismiss_blocker", targetRef: "e1" });
      expect(res.body).toMatchObject({ ok: true, targetId: expect.any(String), dismissed: expect.any(Boolean) });
    });

    for (const body of [{ kind: "detect_blocker" }, { kind: "dismiss_blocker" }]) {
      it(`rejects invalid blocker payload ${JSON.stringify(body)}`, async () => {
        const { app } = createActionRouteHarness();
        const res = await request(app).post("/act").send(body);
        expect(res.status).toBe(400);
      });
    }

    for (const [kind, message] of [
      ["detect_blocker", "Detection failed"],
      ["dismiss_blocker", "Dismiss failed"],
    ] as const) {
      it(`surfaces ${kind} failure`, async () => {
        const { app, discoveryService } = createActionRouteHarness();
        if (kind === "detect_blocker") {
          discoveryService.detectBlockingElement.mockRejectedValueOnce(new Error(message));
          const res = await request(app).post("/act").send({ kind, ref: "e1" });
          expect(res.status).toBe(500);
        } else {
          discoveryService.dismissBlocker.mockRejectedValueOnce(new Error(message));
          const res = await request(app).post("/act").send({ kind, targetRef: "e1" });
          expect(res.status).toBe(500);
        }
      });
    }
  });
});
