import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startBrowserControlServerFromConfig,
  stopBrowserControlServer,
} from "../../browser/server.js";

let baseUrl = "";

describe("integration: status route", () => {
  beforeAll(async () => {
    process.env.PORT = "4011";
    process.env.BROWSER_HEADLESS = "true";

    const state = await startBrowserControlServerFromConfig();
    if (!state) {
      throw new Error("failed to start browser control server");
    }
    baseUrl = `http://127.0.0.1:${state.port}`;
  });

  afterAll(async () => {
    await stopBrowserControlServer();
  });

  it("GET /status returns ok", async () => {
    const response = await request(baseUrl).get("/status");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(Array.isArray(response.body.profiles)).toBe(true);
  });
});
