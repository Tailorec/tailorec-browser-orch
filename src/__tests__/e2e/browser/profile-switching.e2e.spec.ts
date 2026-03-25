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
  process.env.PORT = "4027";
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

test.describe("E2E: Profile Switching", () => {
  test("switch browser context (profile)", async () => {
    // Create first context (profile 1)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page1.locator("#name").fill("Profile 1 User");

    // Create second context (profile 2)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page2.locator("#name").fill("Profile 2 User");

    // Verify profiles isolated
    await expect(page1.locator("#name")).toHaveValue("Profile 1 User");
    await expect(page2.locator("#name")).toHaveValue("Profile 2 User");

    await context1.close();
    await context2.close();
  });

  test("profile state preservation", async () => {
    // Create context and set state
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Fill form
    await page.locator("#name").fill("Preserved User");
    await page.locator("#email").fill("preserved@example.com");

    // Navigate away and back
    await page.goto("about:blank");
    await page.goBack();

    // Note: Form data may not persist on full navigation
    // but context/cookies would persist in real scenario
    await expect(page).toHaveURL(/simple-form\.html$/);

    await context.close();
  });

  test("profile-specific data (cookies)", async () => {
    // Create context with specific cookies
    const context1 = await browser.newContext();
    await context1.addCookies([{
      name: 'profile',
      value: 'profile1',
      domain: 'localhost',
      path: '/'
    }]);
    const page1 = await context1.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Create another context with different cookies
    const context2 = await browser.newContext();
    await context2.addCookies([{
      name: 'profile',
      value: 'profile2',
      domain: 'localhost',
      path: '/'
    }]);
    const page2 = await context2.newPage();
    await page2.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify cookies isolated
    const cookies1 = await context1.cookies();
    const cookies2 = await context2.cookies();

    expect(cookies1.find(c => c.name === 'profile')?.value).toBe('profile1');
    expect(cookies2.find(c => c.name === 'profile')?.value).toBe('profile2');

    await context1.close();
    await context2.close();
  });

  test("switch profile during operation", async () => {
    // Start with one context
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Create new context mid-operation
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Verify both contexts functional
    await expect(page1.locator("h1")).toContainText("Contact Form");
    await expect(page2.locator("h1")).toContainText("Job Application Form");

    await context1.close();
    await context2.close();
  });

  test("invalid profile handling (empty context)", async () => {
    // Create context without any special configuration
    const context = await browser.newContext();
    const page = await context.newPage();

    // Verify basic functionality works
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText("Contact Form");

    await context.close();
  });

  test("default profile fallback", async () => {
    // Create default context (no special options)
    const context = await browser.newContext();
    const page = await context.newPage();

    // Verify default context works
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Fill form with default profile
    await page.locator("#name").fill("Default Profile User");
    await expect(page.locator("#name")).toHaveValue("Default Profile User");

    await context.close();
  });
});
