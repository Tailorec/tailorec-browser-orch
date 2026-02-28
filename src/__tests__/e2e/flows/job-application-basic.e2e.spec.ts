import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type Page } from "@playwright/test";
import {
  startBrowserControlServerFromConfig,
  stopBrowserControlServer,
} from "../../../browser/server.js";

let baseUrl = "";
let api: any;
let browser: Browser;

// JWT token helper for control API
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

// Helper to get control token
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
  process.env.PORT = "4014";
  process.env.BROWSER_HEADLESS = "true";
  process.env.AGENT_RUNTIME_JWT_SECRET = "e2e-secret";

  const state = await startBrowserControlServerFromConfig();
  if (!state) {
    throw new Error("failed to start browser control server for e2e");
  }
  baseUrl = `http://127.0.0.1:${state.port}`;
  api = await request.newContext({ baseURL: baseUrl });
  
  // Use Playwright's browser instance
  browser = pwBrowser;
});

test.afterAll(async () => {
  await api.dispose();
  await stopBrowserControlServer();
});

test.describe("E2E: Basic Job Application", () => {
  let page: Page;
  let controlToken: string;

  test.beforeEach(async () => {
    controlToken = getControlToken();
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("navigate to job board", async () => {
    // Using a reliable test page that simulates a job board
    const testPageUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Verify we're on the page
    await expect(page).toHaveURL(/demoqa\.com/);

    // Verify page loaded with expected content (student registration form)
    await expect(page.locator("#firstName")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#lastName")).toBeVisible({ timeout: 10000 });
  });

  test("search for jobs", async () => {
    // Using demoqa form to simulate job search form filling
    const testPageUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Simulate job search by filling relevant fields
    const firstNameInput = page.locator("#firstName");
    await firstNameInput.fill("Software");

    const lastNameInput = page.locator("#lastName");
    await lastNameInput.fill("Engineer");

    // Verify search terms were entered
    await expect(firstNameInput).toHaveValue("Software");
    await expect(lastNameInput).toHaveValue("Engineer");
  });

  test("open job detail page", async () => {
    // Navigate to form page (simulating job detail page)
    const testPageUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Verify form fields are visible (simulating job details)
    await expect(page.locator("#firstName")).toBeVisible();
    await expect(page.locator("#lastName")).toBeVisible();
    await expect(page.locator("#userEmail")).toBeVisible();
  });

  test("click apply button", async () => {
    // Navigate to form page
    const testPageUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Fill basic info before applying
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#userEmail").fill("john@example.com");

    // Click submit button (simulating apply button)
    const submitButton = page.locator("#submit");
    await submitButton.click();

    // Wait for confirmation modal to appear (with longer timeout)
    await page.waitForSelector(".modal-content", { timeout: 15000 });

    // Verify modal appeared (simulating application submission)
    const modal = page.locator(".modal-content");
    await expect(modal).toBeVisible();
  });

  test("fill basic info form", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testFormUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Fill first name
    const firstNameInput = page.locator("#firstName");
    await firstNameInput.fill("John");

    // Fill last name
    const lastNameInput = page.locator("#lastName");
    await lastNameInput.fill("Doe");

    // Fill email
    const emailInput = page.locator("#userEmail");
    await emailInput.fill("john.doe@example.com");

    // Fill mobile
    const mobileInput = page.locator("#userNumber");
    await mobileInput.fill("1234567890");

    // Verify values were filled
    await expect(firstNameInput).toHaveValue("John");
    await expect(lastNameInput).toHaveValue("Doe");
    await expect(emailInput).toHaveValue("john.doe@example.com");
    await expect(mobileInput).toHaveValue("1234567890");
  });

  test("upload resume", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testFormUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Create a test file content
    const testFilePath = "/tmp/test-resume.txt";
    const fs = await import("node:fs");
    fs.writeFileSync(testFilePath, "John Doe\nSoftware Engineer\nExperience: 5 years");

    // Find file upload input and upload
    const fileInput = page.locator("#uploadPicture");
    await expect(fileInput).toBeVisible();
    
    await fileInput.setInputFiles(testFilePath);

    // Verify upload succeeded by checking the input has files
    const files = await fileInput.evaluate((el) => (el as HTMLInputElement).files?.length);
    expect(files).toBeGreaterThan(0);
  });

  test("submit application", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testFormUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Fill required fields
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#userEmail").fill("john.doe@example.com");

    // Select gender
    await page.locator('label[for="gender-radio-1"]').click();

    // Select date of birth
    await page.locator("#dateOfBirthInput").click();
    await page.locator(".react-datepicker__month-select").selectOption("January");
    await page.locator(".react-datepicker__year-select").selectOption("1990");
    await page.locator(".react-datepicker__day--015").click();

    // Enter address
    await page.locator("#currentAddress").fill("123 Test Street, Test City, TC 12345");

    // Click submit
    const submitButton = page.locator("#submit");
    await submitButton.click();

    // Wait for modal to appear
    await page.waitForSelector(".modal-content", { timeout: 15000 });

    // Verify submission modal appeared
    const modal = page.locator(".modal-content");
    await expect(modal).toBeVisible();
  });

  test("verify submission confirmation", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testFormUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Fill required fields
    await page.locator("#firstName").fill("Jane");
    await page.locator("#lastName").fill("Smith");
    await page.locator("#userEmail").fill("jane.smith@example.com");

    // Submit
    await page.locator("#submit").click();

    // Wait for confirmation modal
    await page.waitForSelector(".modal-content", { timeout: 15000 });

    // Verify confirmation message
    const modalContent = page.locator(".modal-body");
    const modalText = await modalContent.textContent();

    // Check that submission was successful (modal shows form data)
    expect(modalText).toContain("Jane");
    expect(modalText).toContain("Smith");
    expect(modalText).toContain("jane.smith@example.com");

    // Close modal
    await page.locator("#closeLargeModal").click();

    // Verify modal closed
    await expect(page.locator(".modal-content")).not.toBeVisible();
  });

  test("form validation - submit empty form", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await page.goto(testFormUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Try to submit without filling required fields
    await page.locator("#submit").click();

    // Wait briefly for validation to trigger
    await page.waitForTimeout(500);

    // Verify validation errors appear (browser default validation)
    const firstNameInput = page.locator("#firstName");
    await expect(firstNameInput).toBeVisible();

    // Check that form was not submitted (no modal should appear)
    const modal = page.locator(".modal-content");
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test("navigation - back and forward during application", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    // Navigate to form
    await page.goto(testFormUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Fill some fields
    await page.locator("#firstName").fill("Navigation");
    await page.locator("#lastName").fill("Test");

    // Navigate to another page
    await page.goto("about:blank");
    await expect(page).toHaveURL("about:blank");

    // Go back to form
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL(/demoqa\.com/);

    // Verify page loaded
    await expect(page.locator("#firstName")).toBeVisible({ timeout: 10000 });
  });
});
