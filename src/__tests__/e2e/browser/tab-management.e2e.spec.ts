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
  process.env.PORT = "4026";
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

test.describe("E2E: Tab Management", () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await browser.newContext();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("open new tab", async () => {
    // Open initial page
    const page1 = await context.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Open new tab
    const page2 = await context.newPage();
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Verify both pages loaded
    await expect(page1.locator("h1")).toContainText("Contact Form");
    await expect(page2.locator("h1")).toContainText("Job Application Form");

    // Verify tab count
    expect(context.pages()).toHaveLength(2);
  });

  test("switch between tabs", async () => {
    const page1 = await context.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const page2 = await context.newPage();
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Switch to first page
    await page1.bringToFront();
    await expect(page1.locator("h1")).toContainText("Contact Form");

    // Switch to second page
    await page2.bringToFront();
    await expect(page2.locator("h1")).toContainText("Job Application Form");
  });

  test("close tab", async () => {
    const page1 = await context.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const page2 = await context.newPage();
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Verify 2 pages
    expect(context.pages()).toHaveLength(2);

    // Close second page
    await page2.close();

    // Verify 1 page remains
    expect(context.pages()).toHaveLength(1);
    await expect(page1.locator("h1")).toContainText("Contact Form");
  });

  test("multiple tabs open", async () => {
    // Open 3 tabs
    const page1 = await context.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const page2 = await context.newPage();
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    const page3 = await context.newPage();
    await page3.goto(`file://${pagesDir}/auth-page.html`, { waitUntil: "domcontentloaded" });

    // Verify all tabs open
    expect(context.pages()).toHaveLength(3);

    // Verify each tab content
    await expect(page1.locator("h1")).toContainText("Contact Form");
    await expect(page2.locator("h1")).toContainText("Job Application Form");
    await expect(page3.locator("h1")).toContainText("Authentication Test");
  });

  test("tab content verification", async () => {
    const page1 = await context.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const page2 = await context.newPage();
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Fill form in page 1
    await page1.locator("#name").fill("Page 1 User");

    // Fill form in page 2
    await page2.locator("#fullName").fill("Page 2 User");

    // Switch and verify content preserved
    await page1.bringToFront();
    await expect(page1.locator("#name")).toHaveValue("Page 1 User");

    await page2.bringToFront();
    await expect(page2.locator("#fullName")).toHaveValue("Page 2 User");
  });

  test("tab close cleanup", async () => {
    const page1 = await context.newPage();
    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const page2 = await context.newPage();
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    const page3 = await context.newPage();
    await page3.goto(`file://${pagesDir}/auth-page.html`, { waitUntil: "domcontentloaded" });

    // Close middle tab
    await page2.close();

    // Verify remaining tabs
    expect(context.pages()).toHaveLength(2);
    expect(context.pages()).toContain(page1);
    expect(context.pages()).toContain(page3);

    // Verify content still accessible
    await page1.bringToFront();
    await expect(page1.locator("h1")).toContainText("Contact Form");
  });

  test("tab crash recovery", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify page functional
    await expect(page.locator("h1")).toContainText("Contact Form");

    // Close and reopen (simulating crash recovery)
    await page.close();

    const newPage = await context.newPage();
    await newPage.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Verify new page functional
    await expect(newPage.locator("h1")).toContainText("Contact Form");
  });

  test("tab list verification", async () => {
    // Open multiple tabs
    const pages: Page[] = [];
    for (let i = 0; i < 3; i++) {
      const p = await context.newPage();
      await p.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
      pages.push(p);
    }

    // Verify tab count
    expect(context.pages()).toHaveLength(3);

    // Verify all pages in list
    for (const p of context.pages()) {
      expect(pages).toContain(p);
    }

    // Close one tab
    await pages[1].close();

    // Verify updated list
    expect(context.pages()).toHaveLength(2);
  });
});
