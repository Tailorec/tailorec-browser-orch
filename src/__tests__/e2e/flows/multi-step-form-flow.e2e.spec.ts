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
  process.env.PORT = "4020";
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

test.describe("E2E: Multi-Step Form Flow", () => {
  let page: Page;
  let formUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    formUrl = `file://${pagesDir}/multi-step-form.html`;
    await page.goto(formUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("step 1: fill personal information", async () => {
    // Verify step 1 is active
    await expect(page.locator('.progress-step[data-step="1"]')).toHaveClass(/active/);

    // Fill personal info
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#email").fill("john.doe@example.com");
    await page.locator("#phone").fill("123-456-7890");

    // Verify values
    await expect(page.locator("#firstName")).toHaveValue("John");
    await expect(page.locator("#lastName")).toHaveValue("Doe");
    await expect(page.locator("#email")).toHaveValue("john.doe@example.com");
    await expect(page.locator("#phone")).toHaveValue("123-456-7890");
  });

  test("step 2: fill account information", async () => {
    // First complete step 1
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#email").fill("john.doe@example.com");
    await page.locator("button:has-text('Next')").first().click();

    // Verify step 2 is active
    await expect(page.locator('.progress-step[data-step="2"]')).toHaveClass(/active/);

    // Fill account info
    await page.locator("#username").fill("johndoe");
    await page.locator("#password").fill("SecurePass123");
    await page.locator("#confirmPassword").fill("SecurePass123");

    // Verify values
    await expect(page.locator("#username")).toHaveValue("johndoe");
    await expect(page.locator("#password")).toHaveValue("SecurePass123");
  });

  test("step 3: fill preferences", async () => {
    // Complete steps 1 and 2
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#email").fill("john.doe@example.com");
    await page.locator("button:has-text('Next')").first().click();

    await page.locator("#username").fill("johndoe");
    await page.locator("#password").fill("SecurePass123");
    await page.locator("#confirmPassword").fill("SecurePass123");
    await page.locator("button:has-text('Next')").nth(1).click();

    // Verify step 3 is active
    await expect(page.locator('.progress-step[data-step="3"]')).toHaveClass(/active/);

    // Fill preferences
    await page.locator("#country").selectOption("us");
    await page.locator("#timezone").selectOption("est");
    await page.locator("#newsletter").check();
    await page.locator("#terms").check();

    // Verify selections
    await expect(page.locator("#country")).toHaveValue("us");
    await expect(page.locator("#timezone")).toHaveValue("est");
    await expect(page.locator("#newsletter")).toBeChecked();
    await expect(page.locator("#terms")).toBeChecked();
  });

  test("step 4: review information", async () => {
    // Complete steps 1, 2, and 3
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#email").fill("john.doe@example.com");
    await page.locator("button:has-text('Next')").first().click();

    await page.locator("#username").fill("johndoe");
    await page.locator("#password").fill("SecurePass123");
    await page.locator("#confirmPassword").fill("SecurePass123");
    await page.locator("button:has-text('Next')").nth(1).click();

    await page.locator("#country").selectOption("us");
    await page.locator("#timezone").selectOption("est");
    await page.locator("#newsletter").check();
    await page.locator("#terms").check();
    await page.locator("button:has-text('Next')").nth(2).click();

    // Verify step 4 is active
    await expect(page.locator('.progress-step[data-step="4"]')).toHaveClass(/active/);

    // Verify review content populated
    const reviewContent = page.locator("#reviewContent");
    await expect(reviewContent).toBeVisible();
    await expect(reviewContent).toContainText("John Doe");
    await expect(reviewContent).toContainText("john.doe@example.com");
    await expect(reviewContent).toContainText("johndoe");
  });

  test("progress indicator verification", async () => {
    // Verify initial state - step 1 active
    await expect(page.locator('.progress-step[data-step="1"]')).toHaveClass(/active/);
    await expect(page.locator('.progress-step[data-step="2"]')).not.toHaveClass(/active|completed/);

    // Complete step 1 and move to step 2
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#email").fill("john@example.com");
    await page.locator("button:has-text('Next')").first().click();

    // Verify progress - step 1 completed, step 2 active
    await expect(page.locator('.progress-step[data-step="1"]')).toHaveClass(/completed/);
    await expect(page.locator('.progress-step[data-step="2"]')).toHaveClass(/active/);
    await expect(page.locator('.progress-step[data-step="3"]')).not.toHaveClass(/active|completed/);

    // Complete step 2 and move to step 3
    await page.locator("#username").fill("johndoe");
    await page.locator("#password").fill("SecurePass123");
    await page.locator("#confirmPassword").fill("SecurePass123");
    await page.locator("button:has-text('Next')").nth(1).click();

    // Verify progress - steps 1,2 completed, step 3 active
    await expect(page.locator('.progress-step[data-step="1"]')).toHaveClass(/completed/);
    await expect(page.locator('.progress-step[data-step="2"]')).toHaveClass(/completed/);
    await expect(page.locator('.progress-step[data-step="3"]')).toHaveClass(/active/);
  });

  test("step validation - required fields", async () => {
    // Try to proceed without filling required fields
    await page.locator("button:has-text('Next')").first().click();

    // Verify validation errors appear
    await expect(page.locator("#firstNameError")).toContainText("required");
    await expect(page.locator("#lastNameError")).toContainText("required");
    await expect(page.locator("#emailError")).toContainText("required");

    // Verify still on step 1
    await expect(page.locator('.progress-step[data-step="1"]')).toHaveClass(/active/);
  });

  test("step validation - password match", async () => {
    // Complete step 1
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#email").fill("john@example.com");
    await page.locator("button:has-text('Next')").first().click();

    // Fill mismatched passwords
    await page.locator("#username").fill("johndoe");
    await page.locator("#password").fill("Password123");
    await page.locator("#confirmPassword").fill("Different123");

    // Try to proceed
    await page.locator("button:has-text('Next')").nth(1).click();

    // Verify password mismatch error
    await expect(page.locator("#confirmPasswordError")).toContainText("do not match");

    // Verify still on step 2
    await expect(page.locator('.progress-step[data-step="2"]')).toHaveClass(/active/);
  });

  test("complete form submission", async () => {
    // Complete all steps
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#email").fill("john.doe@example.com");
    await page.locator("button:has-text('Next')").first().click();

    await page.locator("#username").fill("johndoe");
    await page.locator("#password").fill("SecurePass123");
    await page.locator("#confirmPassword").fill("SecurePass123");
    await page.locator("button:has-text('Next')").nth(1).click();

    await page.locator("#country").selectOption("us");
    await page.locator("#timezone").selectOption("est");
    await page.locator("#newsletter").check();
    await page.locator("#terms").check();
    await page.locator("button:has-text('Next')").nth(2).click();

    // Submit form
    await page.locator("button:has-text('Submit Registration')").click();

    // Verify success message
    const successMessage = page.locator("#successMessage");
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText("Registration Successful");
  });
});
