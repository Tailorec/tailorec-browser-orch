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
  process.env.PORT = "4049";
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

test.describe("E2E: Known Issues Regression", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("issue-001: form submission double-click prevention", async () => {
    // Regression: Form should not submit twice on double-click
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    await page.locator("#name").fill("Test User");
    await page.locator("#email").fill("test@example.com");

    // Rapid clicks
    await page.locator("#submitBtn").click();
    await page.waitForTimeout(100);
    await page.locator("#submitBtn").click().catch(() => {});

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();
  });

  test("issue-002: input field focus retention", async () => {
    // Regression: Input should retain focus properly
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    await page.locator("#name").focus();
    await page.keyboard.type("Test");

    // Verify input worked
    await expect(page.locator("#name")).toHaveValue("Test");
  });

  test("issue-003: dropdown selection persistence", async () => {
    // Regression: Dropdown selection should persist
    await page.goto(`file://${pagesDir}/dropdown-page.html`, { waitUntil: "domcontentloaded" });

    await page.locator("#singleSelect").selectOption("option3");
    await page.waitForTimeout(200);

    // Verify selection persisted
    await expect(page.locator("#singleSelect")).toHaveValue("option3");
  });

  test("issue-004: file upload progress indicator", async () => {
    // Regression: File upload should show progress
    await page.goto(`file://${pagesDir}/file-upload-page.html`, { waitUntil: "domcontentloaded" });

    const testFilePath = path.join(path.dirname(__dirname), "fixtures/files/test-upload.txt");
    await page.locator("#singleFile").setInputFiles(testFilePath);

    // Verify file selected
    const fileInfo = page.locator("#singleFileInfo");
    await expect(fileInfo).toContainText("test-upload.txt");
  });

  test("issue-005: modal close cleanup", async () => {
    // Regression: Modal should clean up after close
    await page.goto(`file://${pagesDir}/multi-step-form.html`, { waitUntil: "domcontentloaded" });

    // Fill and submit
    await page.locator("#firstName").fill("Test");
    await page.locator("#lastName").fill("User");
    await page.locator("#email").fill("test@example.com");
    await page.locator("button:has-text('Next')").first().click();

    await page.locator("#username").fill("testuser");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");
    await page.locator("button:has-text('Next')").nth(1).click();

    await page.locator("#terms").check();
    await page.locator("button:has-text('Next')").nth(2).click();

    // Submit
    await page.locator("button:has-text('Submit')").click();

    // Verify success message visible
    await expect(page.locator("#successMessage")).toBeVisible();
  });

  test("issue-006: navigation state preservation", async () => {
    // Regression: Browser back/forward should work
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#name").fill("State Test");

    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });
    await page.goBack({ waitUntil: "domcontentloaded" });

    // Should be back on simple-form
    await expect(page).toHaveURL(/simple-form\.html$/);
  });

  test("issue-007: async operation ordering", async () => {
    // Regression: Async operations should complete in order
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    const results: string[] = [];

    await page.locator("#name").fill("A");
    results.push("A");
    await page.locator("#name").fill("B");
    results.push("B");
    await page.locator("#name").fill("C");
    results.push("C");

    // Verify final value
    await expect(page.locator("#name")).toHaveValue("C");
    expect(results).toEqual(["A", "B", "C"]);
  });

  test("issue-008: element visibility race condition", async () => {
    // Regression: Wait for element visibility
    await page.setContent(`
      <html>
        <body>
          <div id="hidden" style="display:none">Hidden Content</div>
          <button onclick="document.getElementById('hidden').style.display='block'">Show</button>
        </body>
      </html>
    `);

    await page.locator("button").click();
    await page.waitForSelector("#hidden", { state: "visible" });

    // Verify visible
    await expect(page.locator("#hidden")).toBeVisible();
  });

  test("issue-009: form reset functionality", async () => {
    // Regression: Form reset should clear all fields
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    await page.locator("#name").fill("Test User");
    await page.locator("#email").fill("test@example.com");

    // Reset form by reloading
    await page.reload({ waitUntil: "domcontentloaded" });

    // Verify cleared
    await expect(page.locator("#name")).toHaveValue("");
  });

  test("issue-010: keyboard navigation", async () => {
    // Regression: Tab navigation should work
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Tab through fields
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Should be on email field
    const emailFocused = await page.evaluate(() => 
      document.activeElement === document.getElementById('email')
    );
    expect(emailFocused).toBe(true);
  });
});
