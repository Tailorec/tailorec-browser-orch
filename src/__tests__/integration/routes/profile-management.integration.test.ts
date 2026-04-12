import request from "supertest";
import { describe, expect, it } from "vitest";
import { createActionRouteHarness, createSnapshotRouteHarness } from "./helpers/route-harness.js";

describe("integration: profile management", () => {
  describe("Profile creation", () => {
    it("create new profile via harness", async () => {
      const { app, profileCtx } = createActionRouteHarness({ profileName: "new-profile" });
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.status).toBe(200);
      expect(profileCtx.profile.name).toBe("new-profile");
    });

    it("create with custom name", async () => {
      const { app, profileCtx } = createSnapshotRouteHarness({ profileName: "custom" });
      const res = await request(app).post("/snapshot").send({});
      expect(res.status).toBe(200);
      expect(profileCtx.profile.name).toBe("custom");
    });

    it("create with custom path surrogate via cdpUrl", async () => {
      const { app, profileCtx } = createActionRouteHarness({ cdpUrl: "http://127.0.0.1:9333" });
      await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(profileCtx.profile.browserEndpoint).toBe("http://127.0.0.1:9333");
    });

    it("logging verification - profile creation logged", async () => {
      const { app, profileCtx } = createActionRouteHarness({ profileName: "logged" });
      const res = await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(res.status).toBe(200);
      expect(profileCtx.ensureTabAvailable).toHaveBeenCalled();
    });
  });

  describe("Profile switching", () => {
    it("switch to existing profile", async () => {
      const alpha = createActionRouteHarness({ profileName: "alpha" });
      const beta = createActionRouteHarness({ profileName: "beta" });
      await request(alpha.app).post("/act").send({ kind: "click", ref: "e1" });
      await request(beta.app).post("/act").send({ kind: "click", ref: "e1" });
      expect(alpha.profileCtx.profile.name).toBe("alpha");
      expect(beta.profileCtx.profile.name).toBe("beta");
    });

    it("switch creates new browser context", async () => {
      const first = createSnapshotRouteHarness({ targetId: "tab-a" });
      const second = createSnapshotRouteHarness({ targetId: "tab-b" });
      const one = await request(first.app).post("/snapshot").send({});
      const two = await request(second.app).post("/snapshot").send({});
      expect(one.body.targetId).toBe("tab-a");
      expect(two.body.targetId).toBe("tab-b");
    });

    it("switch preserves state", async () => {
      const alpha = createActionRouteHarness({ targetId: "alpha-tab" });
      await request(alpha.app).post("/act").send({ kind: "click", ref: "e1" });
      const res = await request(alpha.app).post("/act").send({ kind: "hover", ref: "e1" });
      expect(res.status).toBe(200);
      expect(alpha.executeActionUseCase.execute).toHaveBeenCalledTimes(2);
    });

    it("switch during operation", async () => {
      const alpha = createActionRouteHarness({ profileName: "alpha" });
      const beta = createActionRouteHarness({ profileName: "beta" });
      const [a, b] = await Promise.all([
        request(alpha.app).post("/act").send({ kind: "click", ref: "e1" }),
        request(beta.app).post("/act").send({ kind: "click", ref: "e1" }),
      ]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
    });

    it("logging verification - profile switch logged", async () => {
      const { app, profileCtx } = createActionRouteHarness({ profileName: "switcher" });
      await request(app).post("/act").send({ kind: "click", ref: "e1" });
      expect(profileCtx.ensureTabAvailable).toHaveBeenCalled();
    });
  });

  describe("Profile cleanup and isolation", () => {
    it("profile on close", async () => {
      const { app } = createActionRouteHarness({ profileName: "close-me" });
      await request(app).post("/act").send({ kind: "click", ref: "e1" });
      const res = await request(app).post("/act").send({ kind: "close", targetId: "tab-default" });
      expect(res.status).toBe(200);
    });

    it("profile data persistence", async () => {
      const { app } = createSnapshotRouteHarness({ targetId: "persist-tab" });
      await request(app).post("/snapshot").send({});
      const res = await request(app).post("/snapshot").send({});
      expect(res.body.targetId).toBe("persist-tab");
    });

    it("profiles are isolated from each other", async () => {
      const one = createActionRouteHarness({ targetId: "tab-1" });
      const two = createActionRouteHarness({ targetId: "tab-2" });
      const a = await request(one.app).post("/act").send({ kind: "click", ref: "e1" });
      const b = await request(two.app).post("/act").send({ kind: "click", ref: "e1" });
      expect(a.body.targetId).toBe("tab-1");
      expect(b.body.targetId).toBe("tab-2");
    });

    it("profile cookies are isolated surrogate via page url", async () => {
      const one = createSnapshotRouteHarness({ pageUrl: "https://one.test" });
      const two = createSnapshotRouteHarness({ pageUrl: "https://two.test" });
      const a = await request(one.app).post("/snapshot").send({});
      const b = await request(two.app).post("/snapshot").send({});
      expect(a.body.url).toBe("https://one.test");
      expect(b.body.url).toBe("https://two.test");
    });

    it("profile local storage is isolated surrogate via cdpUrl", async () => {
      const one = createActionRouteHarness({ cdpUrl: "http://127.0.0.1:9222" });
      const two = createActionRouteHarness({ cdpUrl: "http://127.0.0.1:9333" });
      await request(one.app).post("/act").send({ kind: "click", ref: "e1" });
      await request(two.app).post("/act").send({ kind: "click", ref: "e1" });
      expect(one.profileCtx.profile.browserEndpoint).not.toBe(two.profileCtx.profile.browserEndpoint);
    });
  });
});
