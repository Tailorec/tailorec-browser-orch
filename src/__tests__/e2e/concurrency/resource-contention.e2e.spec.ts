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
  process.env.PORT = "4044";
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

test.describe("E2E: Resource Contention", () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await browser.newContext();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("concurrent element access", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Multiple operations on same element
    const results = await Promise.allSettled([
      page.locator("#name").fill("Value 1"),
      page.locator("#name").fill("Value 2"),
      page.locator("#name").fill("Value 3"),
      page.locator("#name").inputValue(),
    ]);

    // All should complete
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  });

  test("memory pressure handling", async () => {
    const page = await context.newPage();
    
    // Create memory pressure with multiple screenshots
    const screenshots: Buffer[] = [];
    for (let i = 0; i < 5; i++) {
      await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });
      screenshots.push(await page.screenshot());
    }

    // All screenshots should be captured
    expect(screenshots.length).toBe(5);
    expect(screenshots.every(s => s.length > 0)).toBe(true);
  });

  test("CPU contention handling", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Run CPU-intensive task
    const startTime = Date.now();
    await page.evaluate(() => {
      let sum = 0;
      for (let i = 0; i < 1000000; i++) {
        sum += i;
      }
      return sum;
    });
    const elapsed = Date.now() - startTime;

    // Should complete in reasonable time
    expect(elapsed).toBeLessThan(10000);

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();
  });

  test("network bandwidth simulation", async () => {
    const page = await context.newPage();

    // Simulate limited bandwidth with request delays
    let requestCount = 0;
    await context.route("**/*", async (route) => {
      requestCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
      await route.continue();
    });

    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify requests were made
    expect(requestCount).toBeGreaterThan(0);

    // Page should load
    await expect(page.locator("h1")).toBeVisible();
  });

  test("file descriptor limits", async () => {
    const page = await context.newPage();
    
    // Open and close pages rapidly
    for (let i = 0; i < 3; i++) {
      const newPage = await context.newPage();
      await newPage.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
      await expect(newPage.locator("h1")).toBeVisible();
      await newPage.close();
    }

    // Original page should still work
    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
  });
});
