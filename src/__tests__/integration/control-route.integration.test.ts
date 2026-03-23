import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerBrowserControlRoutes } from "../../browser/routes/control.js";

describe("integration: /control route", () => {
  function app() {
    const a = express();
    registerBrowserControlRoutes(a as any);
    return a;
  }

  it("returns 401 when token missing", async () => {
    const res = await request(app()).get("/control");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "missing_control_token" });
  });

  it("returns 401 for invalid token", async () => {
    const res = await request(app()).get("/control").query({ token: "bad.token.value" });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});
