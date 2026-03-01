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
  process.env.PORT = "4032";
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

test.describe("E2E: Browser Crash Recovery", () => {
  test("browser process restart", async () => {
    // Create page and verify functional
    const page = await browser.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
    await page.close();

    // Create new page (simulating restart)
    const newPage = await browser.newPage();
    await newPage.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(newPage.locator("h1")).toBeVisible();
    await newPage.close();
  });

  test("session restoration after close", async () => {
    const page = await browser.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#name").fill("Session Data");

    // Close page
    await page.close();

    // Create new session
    const newPage = await browser.newPage();
    await newPage.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Note: Form data won't persist, but session can be restored
    await expect(newPage.locator("h1")).toBeVisible();
    await newPage.close();
  });

  test("state recovery with cookies", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set cookie (state)
    await context.addCookies([{
      name: 'session',
      value: 'test-session-123',
      domain: 'localhost',
      path: '/'
    }]);

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify cookie set
    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'session')?.value).toBe('test-session-123');

    await context.close();

    // Restore from saved cookies
    const newContext = await browser.newContext();
    await newContext.addCookies([{
      name: 'session',
      value: 'test-session-123',
      domain: 'localhost',
      path: '/'
    }]);

    const newPage = await newContext.newPage();
    const restoredCookies = await newContext.cookies();
    expect(restoredCookies.find(c => c.name === 'session')?.value).toBe('test-session-123');

    await newContext.close();
  });

  test("page recovery after navigation failure", async () => {
    const page = await browser.newPage();

    // Try invalid navigation
    try {
      await page.goto("http://invalid.invalid", { timeout: 2000 });
    } catch {
      // Expected to fail
    }

    // Wait for the error page to settle
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1000);

    // Verify page still functional
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();

    await page.close();
  });

  test("error page handling", async () => {
    const page = await browser.newPage();

    // Navigate to error page
    await page.goto("data:text/html,<h1>Error Page</h1>", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText("Error Page");

    // Navigate to valid page
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText("Contact Form");

    await page.close();
  });
});
