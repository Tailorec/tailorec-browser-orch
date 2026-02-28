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
  process.env.PORT = "4048";
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

test.describe("E2E: Stability", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("extended operation stability", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Perform extended operations
    for (let i = 0; i < 20; i++) {
      await page.locator("#name").fill(`Iteration ${i}`);
      await page.locator("#email").fill(`iter${i}@test.com`);
      await page.waitForTimeout(50);
    }

    // Final state should be correct
    await expect(page.locator("#name")).toHaveValue("Iteration 19");
    await expect(page.locator("#email")).toHaveValue("iter19@test.com");
  });

  test("repeated navigation stability", async () => {
    const urls = [
      `file://${pagesDir}/simple-form.html`,
      `file://${pagesDir}/complex-form.html`,
      `file://${pagesDir}/auth-page.html`,
    ];

    // Navigate repeatedly
    for (let i = 0; i < 10; i++) {
      await page.goto(urls[i % urls.length], { waitUntil: "domcontentloaded" });
    }

    // Should end on last URL
    await expect(page).toHaveURL(/auth-page\.html$/);
  });

  test("error recovery stability", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Cause and recover from errors
    for (let i = 0; i < 5; i++) {
      try {
        await page.locator("#nonExistent").waitFor({ state: "visible", timeout: 100 });
      } catch {
        // Expected
      }
      // Recover
      await page.locator("#name").fill(`Recovery ${i}`);
    }

    // Should still work
    await expect(page.locator("#name")).toHaveValue("Recovery 4");
  });

  test("concurrent stability", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Run concurrent operations
    const tasks: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      tasks.push((async () => {
        await page.locator("#name").fill(`Task ${i}`);
        await page.screenshot().catch(() => {});
      })());
    }

    await Promise.allSettled(tasks);

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();
  });

  test("resource cleanup stability", async () => {
    const context = await browser.newContext();
    
    // Create and destroy resources
    for (let i = 0; i < 5; i++) {
      const newPage = await context.newPage();
      await newPage.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
      await newPage.close();
    }

    // Context should still work
    const finalPage = await context.newPage();
    await finalPage.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });
    await expect(finalPage.locator("h1")).toContainText("Job Application Form");

    await context.close();
  });
});
