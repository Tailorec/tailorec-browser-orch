import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type Page } from "@playwright/test";
import {
  startBrowserControlServerFromConfig,
  stopBrowserControlServer,
} from "../helpers/server-bootstrap.js";
import * as path from "node:path";
import * as fs from "node:fs";

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
  process.env.PORT = "4016";
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

test.describe("E2E: Form Filling Accuracy", () => {
  let page: Page;
  let formUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    formUrl = `file://${pagesDir}/form-accuracy.html`;
    await page.goto(formUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("text field accuracy - special characters and unicode", async () => {
    // Test single-line text input
    const textField = page.locator("#textField");
    await textField.fill("Hello World");
    await expect(textField).toHaveValue("Hello World");

    // Test special characters
    const specialCharsField = page.locator("#specialChars");
    const specialChars = "!@#$%^&*()_+-=[]{}|;:',.<>?";
    await specialCharsField.fill(specialChars);
    await expect(specialCharsField).toHaveValue(specialChars);

    // Test unicode (emojis, accented chars)
    const unicodeField = page.locator("#unicodeField");
    const unicodeText = "Hello 🌍 Café résumé naïve";
    await unicodeField.fill(unicodeText);
    await expect(unicodeField).toHaveValue(unicodeText);
  });

  test("email field validation - various formats", async () => {
    // Test valid email
    const emailValid = page.locator("#emailValid");
    await emailValid.fill("user@example.com");
    await expect(emailValid).toHaveValue("user@example.com");

    // Test email with plus addressing
    const emailPlus = page.locator("#emailPlus");
    await emailPlus.fill("user+tag@example.com");
    await expect(emailPlus).toHaveValue("user+tag@example.com");

    // Test email with subdomain
    const emailSubdomain = page.locator("#emailSubdomain");
    await emailSubdomain.fill("user@mail.sub.example.com");
    await expect(emailSubdomain).toHaveValue("user@mail.sub.example.com");
  });

  test("phone field formatting - various formats", async () => {
    // Test format 1: (123) 456-7890
    const phone1 = page.locator("#phone1");
    await phone1.fill("(123) 456-7890");
    await expect(phone1).toHaveValue("(123) 456-7890");

    // Test format 2: +1-123-456-7890
    const phone2 = page.locator("#phone2");
    await phone2.fill("+1-123-456-7890");
    await expect(phone2).toHaveValue("+1-123-456-7890");

    // Test format 3: 1234567890
    const phone3 = page.locator("#phone3");
    await phone3.fill("1234567890");
    await expect(phone3).toHaveValue("1234567890");
  });

  test("date field formats - ISO and text", async () => {
    // Test ISO format date
    const dateISO = page.locator("#dateISO");
    await dateISO.fill("2024-06-15");
    await expect(dateISO).toHaveValue("2024-06-15");

    // Test text date format
    const dateText = page.locator("#dateText");
    await dateText.fill("06/15/2024");
    await expect(dateText).toHaveValue("06/15/2024");
  });

  test("dropdown selection accuracy - by value and label", async () => {
    // Select option by value
    const dropdown = page.locator("#dropdown");
    await dropdown.selectOption("option2");
    await expect(dropdown).toHaveValue("option2");

    // Select option by label
    await dropdown.selectOption({ label: "Option 3" });
    await expect(dropdown).toHaveValue("option3");

    // Test dropdown with optgroup
    const dropdownOptgroup = page.locator("#dropdownOptgroup");
    await dropdownOptgroup.selectOption("banana");
    await expect(dropdownOptgroup).toHaveValue("banana");

    // Select from different optgroup
    await dropdownOptgroup.selectOption("carrot");
    await expect(dropdownOptgroup).toHaveValue("carrot");
  });

  test("radio button selection - single and change", async () => {
    const radio1 = page.locator('input[name="radioGroup"][value="radio1"]');
    const radio2 = page.locator('input[name="radioGroup"][value="radio2"]');
    const radio3 = page.locator('input[name="radioGroup"][value="radio3"]');

    // Select first radio
    await radio1.check();
    await expect(radio1).toBeChecked();
    await expect(radio2).not.toBeChecked();
    await expect(radio3).not.toBeChecked();

    // Change selection
    await radio2.check();
    await expect(radio1).not.toBeChecked();
    await expect(radio2).toBeChecked();
    await expect(radio3).not.toBeChecked();

    // Change again
    await radio3.check();
    await expect(radio1).not.toBeChecked();
    await expect(radio2).not.toBeChecked();
    await expect(radio3).toBeChecked();
  });

  test("checkbox handling - single, multiple, and toggle", async () => {
    const check1 = page.locator("#check1");
    const check2 = page.locator("#check2");
    const check3 = page.locator("#check3");
    const check4 = page.locator("#check4");

    // Check single checkbox
    await check1.check();
    await expect(check1).toBeChecked();

    // Uncheck checkbox
    await check1.uncheck();
    await expect(check1).not.toBeChecked();

    // Check multiple checkboxes
    await check1.check();
    await check2.check();
    await check3.check();

    await expect(check1).toBeChecked();
    await expect(check2).toBeChecked();
    await expect(check3).toBeChecked();
    await expect(check4).not.toBeChecked();

    // Verify all states
    const checkedBoxes = page.locator('input[name="checks"]:checked');
    await expect(checkedBoxes).toHaveCount(3);
  });

  test("textarea with special characters - multiline preservation", async () => {
    const textarea = page.locator("#textarea");

    // Fill multiline text with special characters
    const multilineText = "Line 1: Hello World\nLine 2: Special chars !@#$%\nLine 3: Tabs\there\nLine 4: Unicode 🌍 café";
    await textarea.fill(multilineText);

    // Verify exact content preserved
    await expect(textarea).toHaveValue(multilineText);

    // Submit form and verify data
    await page.locator("#submitBtn").click();
    await page.waitForTimeout(500);

    // Verify result displayed
    const result = page.locator("#result");
    await expect(result).toBeVisible();

    // Verify textarea content in submitted data
    const resultData = page.locator("#resultData");
    const resultText = await resultData.textContent();
    expect(resultText).toContain("Line 1: Hello World");
    expect(resultText).toContain("🌍");
  });
});
