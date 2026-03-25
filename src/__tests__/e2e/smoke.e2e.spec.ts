import { createHmac } from "node:crypto";
import { test, expect, request } from "@playwright/test";
import {
  startBrowserControlServerFromConfig,
  stopBrowserControlServer,
} from "./helpers/server-bootstrap.js";

let baseUrl = "";

function b64url(data: string) {
  return Buffer.from(data).toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const body = `${encodedHeader}.${encodedPayload}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

test.beforeAll(async () => {
  process.env.PORT = "4013";
  process.env.BROWSER_HEADLESS = "true";
  process.env.AGENT_RUNTIME_JWT_SECRET = "e2e-secret";

  const state = await startBrowserControlServerFromConfig();
  if (!state) {
    throw new Error("failed to start browser control server for e2e");
  }
  baseUrl = `http://127.0.0.1:${state.port}`;
});

test.afterAll(async () => {
  await stopBrowserControlServer();
});

test("journey: service health via /status", async () => {
  const api = await request.newContext({ baseURL: baseUrl });
  const response = await api.get("/status");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(Array.isArray(body.profiles)).toBe(true);

  await api.dispose();
});

test("journey: interactive control rejects missing token", async () => {
  const api = await request.newContext({ baseURL: baseUrl });
  const response = await api.get("/control");

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({
    ok: false,
    error: "missing_control_token",
  });

  await api.dispose();
});

test("journey: interactive control returns ws_url for valid token", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      exp: now + 600,
      iat: now,
      iss: "tailorec-backend",
      aud: "tailorec-agent-runtime",
      scope: ["browser:control"],
      token_type: "agent_browser_control",
      run_id: "e2e-run-1",
    },
    "e2e-secret",
  );

  const api = await request.newContext({ baseURL: baseUrl });
  const response = await api.get(`/control?token=${encodeURIComponent(token)}&targetId=t-9`);

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.mode).toBe("interactive");
  expect(body.run_id).toBe("e2e-run-1");
  expect(typeof body.ws_url).toBe("string");
  expect(body.ws_url).toContain("/control/live?");
  expect(body.ws_url).toContain("targetId=t-9");

  await api.dispose();
});
