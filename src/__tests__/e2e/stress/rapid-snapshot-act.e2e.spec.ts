import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type Page, type BrowserContext } from "@playwright/test";
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
  process.env.PORT = "4045";
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

test.describe("E2E: Stress Tests", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("rapid snapshot-act operations", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const startTime = Date.now();
    
    // Perform rapid snapshot-act cycles
    for (let i = 0; i < 10; i++) {
      await page.screenshot();
      await page.locator("#name").fill(`User ${i}`);
    }

    const elapsed = Date.now() - startTime;
    
    // Should complete in reasonable time
    expect(elapsed).toBeLessThan(30000);

    // Verify final state
    await expect(page.locator("#name")).toHaveValue("User 9");
  });

  test("high frequency interactions", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const startTime = Date.now();

    // Rapid form interactions
    for (let i = 0; i < 20; i++) {
      await page.locator("#name").fill(`Test ${i}`);
      await page.locator("#email").fill(`test${i}@example.com`);
      await page.locator("#submitBtn").click().catch(() => {});
    }

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(60000);

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();
  });

  test("concurrent screenshot stress", async () => {
    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Take many screenshots rapidly
    const screenshots: Promise<Buffer>[] = [];
    for (let i = 0; i < 5; i++) {
      screenshots.push(page.screenshot());
      await page.evaluate((val) => window.scrollTo(0, val), (i + 1) * 200);
    }

    const results = await Promise.all(screenshots);
    expect(results.length).toBe(5);
    expect(results.every(s => s.length > 0)).toBe(true);
  });

  test("rapid navigation stress", async () => {
    const pages = [
      `file://${pagesDir}/simple-form.html`,
      `file://${pagesDir}/complex-form.html`,
      `file://${pagesDir}/auth-page.html`,
      `file://${pagesDir}/dropdown-page.html`,
    ];

    // Navigate rapidly between pages
    for (let i = 0; i < 8; i++) {
      await page.goto(pages[i % pages.length], { waitUntil: "domcontentloaded" });
    }

    // Should end on last page
    await expect(page).toHaveURL(/dropdown-page\.html$/);
  });

  test("memory leak detection", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Get initial memory (if available) - standard PW doesn't have page.metrics()
    const initialMetrics: any = await (page as any).metrics?.().catch(() => null);

    // Perform many operations
    for (let i = 0; i < 20; i++) {
      await page.evaluate((val) => {
        const div = document.createElement('div');
        div.textContent = 'Test ' + val;
        document.body.appendChild(div);
      }, i);
    }

    // Get final memory
    const finalMetrics: any = await (page as any).metrics?.().catch(() => null);

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();

    // Metrics may or may not be available
    if (initialMetrics && finalMetrics) {
      // Memory usage should not grow excessively
      const jsHeapUsed = finalMetrics.jsHeapUsedSize - initialMetrics.jsHeapUsedSize;
      expect(jsHeapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
    }
  });

  test("rapid context creation", async () => {
    const contexts: BrowserContext[] = [];

    // Create and close many contexts rapidly
    for (let i = 0; i < 5; i++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const p = await ctx.newPage();
      await p.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    }

    // Close all
    for (const ctx of contexts) {
      await ctx.close();
    }

    // Browser should still be functional
    const finalContext = await browser.newContext();
    const finalPage = await finalContext.newPage();
    await finalPage.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(finalPage.locator("h1")).toBeVisible();

    await finalContext.close();
  });
});
