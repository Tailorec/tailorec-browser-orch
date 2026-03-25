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
  process.env.PORT = "4030";
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

test.describe("E2E: Stale Element Recovery", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("element becomes stale during action", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Get element reference
    const nameField = page.locator("#name");

    // Navigate away (making element stale)
    await page.goto("about:blank");

    // Try to use stale reference (should fail or re-resolve)
    let error: Error | null = null;
    try {
      await nameField.fill("test", { timeout: 2000 });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeTruthy();

    // Re-navigate and use fresh reference
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    const freshField = page.locator("#name");
    await freshField.fill("Fresh Reference");
    await expect(freshField).toHaveValue("Fresh Reference");
  });

  test("auto-retry with new reference", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // First attempt
    let attempt1 = page.locator("#name");
    await attempt1.fill("Attempt 1");

    // Refresh page (invalidates reference)
    await page.reload({ waitUntil: "domcontentloaded" });

    // Retry with new reference
    let attempt2 = page.locator("#name");
    await attempt2.fill("Attempt 2");
    await expect(attempt2).toHaveValue("Attempt 2");
  });

  test("re-snapshot before retry", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Take initial screenshot
    const screenshot1 = await page.screenshot();
    expect(screenshot1).toBeTruthy();

    // Fill field
    await page.locator("#name").fill("Before Refresh");

    // Refresh page
    await page.reload({ waitUntil: "domcontentloaded" });

    // Take new screenshot
    const screenshot2 = await page.screenshot();
    expect(screenshot2).toBeTruthy();

    // Verify page functional
    await page.locator("#name").fill("After Refresh");
    await expect(page.locator("#name")).toHaveValue("After Refresh");
  });

  test("stale element error handling", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Get reference
    const element = page.locator("#name");

    // Navigate away
    await page.goto("about:blank");

    // Handle stale element gracefully
    let recovered = false;
    try {
      await element.fill("test", { timeout: 1000 });
    } catch {
      // Recovery: navigate back and use new reference
      await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#name").fill("Recovered");
      recovered = true;
    }

    expect(recovered).toBe(true);
    await expect(page.locator("#name")).toHaveValue("Recovered");
  });

  test("multiple stale attempts", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const maxRetries = 3;
    let success = false;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Try to interact
        await page.locator("#name").fill(`Attempt ${i + 1}`);
        success = true;
        break;
      } catch {
        // Page might have refreshed
        if (i < maxRetries - 1) {
          await page.reload({ waitUntil: "domcontentloaded" });
        }
      }
    }

    expect(success).toBe(true);
  });
});
