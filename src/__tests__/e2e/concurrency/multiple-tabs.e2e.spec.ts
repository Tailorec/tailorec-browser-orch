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
  process.env.PORT = "4041";
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

test.describe("E2E: Concurrency", () => {
  test("multiple tabs concurrent operations", async () => {
    const context = await browser.newContext();
    
    // Open 3 tabs
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();

    // Navigate all tabs concurrently
    await Promise.all([
      page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" }),
      page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" }),
      page3.goto(`file://${pagesDir}/auth-page.html`, { waitUntil: "domcontentloaded" }),
    ]);

    // Verify all loaded
    await expect(page1.locator("h1")).toContainText("Contact Form");
    await expect(page2.locator("h1")).toContainText("Job Application Form");
    await expect(page3.locator("h1")).toContainText("Authentication Test");

    await context.close();
  });

  test("parallel form filling", async () => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Fill forms in parallel
    await Promise.all([
      page1.locator("#name").fill("User 1"),
      page2.locator("#fullName").fill("User 2"),
    ]);

    // Verify both completed
    await expect(page1.locator("#name")).toHaveValue("User 1");
    await expect(page2.locator("#fullName")).toHaveValue("User 2");

    await context.close();
  });

  test("concurrent navigation", async () => {
    const context = await browser.newContext();
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
    ]);

    // Navigate all pages to different URLs
    await Promise.all(
      pages.map((page, i) => 
        page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" })
      )
    );

    // Verify all loaded
    for (const page of pages) {
      await expect(page.locator("h1")).toContainText("Contact Form");
    }

    await context.close();
  });

  test("shared session across contexts", async () => {
    // Create two contexts with same cookies
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    await context1.addCookies([{
      name: 'sharedSession',
      value: 'abc123',
      domain: 'localhost',
      path: '/'
    }]);

    await context2.addCookies([{
      name: 'sharedSession',
      value: 'abc123',
      domain: 'localhost',
      path: '/'
    }]);

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Verify both have same session
    const cookies1 = await context1.cookies();
    const cookies2 = await context2.cookies();

    expect(cookies1.find(c => c.name === 'sharedSession')?.value).toBe('abc123');
    expect(cookies2.find(c => c.name === 'sharedSession')?.value).toBe('abc123');

    await context1.close();
    await context2.close();
  });

  test("resource contention prevention", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Try concurrent operations on same element
    const results = await Promise.allSettled([
      page.locator("#name").fill("Value 1"),
      page.locator("#name").fill("Value 2"),
      page.locator("#name").fill("Value 3"),
    ]);

    // All should complete (some may overwrite)
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);

    // Final value should be non-empty (it may be concatenated or one of the values)
    const finalValue = await page.locator("#name").inputValue();
    expect(finalValue.length).toBeGreaterThanOrEqual(7);
    expect(finalValue).toContain("Value");

    await context.close();
  });
});
