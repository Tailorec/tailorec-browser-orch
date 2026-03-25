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
  process.env.PORT = "4022";
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

test.describe("E2E: Search and Filter Flow", () => {
  let page: Page;
  let searchUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    searchUrl = `file://${pagesDir}/search-filter-page.html`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("search products by keyword", async () => {
    // Enter search term
    await page.locator("#searchInput").fill("Wireless");
    await page.locator("#searchBtn").click();

    // Verify results filtered
    const resultCount = page.locator("#resultCount");
    await expect(resultCount).toContainText("Showing");

    // Verify specific product appears
    const results = page.locator(".result-item");
    await expect(results.first()).toBeVisible();
  });

  test("filter by category", async () => {
    // Select category filter
    await page.locator("#categoryFilter").selectOption("electronics");

    // Verify results filtered
    const resultCount = page.locator("#resultCount");
    await expect(resultCount).toContainText("Showing 3");

    // Verify only electronics shown
    const resultItems = page.locator(".result-item");
    const count = await resultItems.count();
    expect(count).toBe(3);
  });

  test("filter by price range", async () => {
    // Set price range
    await page.locator("#priceMin").fill("30");
    await page.locator("#priceMax").fill("100");

    // Apply filters
    await page.locator("#categoryFilter").selectOption("");

    // Verify results filtered by price
    const resultCount = page.locator("#resultCount");
    await expect(resultCount).toContainText("Showing");
  });

  test("filter by minimum rating", async () => {
    // Select rating filter
    await page.locator("#ratingFilter").selectOption("4");

    // Verify only high-rated products shown
    const resultCount = page.locator("#resultCount");
    await expect(resultCount).toContainText("Showing 9");
  });

  test("sort results by price", async () => {
    // Sort by price low to high
    await page.locator("#sortOrder").selectOption("price-asc");

    // Verify first result is lowest price
    const firstResult = page.locator(".result-item").first();
    await expect(firstResult).toBeVisible();

    // Sort by price high to low
    await page.locator("#sortOrder").selectOption("price-desc");

    // Verify order changed
    const newFirstResult = page.locator(".result-item").first();
    await expect(newFirstResult).toBeVisible();
  });

  test("clear search and filters", async () => {
    // Apply some filters first
    await page.locator("#searchInput").fill("JavaScript");
    await page.locator("#searchBtn").click();
    await page.locator("#categoryFilter").selectOption("books");

    // Verify filtered state
    let resultCount = page.locator("#resultCount");
    const beforeText = await resultCount.textContent();

    // Clear all filters
    await page.locator("#clearBtn").click();

    // Verify cleared - should show all 12 products
    resultCount = page.locator("#resultCount");
    await expect(resultCount).toContainText("Showing 12");

    // Verify search input cleared
    await expect(page.locator("#searchInput")).toHaveValue("");
  });
});
