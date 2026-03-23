import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type Page } from "@playwright/test";
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
  process.env.PORT = "4014";
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

test.describe("E2E: Basic Job Application", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  const safeGoto = async (p: Page, url: string) => {
    for (let i = 0; i < 3; i++) {
      try {
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        return;
      } catch (e) {
        if (i === 2) throw e;
        await p.waitForTimeout(2000);
      }
    }
  };

  test("navigate to job board", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Verify page loaded
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText("Practice Form");
  });

  test("fill basic info form", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Fill basic info
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#userEmail").fill("john.doe@example.com");

    // Select gender
    await page.locator('label[for="gender-radio-1"]').click();

    // Fill mobile
    const mobileInput = page.locator("#userNumber");
    await mobileInput.fill("1234567890");

    // Verify inputs
    await expect(page.locator("#firstName")).toHaveValue("John");
    await expect(page.locator("#lastName")).toHaveValue("Doe");
    await expect(page.locator("#userEmail")).toHaveValue("john.doe@example.com");
    await expect(mobileInput).toHaveValue("1234567890");
  });

  test("upload resume", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";
    const path = await import("node:path");
    const __dirname = new URL(".", import.meta.url).pathname;

    await safeGoto(page, testFormUrl);

    // Find file upload input and upload
    const testFilePath = path.join(__dirname, "../fixtures/files/test-upload.txt");
    const fileInput = page.locator("#uploadPicture");
    await expect(fileInput).toBeVisible();
    
    await fileInput.setInputFiles(testFilePath);

    // Verify upload succeeded by checking the input has files
    const files = await fileInput.evaluate((el) => (el as HTMLInputElement).files?.length);
    expect(files).toBeGreaterThan(0);
  });

  test("submit application", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Fill required fields
    await page.locator("#firstName").fill("John");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#userEmail").fill("john.doe@example.com");
    await page.locator("#userNumber").fill("1234567890");

    // Select gender
    await page.locator('label[for="gender-radio-1"]').click();

    // Select date of birth
    await page.locator("#dateOfBirthInput").click();
    await page.locator(".react-datepicker__month-select").selectOption("January");
    await page.locator(".react-datepicker__year-select").selectOption("1990");
    await page.locator(".react-datepicker__day--015").click();

    // Click submit button
    const submitButton = page.locator("#submit");
    await submitButton.click();

    // Wait for submission confirmation
    const modal = page.locator(".modal-content");
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal).toContainText("Thanks for submitting the form");
  });

  test("verify submission confirmation", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Fill required fields
    await page.locator("#firstName").fill("Jane");
    await page.locator("#lastName").fill("Smith");
    await page.locator("#userEmail").fill("jane.smith@example.com");
    await page.locator('label[for="gender-radio-1"]').click();
    await page.locator("#userNumber").fill("0987654321");

    // Submit
    await page.locator("#submit").click();

    // Wait for confirmation modal
    const modal = page.locator(".modal-content");
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Verify modal content
    const modalText = await modal.innerText();
    expect(modalText).toContain("Jane");
    expect(modalText).toContain("Smith");
    expect(modalText).toContain("jane.smith@example.com");

    // Close modal
    const closeButton = page.locator("#closeLargeModal");
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await page.getByRole("button", { name: "Close" }).last().click();
    }

    // Verify modal closed
    await expect(page.locator(".modal-content")).not.toBeVisible({ timeout: 5000 });
  });

  test("form validation - submit empty form", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Submit without filling fields
    await page.locator("#submit").click();

    // Verify form validation triggered (check for :invalid pseudoclass if possible or specific classes)
    const firstName = page.locator("#firstName");
    const validationState = await firstName.evaluate((el) => (el as HTMLInputElement).checkValidity());
    expect(validationState).toBe(false);
  });

  test("navigation - back and forward during application", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    // Navigate to form
    await safeGoto(page, testFormUrl);

    // Fill some fields
    await page.locator("#firstName").fill("Navigation");
    await page.locator("#lastName").fill("Test");

    // Navigate away
    await page.goto("https://www.google.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL(/google/);

    // Navigate back
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL(/demoqa\.com/);

    // Verify page loaded
    await expect(page.locator("#firstName")).toBeVisible({ timeout: 10000 });
  });
});
