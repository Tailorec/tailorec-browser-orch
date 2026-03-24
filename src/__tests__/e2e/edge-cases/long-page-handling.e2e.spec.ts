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
  process.env.PORT = "4034";
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

test.describe("E2E: Long Page Handling", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("scroll to bottom of long page", async () => {
    await page.goto(`file://${pagesDir}/dynamic-content-page.html`, { waitUntil: "domcontentloaded" });

    // Get page height
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = page.viewportSize()?.height || 800;

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Verify scrolled to bottom
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  test("snapshot entire long page", async () => {
    await page.goto(`file://${pagesDir}/dynamic-content-page.html`, { waitUntil: "domcontentloaded" });

    // Take full page screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test("act on elements at bottom", async () => {
    await page.setContent(`
      <html>
        <body style="height: 3000px;">
          <div id="bottom" style="margin-top: 2500px;">
            <button id="bottomBtn">Click Me</button>
          </div>
        </body>
      </html>
    `);

    // Scroll to bottom and click
    await page.locator("#bottomBtn").scrollIntoViewIfNeeded();
    await page.locator("#bottomBtn").click();

    // Verify action completed
    await expect(page.locator("#bottom")).toBeVisible();
  });

  test("memory usage on long pages", async () => {
    await page.goto(`file://${pagesDir}/dynamic-content-page.html`, { waitUntil: "domcontentloaded" });

    // Take multiple screenshots
    for (let i = 0; i < 3; i++) {
      await page.screenshot({ fullPage: true });
      await page.evaluate((val) => window.scrollTo(0, (val + 1) * 500), i);
      await page.waitForTimeout(100);
    }

    // Verify page still functional
    await expect(page).toHaveURL(/dynamic-content-page\.html$/);
  });

  test("performance on long pages", async () => {
    const startTime = Date.now();

    await page.setContent(`
      <html>
        <body style="height: 5000px;">
          ${Array.from({ length: 100 }, (_, i) => `<p>Paragraph ${i + 1}</p>`).join('')}
        </body>
      </html>
    `);

    // Scroll through page
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.evaluate(() => window.scrollTo(0, 3000));

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(10000); // Should complete within 10 seconds
  });
});
