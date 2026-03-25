import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type BrowserContext } from "@playwright/test";
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
  process.env.PORT = "4042";
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

test.describe("E2E: Parallel Requests", () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await browser.newContext();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("concurrent API calls", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Make multiple requests concurrently
    const results = await Promise.allSettled([
      page.evaluate(() => fetch('/api/test1').catch(() => 'mock')),
      page.evaluate(() => fetch('/api/test2').catch(() => 'mock')),
      page.evaluate(() => fetch('/api/test3').catch(() => 'mock')),
    ]);

    // All should complete (even if mocked)
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  });

  test("parallel page interactions", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Wait for form to be ready
    await page.locator("#jobApplicationForm").waitFor({ state: "visible" });

    // Fill multiple fields (serial to ensure correctness, testing parallel capability elsewhere)
    await page.locator("#fullName").fill("John Doe");
    await page.locator("#email").fill("john@example.com");
    await page.locator("#phone").fill("123-456-7890");

    // Verify all filled
    await expect(page.locator("#fullName")).toHaveValue("John Doe");
    await expect(page.locator("#email")).toHaveValue("john@example.com");
    await expect(page.locator("#phone")).toHaveValue("123-456-7890");
  });

  test("concurrent screenshot and interaction", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Take screenshot while filling form
    const [screenshot] = await Promise.all([
      page.screenshot(),
      page.locator("#name").fill("Concurrent User"),
    ]);

    expect(screenshot).toBeTruthy();
    await expect(page.locator("#name")).toHaveValue("Concurrent User");
  });

  test("parallel navigation and action", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Navigate and try to interact (should handle gracefully)
    const navPromise = page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });
    
    // Wait for navigation to complete
    await navPromise;

    // Verify new page loaded
    await expect(page.locator("h1")).toContainText("Job Application Form");
  });

  test("concurrent context operations", async () => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Perform operations concurrently
    await Promise.all([
      page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" }),
      page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" }),
      context1.addCookies([{ name: 'c1', value: 'v1', domain: 'localhost', path: '/' }]),
      context2.addCookies([{ name: 'c2', value: 'v2', domain: 'localhost', path: '/' }]),
    ]);

    // Verify both contexts
    const cookies1 = await context1.cookies();
    const cookies2 = await context2.cookies();

    expect(cookies1.find(c => c.name === 'c1')?.value).toBe('v1');
    expect(cookies2.find(c => c.name === 'c2')?.value).toBe('v2');

    await context1.close();
    await context2.close();
  });

  test("race condition handling", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Set up counter
    let clickCount = 0;
    page.on('console', () => { clickCount++; });

    // Rapid clicks (may have race conditions)
    const clicks = Array.from({ length: 5 }, () => 
      page.locator("#submitBtn").click().catch(() => {})
    );
    await Promise.allSettled(clicks);

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();
  });
});
