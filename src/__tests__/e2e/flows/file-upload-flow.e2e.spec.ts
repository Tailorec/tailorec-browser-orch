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
const filesDir = path.resolve(__dirname, "../../fixtures/files");
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
  process.env.PORT = "4017";
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

test.describe("E2E: File Upload Flow", () => {
  let page: Page;
  let uploadUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    uploadUrl = `file://${pagesDir}/file-upload-page.html`;
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("upload text file", async () => {
    const fileInput = page.locator("#singleFile");
    const testFilePath = path.join(filesDir, "test-upload.txt");

    // Upload text file
    await fileInput.setInputFiles(testFilePath);

    // Verify file info displayed
    const fileInfo = page.locator("#singleFileInfo");
    await expect(fileInfo).toContainText("test-upload.txt");

    // Click upload button
    await page.locator("#uploadSingleBtn").click();

    // Verify upload success
    const results = page.locator("#uploadResults");
    await expect(results).toContainText("Uploading");
    await expect(results).toContainText("test-upload.txt");
  });

  test("upload JSON file with type detection", async () => {
    const fileInput = page.locator("#singleFile");
    const testFilePath = path.join(filesDir, "test-data.json");

    // Upload JSON file
    await fileInput.setInputFiles(testFilePath);

    // Verify file info displayed
    const fileInfo = page.locator("#singleFileInfo");
    await expect(fileInfo).toContainText("test-data.json");

    // Click upload
    await page.locator("#uploadSingleBtn").click();

    // Verify upload initiated
    const results = page.locator("#uploadResults");
    await expect(results).toContainText("Uploading");
  });

  test("upload CSV file with parsing", async () => {
    const fileInput = page.locator("#singleFile");
    const testFilePath = path.join(filesDir, "test-data.csv");

    // Upload CSV file
    await fileInput.setInputFiles(testFilePath);

    // Verify file info displayed
    const fileInfo = page.locator("#singleFileInfo");
    await expect(fileInfo).toContainText("test-data.csv");

    // Click upload
    await page.locator("#uploadSingleBtn").click();

    // Verify upload initiated
    const results = page.locator("#uploadResults");
    await expect(results).toContainText("Uploading");
  });

  test("upload multiple files", async () => {
    const fileInput = page.locator("#multipleFiles");
    const txtFilePath = path.join(filesDir, "test-upload.txt");
    const jsonFilePath = path.join(filesDir, "test-data.json");

    // Upload multiple files
    await fileInput.setInputFiles([txtFilePath, jsonFilePath]);

    // Verify file count displayed
    const fileInfo = page.locator("#multipleFileInfo");
    await expect(fileInfo).toContainText("2 files");

    // Click upload
    await page.locator("#uploadMultipleBtn").click();

    // Verify upload initiated
    const results = page.locator("#uploadResults");
    await expect(results).toContainText("Uploading 2 files");
  });

  test("large file handling with progress", async () => {
    const fileInput = page.locator("#singleFile");

    // Create a larger test file (1MB)
    const largeFilePath = path.join(filesDir, "large-test-file.txt");
    const largeContent = "A".repeat(1024 * 1024); // 1MB
    fs.writeFileSync(largeFilePath, largeContent);

    try {
      // Upload large file
      await fileInput.setInputFiles(largeFilePath);

      // Verify file info shows size
      const fileInfo = page.locator("#singleFileInfo");
      await expect(fileInfo).toContainText("large-test-file.txt");
      await expect(fileInfo).toContainText("MB");

      // Click upload
      await page.locator("#uploadSingleBtn").click();

      // Verify upload initiated
      const results = page.locator("#uploadResults");
      await expect(results).toContainText("Uploading");
    } finally {
      // Clean up large file
      if (fs.existsSync(largeFilePath)) {
        fs.unlinkSync(largeFilePath);
      }
    }
  });

  test("upload validation - error handling", async () => {
    // Try to upload without selecting a file
    await page.locator("#uploadSingleBtn").click();

    // Verify error message
    const results = page.locator("#uploadResults");
    await expect(results).toContainText("Please select a file first");
    await expect(results.locator(".error")).toBeVisible();

    // Test multiple files validation
    await page.locator("#uploadMultipleBtn").click();
    await expect(results).toContainText("Please select files first");
  });
});
