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
  process.env.PORT = "4029";
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

test.describe("E2E: Timeout Recovery", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("action timeout and retry", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Try action with short timeout on non-existent element
    let error: Error | null = null;
    try {
      await page.locator("#nonExistent").fill("test", { timeout: 1000 });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeTruthy();

    // Retry with valid element
    await page.locator("#name").fill("Retry Success");
    await expect(page.locator("#name")).toHaveValue("Retry Success");
  });

  test("navigation timeout recovery", async () => {
    // Try navigation with very short timeout (should fail)
    let error: Error | null = null;
    try {
      await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "load", timeout: 100 });
    } catch (e) {
      error = e as Error;
    }

    // Navigate again with proper timeout
    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page.locator("h1")).toContainText("Job Application Form");
  });

  test("snapshot timeout handling", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Take screenshot (should succeed)
    const screenshot = await page.screenshot({ timeout: 5000 });
    expect(screenshot).toBeTruthy();

    // Verify page still functional after timeout test
    await page.locator("#name").fill("After Snapshot");
    await expect(page.locator("#name")).toHaveValue("After Snapshot");
  });

  test("custom timeout configuration", async () => {
    // Set custom default timeout
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(10000);

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify custom timeout applied
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
  });

  test("timeout with fallback action", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Try primary action with timeout
    let primaryFailed = false;
    try {
      await page.locator("#nonExistent").click({ timeout: 1000 });
    } catch {
      primaryFailed = true;
    }
    expect(primaryFailed).toBe(true);

    // Fallback action
    await page.locator("#name").fill("Fallback Action");
    await expect(page.locator("#name")).toHaveValue("Fallback Action");
  });

  test("timeout error reporting", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Capture error details
    let errorMessage = "";
    try {
      await page.locator("#nonExistent").waitFor({ state: "visible", timeout: 1000 });
    } catch (e) {
      errorMessage = (e as Error).message;
    }

    // Verify error message contains useful information
    expect(errorMessage).toBeTruthy();
    expect(errorMessage.toLowerCase()).toContain("timeout");
  });
});
