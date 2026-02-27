import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerBrowserControlRoutes } from "../../browser/routes/control.js";

describe("contract: GET /control", () => {
  it("returns stable contract for missing token", async () => {
    const app = express();
    registerBrowserControlRoutes(app as any);

    const res = await request(app).get("/control");

    expect(res.status).toBe(401);
    expect(res.body).toStrictEqual({
      ok: false,
      error: "missing_control_token",
    });
  });
});
