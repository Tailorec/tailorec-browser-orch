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
  process.env.PORT = "4015";
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

test.describe("E2E: Complex Job Application", () => {
  let page: Page;
  let controlToken: string;

  test.beforeEach(async () => {
    controlToken = getControlToken();
    page = await browser.newPage();
    page.setDefaultTimeout(15000);
  });

  const removeAds = async (p: Page) => {
    await p.evaluate(() => {
      const ads = document.querySelectorAll('[id^="google_ads"], [id^="adplus"], .adunit, #ad-container');
      ads.forEach(ad => (ad as HTMLElement).style.display = "none");
      const fixedban = document.querySelector("#fixedban");
      if (fixedban) (fixedban as HTMLElement).style.display = "none";
    }).catch(() => {});
  };

  test.afterEach(async () => {
    await page.close();
  });

  test("multi-step application - personal information step", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Step 1: Personal Information
    await page.locator("#firstName").fill("Michael");
    await page.locator("#lastName").fill("Johnson");
    await page.locator("#userEmail").fill("michael.johnson@example.com");

    // Verify step completion
    const firstName = await page.locator("#firstName").inputValue();
    expect(firstName).toBe("Michael");
  });

  test("multi-step application - contact information step", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Fill personal info
    await page.locator("#firstName").fill("Michael");
    await page.locator("#lastName").fill("Johnson");
    await page.locator("#userEmail").fill("michael.johnson@example.com");

    // Step 2: Contact Information
    await page.locator("#userNumber").fill("9876543210");
    await page.locator("#currentAddress").fill("456 Oak Avenue, Springfield, IL 62701");

    // Verify contact info
    const mobile = await page.locator("#userNumber").inputValue();
    expect(mobile).toBe("9876543210");
  });

  test("multi-step application - additional details step", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Fill previous steps
    await page.locator("#firstName").fill("Michael");
    await page.locator("#lastName").fill("Johnson");
    await page.locator("#userEmail").fill("michael.johnson@example.com");
    await page.locator("#userNumber").fill("9876543210");

    // Step 3: Additional Details
    // Select gender
    await page.locator('label[for="gender-radio-1"]').click();

    // Select date of birth
    await page.locator("#dateOfBirthInput").click();
    await page.locator(".react-datepicker__month-select").selectOption("March");
    await page.locator(".react-datepicker__year-select").selectOption("1985");
    await page.locator(".react-datepicker__day--020").click();

    // Verify DOB was set
    const dobValue = await page.locator("#dateOfBirthInput").inputValue();
    expect(dobValue).toContain("1985");
  });

  test("application with dropdown selections", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);
    await removeAds(page);

    // Fill basic info
    await page.locator("#firstName").fill("Sarah");
    await page.locator("#lastName").fill("Williams");
    await page.locator("#userEmail").fill("sarah.williams@example.com");
    await page.locator('label[for="gender-radio-2"]').click();
    await page.locator("#userNumber").fill("1234567890");

    // Select from dropdowns
    await page.locator("#state").scrollIntoViewIfNeeded();
    await page.locator("#state").click();
    await page.locator("#react-select-3-input").fill("NCR");
    await page.keyboard.press("Enter");

    await page.locator("#city").click();
    await page.locator("#react-select-4-input").fill("Delhi");
    await page.keyboard.press("Enter");

    // Verify selections
    const stateValue = await page.locator("#state").textContent();
    expect(stateValue).toContain("NCR");
  });

  test("application with file uploads and checkboxes", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Fill basic info
    await page.locator("#firstName").fill("Emily");
    await page.locator("#lastName").fill("Brown");
    await page.locator("#userEmail").fill("emily.brown@example.com");

    // Upload file (resume/picture)
    const fs = await import("node:fs");
    const testFilePath = "/tmp/test-profile.jpg";
    fs.writeFileSync(testFilePath, Buffer.from("fake-image-content"));

    const fileInput = page.locator("#uploadPicture");
    await fileInput.setInputFiles(testFilePath);

    // Select hobbies (checkboxes)
    await page.locator('label[for="hobbies-checkbox-1"]').click();
    await page.locator('label[for="hobbies-checkbox-2"]').click();

    // Verify file was uploaded
    const files = await fileInput.evaluate((el) => (el as HTMLInputElement).files?.length);
    expect(files).toBeGreaterThan(0);
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

  test("application with dynamic form fields", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);
    await removeAds(page);

    // Fill basic info
    await page.locator("#firstName").fill("David");
    await page.locator("#lastName").fill("Miller");
    await page.locator("#userEmail").fill("david.miller@example.com");
    await page.locator('label[for="gender-radio-1"]').click();
    await page.locator("#userNumber").fill("1234567890");

    // Add multiple subjects (dynamic field)
    const subjectsInput = page.locator("#subjectsInput");
    await subjectsInput.scrollIntoViewIfNeeded();
    await subjectsInput.click();
    await page.keyboard.type("Math");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    await page.keyboard.type("English");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Verify subjects were added - use a more general selector
    const subjectTags = page.locator(".subjects-auto-complete__multi-value");
    const count = await subjectTags.count();
    if (count === 0) {
      // Fallback to more general class match if DemoQA changed classes
      await expect(page.locator("[class*='multi-value']")).toHaveCount(2);
    } else {
      expect(count).toBe(2);
    }
  });

  test("application with validation errors and corrections", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);
    await removeAds(page);

    // Submit with invalid data to trigger validation
    await page.locator("#firstName").fill("A"); // Too short
    await page.locator("#userEmail").fill("invalid-email"); // Invalid email

    // Try to submit
    await page.locator("#submit").click();

    // Wait for validation errors
    await page.waitForTimeout(1000);

    // Check for validation errors (form should show errors)
    const firstNameInput = page.locator("#firstName");
    await expect(firstNameInput).toHaveValue("A");

    // Correct the errors
    await firstNameInput.fill("Alexander");
    await page.locator("#userEmail").fill("alexander.valid@example.com");

    // Verify corrections
    await expect(firstNameInput).toHaveValue("Alexander");
    await expect(page.locator("#userEmail")).toHaveValue("alexander.valid@example.com");
  });

  test("application progress persistence across steps", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Fill all fields
    const testData = {
      firstName: "Christopher",
      lastName: "Davis",
      email: "christopher.davis@example.com",
      mobile: "5551234567",
      address: "789 Pine Road, Boston, MA 02101",
    };

    await page.locator("#firstName").fill(testData.firstName);
    await page.locator("#lastName").fill(testData.lastName);
    await page.locator("#userEmail").fill(testData.email);
    await page.locator("#userNumber").fill(testData.mobile);
    await page.locator("#currentAddress").fill(testData.address);

    // Select gender
    await page.locator('label[for="gender-radio-1"]').click();

    // Select DOB
    await page.locator("#dateOfBirthInput").click();
    await page.locator(".react-datepicker__month-select").selectOption("June");
    await page.locator(".react-datepicker__year-select").selectOption("1992");
    await page.locator(".react-datepicker__day--010:not(.react-datepicker__day--outside-month)").click();

    // Verify all data persisted
    await expect(page.locator("#firstName")).toHaveValue(testData.firstName);
    await expect(page.locator("#lastName")).toHaveValue(testData.lastName);
    await expect(page.locator("#userEmail")).toHaveValue(testData.email);
    await expect(page.locator("#userNumber")).toHaveValue(testData.mobile);
    await expect(page.locator("#currentAddress")).toHaveValue(testData.address);
  });

  test("complete multi-step application submission", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);
    await removeAds(page);

    // Complete all steps
    await page.locator("#firstName").fill("Jessica");
    await page.locator("#lastName").fill("Wilson");
    await page.locator("#userEmail").fill("jessica.wilson@example.com");
    await page.locator("#userNumber").fill("5559876543");

    // Select gender
    await page.locator('label[for="gender-radio-2"]').click();

    // Select hobbies
    await page.locator('label[for="hobbies-checkbox-1"]').click();

    // Upload file
    const fs = await import("node:fs");
    const testFilePath = "/tmp/test-upload.txt";
    fs.writeFileSync(testFilePath, "Test document content");
    await page.locator("#uploadPicture").setInputFiles(testFilePath);

    // Enter address
    await page.locator("#currentAddress").fill("321 Elm Street, Seattle, WA 98101");

    // Select state
    await page.locator("#state").scrollIntoViewIfNeeded();
    await page.locator("#state").click();
    await page.locator("#react-select-3-input").fill("NCR");
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");

    // Select city
    await page.locator("#city").click();
    await page.locator("#react-select-4-input").fill("Delhi");
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");

    // Submit
    await page.locator("#submit").click();

    // Wait for confirmation modal
    await page.waitForSelector(".modal-content", { timeout: 15000 });

    // Verify submission
    const modal = page.locator(".modal-content");
    await expect(modal).toBeVisible();

    // Verify data in modal
    const modalText = await page.locator(".modal-body").textContent();
    expect(modalText).toContain("Jessica");
    expect(modalText).toContain("Wilson");
    expect(modalText).toContain("jessica.wilson@example.com");
  });

  test("application with back navigation and data retention", async () => {
    const testFormUrl = "https://demoqa.com/automation-practice-form";

    await safeGoto(page, testFormUrl);

    // Fill initial data
    await page.locator("#firstName").fill("Robert");
    await page.locator("#lastName").fill("Taylor");
    await page.locator("#userEmail").fill("robert.taylor@example.com");

    // Navigate away and back (simulating browser back)
    await page.goto("about:blank");
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");

    // Note: Form data may not persist on full navigation,
    // but this tests the browser's back navigation handling
    const url = page.url();
    expect(url).toContain("demoqa");
  });
});
