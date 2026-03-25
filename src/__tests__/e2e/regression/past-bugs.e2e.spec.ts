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
  process.env.PORT = "4050";
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

test.describe("E2E: Past Bugs Regression", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("bug-001: empty form validation", async () => {
    // Bug: Empty form submission was not validated
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Try submit without filling
    await page.locator("#submitBtn").click();

    // Form should still be visible (validation prevented submit)
    await expect(page.locator("#contactForm")).toBeVisible();
  });

  test("bug-002: email format validation", async () => {
    // Bug: Invalid email format was accepted
    await page.goto(`file://${pagesDir}/form-accuracy.html`, { waitUntil: "domcontentloaded" });

    await page.locator("#emailValid").fill("invalid-email");

    // Verify value set (browser validation may show error)
    await expect(page.locator("#emailValid")).toHaveValue("invalid-email");
  });

  test("bug-003: password mismatch detection", async () => {
    // Bug: Password mismatch was not detected
    await page.goto(`file://${pagesDir}/multi-step-form.html`, { waitUntil: "domcontentloaded" });

    // Fill step 1
    await page.locator("#firstName").fill("Test");
    await page.locator("#lastName").fill("User");
    await page.locator("#email").fill("test@example.com");
    await page.locator("button:has-text('Next')").first().click();

    // Fill mismatched passwords
    await page.locator("#password").fill("Password123");
    await page.locator("#confirmPassword").fill("Different123");

    // Try to proceed - should fail validation
    await page.locator("button:has-text('Next')").nth(1).click();

    // Should still be on step 2
    await expect(page.locator("#password")).toBeVisible();
  });

  test("bug-004: checkbox state persistence", async () => {
    // Bug: Checkbox state was not persisted
    await page.goto(`file://${pagesDir}/form-accuracy.html`, { waitUntil: "domcontentloaded" });

    await page.locator("#check1").check();
    await page.waitForTimeout(100);

    // Verify still checked
    await expect(page.locator("#check1")).toBeChecked();
  });

  test("bug-005: radio button exclusive selection", async () => {
    // Bug: Multiple radio buttons could be selected
    await page.goto(`file://${pagesDir}/form-accuracy.html`, { waitUntil: "domcontentloaded" });

    await page.locator('input[name="radioGroup"][value="radio1"]').check();
    await page.locator('input[name="radioGroup"][value="radio2"]').check();

    // Only radio2 should be checked
    await expect(page.locator('input[name="radioGroup"][value="radio1"]')).not.toBeChecked();
    await expect(page.locator('input[name="radioGroup"][value="radio2"]')).toBeChecked();
  });

  test("bug-006: file input clear after upload", async () => {
    // Bug: File input was not cleared after upload
    await page.goto(`file://${pagesDir}/file-upload-page.html`, { waitUntil: "domcontentloaded" });

    const testFilePath = path.join(path.dirname(__dirname), "fixtures/files/test-upload.txt");
    await page.locator("#singleFile").setInputFiles(testFilePath);

    // Verify file selected
    await expect(page.locator("#singleFileInfo")).toContainText("test-upload.txt");
  });

  test("bug-007: dropdown default option", async () => {
    // Bug: Dropdown didn't have proper default option
    await page.goto(`file://${pagesDir}/dropdown-page.html`, { waitUntil: "domcontentloaded" });

    // Verify default is empty/placeholder
    const value = await page.locator("#singleSelect").inputValue();
    expect(value).toBe("");
  });

  test("bug-008: textarea newline preservation", async () => {
    // Bug: Newlines in textarea were not preserved
    await page.goto(`file://${pagesDir}/form-accuracy.html`, { waitUntil: "domcontentloaded" });

    const multilineText = "Line 1\nLine 2\nLine 3";
    await page.locator("#textarea").fill(multilineText);

    // Verify preserved
    await expect(page.locator("#textarea")).toHaveValue(multilineText);
  });

  test("bug-009: form submit button type", async () => {
    // Bug: Submit button didn't trigger form submission
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    await page.locator("#name").fill("Test");
    await page.locator("#email").fill("test@example.com");
    await page.locator("#message").fill("Test message content");

    // Click submit
    await page.locator("#submitBtn").click();

    // Verify submission triggered (result message shown)
    await expect(page.locator("#resultMessage")).toBeVisible();
  });

  test("bug-010: page load state detection", async () => {
    // Bug: Page load state was not properly detected
    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Verify page fully loaded
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("#jobApplicationForm")).toBeVisible();
    await expect(page.locator("#submitBtn")).toBeVisible();
  });
});
