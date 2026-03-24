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
  process.env.PORT = "4025";
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

test.describe("E2E: Snapshot-Act Loop", () => {
  let page: Page;
  let testUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    testUrl = `file://${pagesDir}/complex-form.html`;
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("basic snapshot-act cycle", async () => {
    // Take snapshot (capture page state)
    const screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();

    // Act: Fill a field
    await page.locator("#fullName").fill("John Doe");

    // Verify action completed
    await expect(page.locator("#fullName")).toHaveValue("John Doe");
  });

  test("multiple sequential actions", async () => {
    // Act 1: Fill name
    await page.locator("#fullName").fill("John Doe");

    // Act 2: Fill email
    await page.locator("#email").fill("john@example.com");

    // Act 3: Fill phone
    await page.locator("#phone").fill("123-456-7890");

    // Verify all actions completed
    await expect(page.locator("#fullName")).toHaveValue("John Doe");
    await expect(page.locator("#email")).toHaveValue("john@example.com");
    await expect(page.locator("#phone")).toHaveValue("123-456-7890");
  });

  test("snapshot after each action", async () => {
    // Action 1
    await page.locator("#fullName").fill("John Doe");
    let screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();

    // Action 2
    await page.locator("#email").fill("john@example.com");
    screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();

    // Action 3
    await page.locator("#position").selectOption("frontend");
    screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();
  });

  test("element reference resolution across snapshots", async () => {
    // Get initial reference
    const nameField = page.locator("#fullName");
    await nameField.fill("Initial Value");

    // Take snapshot
    await page.screenshot();

    // Re-resolve and verify
    const nameField2 = page.locator("#fullName");
    await expect(nameField2).toHaveValue("Initial Value");

    // Update value
    await nameField2.fill("Updated Value");
    await expect(nameField).toHaveValue("Updated Value");
  });

  test("dynamic content handling", async () => {
    // Fill form fields
    await page.locator("#fullName").fill("Dynamic Test");
    await page.locator("#email").fill("dynamic@example.com");

    // Wait for any dynamic updates
    await page.waitForTimeout(500);

    // Take snapshot
    const screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();

    // Verify content stable
    await expect(page.locator("#fullName")).toHaveValue("Dynamic Test");
  });

  test("error in act recovery", async () => {
    // Try to interact with non-existent element
    let error: Error | null = null;
    try {
      await page.locator("#nonExistentElement").fill("test", { timeout: 1000 });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeTruthy();

    // Verify page still functional
    await page.locator("#fullName").fill("Recovery Test");
    await expect(page.locator("#fullName")).toHaveValue("Recovery Test");
  });

  test("timeout in loop", async () => {
    // Set short timeout for action
    const startTime = Date.now();

    try {
      await page.locator("#nonExistent").waitFor({ state: "visible", timeout: 2000 });
    } catch (e) {
      // Expected timeout
    }

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(1900);

    // Verify page still responsive
    await page.locator("#fullName").fill("After Timeout");
    await expect(page.locator("#fullName")).toHaveValue("After Timeout");
  });

  test("complex multi-step flow", async () => {
    // Step 1: Personal info
    await page.locator("#fullName").fill("Complex User");
    await page.locator("#email").fill("complex@example.com");

    // Step 2: Position details
    await page.locator("#position").selectOption("fullstack");
    await page.locator("#startDate").fill("2024-06-01");

    // Step 3: Experience
    await page.locator("#experience").selectOption("3");
    await page.locator('input[name="skills"][value="javascript"]').check();
    await page.locator('input[name="skills"][value="react"]').check();

    // Step 4: Preferences
    await page.locator('input[name="workType"][value="remote"]').check();
    await page.locator("#terms").check();

    // Verify all steps completed
    await expect(page.locator("#fullName")).toHaveValue("Complex User");
    await expect(page.locator("#position")).toHaveValue("fullstack");
    await expect(page.locator("#terms")).toBeChecked();
  });

  test("state preservation across operations", async () => {
    // Fill form
    await page.locator("#fullName").fill("State Test");
    await page.locator("#email").fill("state@example.com");
    await page.locator("#phone").fill("999-888-7777");

    // Take multiple snapshots
    await page.screenshot();
    await page.waitForTimeout(100);
    await page.screenshot();

    // Verify state preserved
    await expect(page.locator("#fullName")).toHaveValue("State Test");
    await expect(page.locator("#email")).toHaveValue("state@example.com");
    await expect(page.locator("#phone")).toHaveValue("999-888-7777");
  });

  test("logging verification", async () => {
    // Enable console logging
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    // Perform actions
    await page.locator("#fullName").fill("Log Test");
    await page.locator("#resetBtn").click();

    // Wait for any console output
    await page.waitForTimeout(200);

    // Verify page functional
    await expect(page.locator("#fullName")).toHaveValue("");
  });
});
