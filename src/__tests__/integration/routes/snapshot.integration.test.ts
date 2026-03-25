import request from "supertest";
import { describe, expect, it } from "vitest";
import { createSnapshotRouteHarness } from "./helpers/route-harness.js";

describe("integration: /snapshot routes", () => {
  const makeHarness = () => createSnapshotRouteHarness();

  describe("POST /snapshot - Basic Functionality", () => {
    it("basic request without options", async () => {
      const { app, takeSnapshotUseCase } = makeHarness();
      takeSnapshotUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        url: "https://example.org",
        snapshot: "# Heading\n\n- button \"Click me\"",
        refs: { d1: { role: "button", name: "Click me" } },
      });

      const res = await request(app).post("/snapshot").send({});

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.targetId).toBe("tab-default");
      expect(res.body.url).toBe("https://example.org");
      expect(res.body.snapshot).toContain("Click me");
      expect(res.body.refs).toEqual({ d1: { role: "button", name: "Click me" } });
    });

    it("request with explicit targetId", async () => {
      const { app, takeSnapshotUseCase } = makeHarness();
      const res = await request(app).post("/snapshot").send({ targetId: "tab-123" });
      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-123");
      expect(takeSnapshotUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: "tab-123" }),
      );
    });

    it("response structure matches contract", async () => {
      const { app, takeSnapshotUseCase } = makeHarness();
      takeSnapshotUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        url: "https://example.org",
        snapshot: "# Test",
        refs: { r1: { role: "link" } },
        truncated: false,
      });
      const res = await request(app).post("/snapshot").send({});
      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        url: expect.any(String),
        snapshot: expect.any(String),
        refs: expect.any(Object),
      });
    });

    it("refs in response are properly structured", async () => {
      const { app, takeSnapshotUseCase } = makeHarness();
      takeSnapshotUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        url: "https://example.org",
        snapshot: "# App\n- button \"Submit\"",
        refs: {
          d1: { role: "button", name: "Submit" },
          d2: { role: "link", name: "Home" },
          d3: { role: "textbox", name: "Email" },
        },
      });
      const res = await request(app).post("/snapshot").send({});
      expect(res.body.refs.d1).toEqual({ role: "button", name: "Submit" });
      expect(res.body.refs.d2).toEqual({ role: "link", name: "Home" });
      expect(res.body.refs.d3).toEqual({ role: "textbox", name: "Email" });
    });

    it("logging verification - snapshot request logged", async () => {
      const { app, takeSnapshotUseCase } = makeHarness();
      const res = await request(app).post("/snapshot").send({ targetId: "tab-log" });
      expect(res.status).toBe(200);
      expect(takeSnapshotUseCase.execute).toHaveBeenCalled();
    });
  });

  describe("POST /snapshot - Options", () => {
    for (const [payload, expected] of [
      [{ timeoutMs: 3000 }, { timeoutMs: 3000 }],
      [{ maxChars: 5000 }, { maxChars: 5000 }],
      [{ interactiveOnly: true }, { interactiveOnly: true }],
      [{ compact: true }, { compact: true }],
      [{ maxDepth: 5 }, { maxDepth: 5 }],
    ] as const) {
      it(`forwards ${Object.keys(payload)[0]}`, async () => {
        const { app, takeSnapshotUseCase } = makeHarness();
        const res = await request(app).post("/snapshot").send(payload);
        expect(res.status).toBe(200);
        expect(takeSnapshotUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining(expected),
          }),
        );
      });
    }
  });

  describe("POST /snapshot - Edge Cases", () => {
    it("truncated response when maxChars exceeded", async () => {
      const { app, takeSnapshotUseCase } = makeHarness();
      takeSnapshotUseCase.execute.mockResolvedValueOnce({
        ok: true,
        targetId: "tab-default",
        url: "https://example.org",
        snapshot: "short\n\n[...TRUNCATED - page too large]",
        truncated: true,
        refs: { d1: { role: "button" } },
      });
      const res = await request(app).post("/snapshot").send({ maxChars: 100 });
      expect(res.status).toBe(200);
      expect(res.body.truncated).toBe(true);
      expect(res.body.snapshot).toContain("[...TRUNCATED - page too large]");
    });

    for (const result of [
      { snapshot: "", refs: {} },
      { snapshot: "# Large Page\n" + "- ".repeat(500) + "item", refs: {} },
      {
        snapshot: "# Dynamic\n- button \"Load More\"\n- list \"Items\"",
        refs: { d1: { role: "button" }, d2: { role: "list" } },
      },
      { snapshot: "# Main\n- iframe \"Embedded Content\"", refs: { d1: { role: "iframe" } } },
    ]) {
      it(`handles snapshot payload ${result.snapshot.slice(0, 12) || "empty"}`, async () => {
        const { app, takeSnapshotUseCase } = makeHarness();
        takeSnapshotUseCase.execute.mockResolvedValueOnce({
          ok: true,
          targetId: "tab-default",
          url: "https://example.org",
          ...result,
        });
        const res = await request(app).post("/snapshot").send({});
        expect(res.status).toBe(200);
        expect(res.body.snapshot).toBe(result.snapshot);
        expect(res.body.refs).toEqual(result.refs);
      });
    }
  });

  describe("POST /snapshot - Error Handling", () => {
    for (const message of [
      "Browser unavailable",
      "Timeout 5000ms exceeded",
      "Invalid options provided",
      "Target not found: invalid-tab",
      "Snapshot failed",
    ]) {
      it(`error: ${message}`, async () => {
        const { app, takeSnapshotUseCase } = makeHarness();
        takeSnapshotUseCase.execute.mockResolvedValueOnce({ ok: false, error: message });
        const res = await request(app).post("/snapshot").send({
          targetId: message.includes("Target") ? "invalid-tab" : undefined,
          timeoutMs: message.includes("Timeout") ? 5000 : undefined,
        });
        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toContain(message.split(":")[0]!);
      });
    }
  });

  describe("POST /snapshot/delta - Start/Stop Observation", () => {
    it("start action begins DOM observation", async () => {
      const { app, discoveryService } = makeHarness();
      const res = await request(app).post("/snapshot/delta").send({ action: "start" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.observing).toBe(true);
      expect(discoveryService.startDomObserver).toHaveBeenCalled();
    });

    it("stop action returns delta payload", async () => {
      const { app, discoveryService } = makeHarness();
      discoveryService.stopDomObserver.mockResolvedValueOnce({
        addedElements: [
          { ref: "e1", role: "button", text: "Buy" },
          { ref: "e2", role: "link", text: "Details" },
        ],
        removedElements: [],
      });
      const res = await request(app).post("/snapshot/delta").send({ action: "stop", anchorRef: "e99" });
      expect(res.status).toBe(200);
      expect(res.body.addedElements).toHaveLength(2);
      expect(res.body.addedElements[0]).toEqual({ ref: "e1", role: "button", text: "Buy" });
    });

    it("invalid action returns 400 error", async () => {
      const { app } = makeHarness();
      const res = await request(app).post("/snapshot/delta").send({ action: "pause" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("action must be 'start' or 'stop'");
    });

    it("anchorRef support in stop action", async () => {
      const { app, discoveryService } = makeHarness();
      await request(app).post("/snapshot/delta").send({ action: "start", anchorRef: "anchor-123" });
      expect(discoveryService.startDomObserver).toHaveBeenCalledWith(
        expect.anything(),
        "anchor-123",
        expect.any(Function),
      );
    });

    it("error handling for delta route", async () => {
      const { app, discoveryService } = makeHarness();
      discoveryService.startDomObserver.mockRejectedValueOnce(new Error("DOM observation failed"));
      const res = await request(app).post("/snapshot/delta").send({ action: "start" });
      expect(res.status).toBe(500);
      expect(res.body.error).toContain("DOM observation failed");
    });
  });

  describe("POST /snapshot/delta - Edge Cases", () => {
    for (const payload of [
      { addedElements: [], removedElements: [] },
      { addedElements: [], removedElements: [{ ref: "e1", role: "button" }] },
      {
        addedElements: [{ ref: "e1" }, { ref: "e2" }, { ref: "e3" }],
        removedElements: [{ ref: "e4" }, { ref: "e5" }],
      },
    ]) {
      it(`handles delta payload added=${payload.addedElements.length} removed=${payload.removedElements.length}`, async () => {
        const { app, discoveryService } = makeHarness();
        discoveryService.stopDomObserver.mockResolvedValueOnce(payload);
        const res = await request(app).post("/snapshot/delta").send({ action: "stop" });
        expect(res.status).toBe(200);
        expect(res.body.addedElements).toHaveLength(payload.addedElements.length);
        expect(res.body.removedElements).toHaveLength(payload.removedElements.length);
      });
    }

    it("delta without anchorRef uses default", async () => {
      const { app, discoveryService } = makeHarness();
      const res = await request(app).post("/snapshot/delta").send({ action: "start" });
      expect(res.status).toBe(200);
      expect(discoveryService.startDomObserver).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        expect.any(Function),
      );
    });

    it("delta with explicit targetId", async () => {
      const { app, sessionService } = makeHarness();
      const res = await request(app).post("/snapshot/delta").send({
        action: "start",
        targetId: "tab-delta-123",
      });
      expect(res.status).toBe(200);
      expect(sessionService.getPage).toHaveBeenCalledWith("tab-delta-123", expect.any(String));
    });
  });
});
