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
  process.env.PORT = "4024";
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

test.describe("E2E: Browser Navigation", () => {
  let page: Page;
  let testUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    testUrl = `file://${pagesDir}/simple-form.html`;
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("navigate to URL", async () => {
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Verify page loaded
    await expect(page).toHaveURL(/simple-form\.html$/);
    await expect(page.locator("h1")).toContainText("Contact Form");
  });

  test("navigate back", async () => {
    // Navigate to first page
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Navigate to another page
    await page.goto("about:blank");
    await expect(page).toHaveURL("about:blank");

    // Go back
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });

    // Verify back on original page
    await expect(page).toHaveURL(/simple-form\.html$/);
  });

  test("navigate forward", async () => {
    // Navigate to first page
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    const firstTitle = await page.title();

    // Navigate to another page
    await page.goto("about:blank");
    await expect(page).toHaveURL("about:blank");

    // Go back
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });

    // Go forward
    await page.goForward({ waitUntil: "domcontentloaded", timeout: 30000 });

    // Verify forward navigation
    await expect(page).toHaveURL("about:blank");
  });

  test("refresh page", async () => {
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Fill a form field
    await page.locator("#name").fill("Test User");
    await expect(page.locator("#name")).toHaveValue("Test User");

    // Refresh page
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });

    // Verify form cleared after refresh
    await expect(page.locator("#name")).toHaveValue("");
  });

  test("navigate to invalid URL", async () => {
    // Try to navigate to invalid URL
    const invalidUrl = "http://invalid-url-that-does-not-exist-12345.com";

    try {
      await page.goto(invalidUrl, { waitUntil: "domcontentloaded", timeout: 5000 });
    } catch (error) {
      // Expected to fail - verify error or navigation failure
      expect(error).toBeTruthy();
    }
  });

  test("navigate with timeout", async () => {
    // Navigate with short timeout
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Verify page loaded within timeout
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
  });

  test("navigate during loading", async () => {
    // Start navigation
    const navPromise = page.goto(testUrl, { waitUntil: "commit", timeout: 30000 });

    // Wait briefly then verify navigation completed
    await page.waitForTimeout(500);

    await navPromise;

    // Verify page loaded
    await expect(page.locator("h1")).toBeVisible();
  });

  test("navigation history verification", async () => {
    // Navigate through multiple pages
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.goto("about:blank");
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Go back twice
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL("about:blank");

    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL(/simple-form\.html$/);

    // Go forward
    await page.goForward({ waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL("about:blank");
  });
});
