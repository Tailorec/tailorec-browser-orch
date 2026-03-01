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
  process.env.PORT = "4038";
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

test.describe("E2E: Iframe Handling", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("access iframe content", async () => {
    const iframeHtml = `<html><body><h1 id='iframeContent'>Iframe Content</h1></body></html>`;
    const dataUrl = `data:text/html;base64,${Buffer.from(iframeHtml).toString('base64')}`;
    
    await page.setContent(`
      <html>
        <body>
          <iframe id="testFrame" src="${dataUrl}"></iframe>
        </body>
      </html>
    `);

    // Wait for iframe to load
    const frame = page.frameLocator("#testFrame");
    await expect(frame.locator("#iframeContent")).toBeVisible({ timeout: 5000 });
  });

  test("act within iframe", async () => {
    const iframeHtml = `<html><body><button id='iframeBtn' onclick='this.textContent="Clicked"'>Click Me</button></body></html>`;
    const dataUrl = `data:text/html;base64,${Buffer.from(iframeHtml).toString('base64')}`;

    await page.setContent(`
      <html>
        <body>
          <iframe id="testFrame" src="${dataUrl}"></iframe>
        </body>
      </html>
    `);

    // Click button inside iframe
    const frame = page.frameLocator("#testFrame");
    const btn = frame.locator("#iframeBtn");
    await btn.waitFor({ state: "visible", timeout: 5000 });
    await btn.click();

    // Verify action
    await expect(btn).toHaveText("Clicked", { timeout: 5000 });
  });

  test("nested iframes", async () => {
    const innerHtml = `<html><body><div id='nestedContent'>Nested</div></body></html>`;
    const innerDataUrl = `data:text/html;base64,${Buffer.from(innerHtml).toString('base64')}`;
    const outerHtml = `<html><body><iframe id='innerFrame' src='${innerDataUrl}'></iframe></body></html>`;
    const outerDataUrl = `data:text/html;base64,${Buffer.from(outerHtml).toString('base64')}`;

    await page.setContent(`
      <html>
        <body>
          <iframe id="outerFrame" src="${outerDataUrl}"></iframe>
        </body>
      </html>
    `);

    // Access nested iframe
    const outerFrame = page.frameLocator("#outerFrame");
    const innerFrame = outerFrame.frameLocator("#innerFrame");
    const nested = innerFrame.locator("#nestedContent");
    
    // Verify nested content
    await expect(nested).toBeVisible({ timeout: 10000 });
  });

  test("iframe timeout handling", async () => {
    await page.setContent(`
      <html>
        <body>
          <iframe id="slowFrame" src="about:blank"></iframe>
        </body>
      </html>
    `);

    // Try to access iframe content that doesn't exist
    let error: Error | null = null;
    try {
      const frame = page.frameLocator("#slowFrame");
      await frame.locator("#nonExistent").waitFor({ state: "visible", timeout: 1000 });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeTruthy();

    // Verify page still functional
    await expect(page.locator("body")).toBeVisible();
  });

  test("iframe with dynamic content", async () => {
    await page.setContent(`
      <html>
        <body>
          <iframe id="dynamicFrame"></iframe>
          <script>
            setTimeout(() => {
              const iframe = document.getElementById('dynamicFrame');
              iframe.srcdoc = '<html><body><div id="dynamicContent">Dynamically Loaded</div></body></html>';
            }, 500);
          </script>
        </body>
      </html>
    `);

    // Wait for iframe content to load
    await page.waitForTimeout(800);

    const frame = page.frameLocator("#dynamicFrame");
    await expect(frame.locator("#dynamicContent")).toBeVisible();
    await expect(frame.locator("#dynamicContent")).toHaveText("Dynamically Loaded");
  });
});
