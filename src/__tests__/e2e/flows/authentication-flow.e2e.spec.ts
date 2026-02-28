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
  process.env.PORT = "4021";
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

test.describe("E2E: Authentication Flow", () => {
  let page: Page;
  let authUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    authUrl = `file://${pagesDir}/auth-page.html`;
    await page.goto(authUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("user login with valid credentials", async () => {
    // Fill login form
    await page.locator("#loginEmail").fill("user@example.com");
    await page.locator("#loginPassword").fill("password123");

    // Submit login
    await page.locator("#loginForm button[type='submit']").click();

    // Verify login success
    const userInfo = page.locator("#userInfo");
    await expect(userInfo).toHaveClass(/show/);
    await expect(page.locator("#userEmail")).toHaveText("user@example.com");
  });

  test("user registration with valid data", async () => {
    // Navigate to register
    await page.getByText("Register").click();

    // Fill registration form
    await page.locator("#registerName").fill("New User");
    await page.locator("#registerEmail").fill("newuser@example.com");
    await page.locator("#registerPassword").fill("SecurePass123");
    await page.locator("#registerConfirm").fill("SecurePass123");

    // Submit registration
    await page.locator("#registerForm button[type='submit']").click();

    // Verify registration success
    const registerMessage = page.locator("#registerMessage");
    await expect(registerMessage).toHaveClass(/success/);
    await expect(registerMessage).toContainText("Registration successful");
  });

  test("forgot password flow", async () => {
    // Navigate to forgot password
    await page.getByText("Forgot Password?").click();

    // Fill forgot password form
    await page.locator("#forgotEmail").fill("forgot@example.com");

    // Submit
    await page.locator("#forgotForm button[type='submit']").click();

    // Verify reset link sent
    const forgotMessage = page.locator("#forgotMessage");
    await expect(forgotMessage).toHaveClass(/success/);
    await expect(forgotMessage).toContainText("Password reset link sent");
  });

  test("login validation - empty fields", async () => {
    // Try to submit empty login form
    await page.locator("#loginForm button[type='submit']").click();

    // Verify form still visible (HTML5 validation)
    await expect(page.locator("#loginForm")).toBeVisible();
    await expect(page.locator("#loginEmail")).toBeVisible();
  });

  test("logout functionality", async () => {
    // First login
    await page.locator("#loginEmail").fill("user@example.com");
    await page.locator("#loginPassword").fill("password123");
    await page.locator("#loginForm button[type='submit']").click();

    // Wait for login to complete
    await page.waitForTimeout(500);

    // Verify logged in
    const userInfo = page.locator("#userInfo");
    await expect(userInfo).toHaveClass(/show/);

    // Logout
    await page.locator("#userInfo button").click();

    // Verify logged out
    await expect(userInfo).not.toHaveClass(/show/);
    await expect(page.locator("#loginForm")).toBeVisible();
  });

  test("registration validation - password mismatch", async () => {
    // Navigate to register
    await page.getByText("Register").click();

    // Fill registration form with mismatched passwords
    await page.locator("#registerName").fill("Test User");
    await page.locator("#registerEmail").fill("test@example.com");
    await page.locator("#registerPassword").fill("Password123");
    await page.locator("#registerConfirm").fill("Different123");

    // Submit
    await page.locator("#registerForm button[type='submit']").click();

    // Verify error message
    const registerMessage = page.locator("#registerMessage");
    await expect(registerMessage).toHaveClass(/error/);
    await expect(registerMessage).toContainText("do not match");
  });
});
