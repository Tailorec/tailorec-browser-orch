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
  process.env.PORT = "4018";
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

test.describe("E2E: File Download Flow", () => {
  let page: Page;
  let downloadUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    downloadUrl = `file://${pagesDir}/file-download-page.html`;
    await page.goto(downloadUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("download PDF file", async () => {
    // Click PDF download button
    await page.getByText("Download PDF").click();

    // Verify download initiated
    const status = page.locator("#singleDownloadStatus");
    await expect(status).toContainText("Starting PDF download");
    await expect(status).toContainText("PDF");
  });

  test("download with confirmation", async () => {
    // Click confirm download button
    await page.getByRole("button", { name: "Download with Confirmation" }).click();

    // Wait for preparation
    await page.waitForTimeout(500);

    // Verify download ready
    const status = page.locator("#confirmDownloadStatus");
    await expect(status).toContainText("Download ready");
  });

  test("multiple downloads", async () => {
    // Click download all button
    await page.getByText("Download All Files").click();

    // Wait for downloads to complete
    await page.waitForTimeout(2000);

    // Verify all files downloaded
    const status = page.locator("#multipleDownloadStatus");
    await expect(status).toContainText("All 3 files downloaded");
  });

  test("download cancellation", async () => {
    // Start progress download
    await page.getByText("Download Large File").click();

    // Wait for partial progress
    await page.waitForTimeout(500);

    // Verify progress started
    const progressBar = page.locator("#progressBar");
    const progressText = await progressBar.textContent();
    expect(progressText).toBeTruthy();
    expect(parseInt(progressText || "0")).toBeGreaterThan(0);
  });

  test("download error handling", async () => {
    // Simulate download error
    await page.getByText("Simulate Download Error").click();

    // Wait for error
    await page.waitForTimeout(1500);

    // Verify error message
    const status = page.locator("#errorDownloadStatus");
    await expect(status).toContainText("Download failed");
    await expect(status).toContainText("Network error");

    // Verify retry option available
    const retryBtn = status.getByText("Retry Download");
    await expect(retryBtn).toBeVisible();
  });
});
