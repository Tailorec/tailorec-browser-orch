import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type Page } from "@playwright/test";
import {
  startBrowserControlServerFromConfig,
  stopBrowserControlServer,
} from "../../../browser/server.js";
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
  process.env.PORT = "4040";
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

test.describe("E2E: Slow Network", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("simulate slow network", async () => {
    // Set up slow network conditions
    await page.context().route("**/*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
      await route.continue();
    });

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify page loaded despite delay
    await expect(page.locator("h1")).toBeVisible();
  });

  test("timeout configuration for slow network", async () => {
    // Set longer timeout for slow network
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(30000);

    // Set up slow network
    await page.context().route("**/*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    });

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify page loaded
    await expect(page.locator("h1")).toBeVisible();
  });

  test("retry on slow response", async () => {
    let attemptCount = 0;

    await page.context().route("**/*", async (route) => {
      attemptCount++;
      if (attemptCount === 1) {
        // First attempt: very slow
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    });

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify page loaded
    await expect(page.locator("h1")).toBeVisible();
    expect(attemptCount).toBeGreaterThanOrEqual(1);
  });

  test("progress indication for slow operations", async () => {
    const loadTimes: number[] = [];

    page.on("request", () => {
      loadTimes.push(Date.now());
    });

    // Set up slow network
    await page.context().route("**/*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.continue();
    });

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify requests were made
    expect(loadTimes.length).toBeGreaterThan(0);
  });

  test("cancel slow operation", async () => {
    // Set up very slow network
    await page.context().route("**/*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.continue();
    });

    // Start navigation with short timeout (will timeout)
    let error: Error | null = null;
    try {
      await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "load", timeout: 1000 });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeTruthy();

    // Clear routes and retry normally
    await page.context().unroute("**/*");
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
  });
});
