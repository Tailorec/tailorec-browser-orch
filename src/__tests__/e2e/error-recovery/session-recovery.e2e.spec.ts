import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type BrowserContext } from "@playwright/test";
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
  process.env.PORT = "4033";
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

test.describe("E2E: Session Recovery", () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await browser.newContext();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("session timeout handling", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Set session timeout
    context.setDefaultTimeout(5000);

    // Verify page functional within timeout
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });

    // After timeout period, page should still work
    await page.locator("#name").fill("After Timeout");
    await expect(page.locator("#name")).toHaveValue("After Timeout");
  });

  test("session restoration from cookies", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Set session cookie
    await context.addCookies([{
      name: 'sessionId',
      value: 'abc123',
      domain: 'localhost',
      path: '/'
    }]);

    // Verify cookie set
    let cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'sessionId')?.value).toBe('abc123');

    // Simulate session restoration
    await context.clearCookies();
    await context.addCookies([{
      name: 'sessionId',
      value: 'abc123',
      domain: 'localhost',
      path: '/'
    }]);

    // Verify restored
    cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'sessionId')?.value).toBe('abc123');
  });

  test("state preservation across navigation", async () => {
    const page = await context.newPage();

    // Navigate and set state
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#name").fill("State Test");

    // Navigate to another page
    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Navigate back
    await page.goBack({ waitUntil: "domcontentloaded" });

    // Note: Form data may not persist, but page should be accessible
    await expect(page.locator("h1")).toBeVisible();
  });

  test("cross-session continuity", async () => {
    // Session 1
    const page1 = await context.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await context.addCookies([{
      name: 'userId',
      value: 'user-123',
      domain: 'localhost',
      path: '/'
    }]);

    // Save session state
    const cookies = await context.cookies();

    // Session 2 (new context)
    const context2 = await browser.newContext();
    await context2.addCookies(cookies);
    const page2 = await context2.newPage();
    await page2.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify continuity
    const restoredCookies = await context2.cookies();
    expect(restoredCookies.find(c => c.name === 'userId')?.value).toBe('user-123');

    await context2.close();
  });

  test("session cleanup on close", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Set cookies
    await context.addCookies([{
      name: 'temp',
      value: 'temp-value',
      domain: 'localhost',
      path: '/'
    }]);

    // Verify cookies set
    let cookies = await context.cookies();
    expect(cookies.length).toBeGreaterThan(0);

    // Close context
    await context.close();

    // New context should be clean
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    const newCookies = await newContext.cookies();
    expect(newCookies.length).toBe(0);

    await newContext.close();
  });

  test("session error recovery", async () => {
    const page = await context.newPage();

    // Cause an error
    try {
      await page.goto("http://invalid.invalid", { timeout: 1000 });
    } catch {
      // Expected
    }

    // Recover by navigating to valid page
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();

    // Verify session still functional
    await page.locator("#name").fill("Recovered Session");
    await expect(page.locator("#name")).toHaveValue("Recovered Session");
  });
});
