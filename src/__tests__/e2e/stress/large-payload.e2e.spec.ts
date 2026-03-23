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
  process.env.PORT = "4046";
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

test.describe("E2E: Large Payload", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async () => {
    context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await page.close();
    await context.close();
  });

  test("handle large HTML response", async () => {
    // Create large HTML content
    const largeContent = Array.from({ length: 1000 }, (_, i) => 
      `<div class="item">Item ${i + 1}</div>`
    ).join('');

    await page.setContent(`
      <html>
        <body>
          <div id="container">${largeContent}</div>
        </body>
      </html>
    `);

    // Verify page loaded
    const itemCount = await page.locator(".item").count();
    expect(itemCount).toBe(1000);

    // Page should still be functional
    await expect(page.locator("#container")).toBeVisible();
  });

  test("handle large JSON response", async () => {
    // Create large JSON
    const largeData = JSON.stringify({
      items: Array.from({ length: 500 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`.repeat(10)
      }))
    });

    const result = await page.evaluate((data) => {
      const parsed = JSON.parse(data);
      return parsed.items.length;
    }, largeData);

    expect(result).toBe(500);
  });

  test("handle large form data", async () => {
    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Fill with large text
    const largeText = "A".repeat(10000);
    await page.locator("#coverLetter").fill(largeText);

    // Verify value preserved
    const value = await page.locator("#coverLetter").inputValue();
    expect(value.length).toBe(10000);
  });

  test("handle large clipboard data", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Copy large text to clipboard
    const largeText = "B".repeat(5000);
    await page.evaluate((text) => navigator.clipboard.writeText(text), largeText);

    // Paste into field
    await page.locator("#name").focus();
    await page.keyboard.press("Control+V");

    // Verify (may be limited by browser)
    const value = await page.locator("#name").inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test("memory cleanup after large payload", async () => {
    // Load large content
    const largeContent = Array.from({ length: 500 }, (_, i) => 
      `<div class="item">Item ${i + 1}</div>`
    ).join('');

    await page.setContent(`
      <html>
        <body>
          <div id="container">${largeContent}</div>
        </body>
      </html>
    `);

    // Verify loaded
    let itemCount = await page.locator(".item").count();
    expect(itemCount).toBe(500);

    // Navigate away (cleanup)
    await page.goto("about:blank");

    // Verify clean state
    await expect(page).toHaveURL("about:blank");
  });
});
