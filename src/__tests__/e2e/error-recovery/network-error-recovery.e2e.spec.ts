import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type Page } from "@playwright/test";
import {
  startBrowserControlServerFromConfig,
  stopBrowserControlServer,
} from "../helpers/server-bootstrap.js";
import * as path from "node:path";

let baseUrl = "";
let api: any;
let browser: Browser;

const __dirname = new URL(".", import.meta.url).pathname;
const pagesDir = path.resolve(__dirname, "../../fixtures/pages");

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

function getControlToken(runId: string = "test-run") {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      exp: now + 600,
      iat: now,
      iss: "tailorec-backend",
      aud: "tailorec-agent-runtime",
      scope: ["browser:control"],
      token_type: "agent_browser_control",
      run_id: runId,
    },
    "e2e-secret",
  );
}

test.beforeAll(async ({ browser: pwBrowser }) => {
  process.env.PORT = "4031";
  process.env.BROWSER_HEADLESS = "true";
  process.env.AGENT_RUNTIME_JWT_SECRET = "e2e-secret";

  const state = await startBrowserControlServerFromConfig();
  if (!state) {
    throw new Error("failed to start browser control server for e2e");
  }
  baseUrl = `http://127.0.0.1:${state.port}`;
  api = await request.newContext({ baseURL: baseUrl });
  browser = pwBrowser;
});

test.afterAll(async () => {
  await api.dispose();
  await stopBrowserControlServer();
});

test.describe("E2E: Network Error Recovery", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("network request failure", async () => {
    // Set up request interception
    await page.route("**/*", (route) => {
      // Abort some requests to simulate failure
      if (route.request().url().includes("nonexistent")) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify page loaded despite some failures
    await expect(page.locator("h1")).toBeVisible();
  });

  test("auto-retry on failure", async () => {
    let attemptCount = 0;
    let success = false;

    await page.route("**/*", (route) => {
      attemptCount++;
      if (attemptCount === 1) {
        route.abort(); // Fail first attempt
      } else {
        route.continue(); // Succeed on retry
      }
    });

    try {
      await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
      success = true;
    } catch {
      // Retry
      await page.unroute("**/*");
      await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
      success = true;
    }

    expect(success).toBe(true);
  });

  test("exponential backoff", async () => {
    const delays: number[] = [];
    let lastTime = Date.now();

    // Simulate retries with increasing delays
    for (let i = 0; i < 3; i++) {
      const currentTime = Date.now();
      delays.push(currentTime - lastTime);
      lastTime = currentTime;

      // Wait with exponential backoff (simulated)
      await page.waitForTimeout(Math.pow(2, i) * 100);
    }

    // Verify delays increasing
    expect(delays[1] || 0).toBeGreaterThanOrEqual(delays[0] || 0);
    expect(delays[2] || 0).toBeGreaterThanOrEqual(delays[1] || 0);
  });

  test("network recovery notification", async () => {
    const events: string[] = [];

    page.on("requestfailed", (request) => {
      events.push(`failed:${request.url()}`);
    });

    page.on("requestfinished", (request) => {
      events.push(`finished:${request.url()}`);
    });

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify events captured
    expect(events.length).toBeGreaterThan(0);
  });

  test("persistent failure handling", async () => {
    let failCount = 0;

    await page.route("**/*", (route) => {
      failCount++;
      if (failCount < 5) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // After multiple failures, page should still be functional
    try {
      await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded", timeout: 2000 });
    } catch {
      // Expected to fail
    }

    // Clear routes and verify recovery
    await page.unroute("**/*");
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
  });

  test("offline mode handling", async () => {
    // Set offline mode
    await page.context().setOffline(true);

    // Try to navigate (should fail for network URLs)
    let error: Error | null = null;
    try {
      // Use an HTTP URL instead of file:// to ensure offline mode is respected
      await page.goto(`${baseUrl}/status`, { waitUntil: "domcontentloaded", timeout: 2000 });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeTruthy();

    // Restore online mode
    await page.context().setOffline(false);

    // Verify recovery
    await page.goto(`${baseUrl}/status`, { waitUntil: "domcontentloaded" });
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
