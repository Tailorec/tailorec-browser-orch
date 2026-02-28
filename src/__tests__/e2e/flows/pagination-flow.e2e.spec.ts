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
  process.env.PORT = "4023";
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

test.describe("E2E: Pagination Flow", () => {
  let page: Page;
  let paginationUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    paginationUrl = `file://${pagesDir}/pagination-page.html`;
    await page.goto(paginationUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("navigate to next page", async () => {
    // Verify initial page
    await expect(page.locator("#pageInfo")).toContainText("Showing 1-10");

    // Click Next button
    await page.getByText("Next").click();

    // Verify page 2 displayed
    await expect(page.locator("#pageInfo")).toContainText("Showing 11-20");

    // Verify first row is User 11
    const firstRow = page.locator("#usersBody tr").first();
    await expect(firstRow).toContainText("User 11");
  });

  test("navigate to previous page", async () => {
    // Go to page 2 first
    await page.getByText("Next").click();
    await expect(page.locator("#pageInfo")).toContainText("Showing 11-20");

    // Click Prev button
    await page.getByText("Prev").click();

    // Verify back to page 1
    await expect(page.locator("#pageInfo")).toContainText("Showing 1-10");
  });

  test("navigate to specific page number", async () => {
    // Click page 3
    await page.getByText("3").click();

    // Verify page 3 displayed
    await expect(page.locator("#pageInfo")).toContainText("Showing 21-30");

    // Verify first row is User 21
    const firstRow = page.locator("#usersBody tr").first();
    await expect(firstRow).toContainText("User 21");
  });

  test("navigate to last page", async () => {
    // Click Last button
    await page.getByText("Last").click();

    // Verify last page displayed (page 5 with 50 items, 10 per page)
    await expect(page.locator("#pageInfo")).toContainText("Showing 41-50");

    // Verify first row is User 41
    const firstRow = page.locator("#usersBody tr").first();
    await expect(firstRow).toContainText("User 41");
  });

  test("change items per page", async () => {
    // Change to 5 items per page
    await page.locator("#itemsPerPage").selectOption("5");

    // Verify page info updated
    await expect(page.locator("#pageInfo")).toContainText("Showing 1-5");

    // Verify only 5 rows displayed
    const rows = page.locator("#usersBody tr");
    await expect(rows).toHaveCount(5);

    // Change to 20 items per page
    await page.locator("#itemsPerPage").selectOption("20");

    // Verify 20 rows displayed
    const newRows = page.locator("#usersBody tr");
    await expect(newRows).toHaveCount(20);
  });
});
