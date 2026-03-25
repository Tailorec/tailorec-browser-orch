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
  process.env.PORT = "4037";
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

test.describe("E2E: Dynamic Content", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("content changes during test", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="dynamic">Initial Content</div>
          <script>
            setTimeout(() => {
              document.getElementById('dynamic').textContent = 'Updated Content';
            }, 500);
          </script>
        </body>
      </html>
    `);

    // Verify initial content
    await expect(page.locator("#dynamic")).toHaveText("Initial Content");

    // Wait for update
    await page.waitForTimeout(800);

    // Verify updated content
    await expect(page.locator("#dynamic")).toHaveText("Updated Content");
  });

  test("real-time updates", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="counter">0</div>
          <script>
            let count = 0;
            setInterval(() => {
              document.getElementById('counter').textContent = ++count;
            }, 200);
          </script>
        </body>
      </html>
    `);

    // Verify counter starts at 0
    await expect(page.locator("#counter")).toHaveText("0");

    // Wait for updates
    await page.waitForTimeout(700);

    // Verify counter increased
    const text = await page.locator("#counter").textContent();
    expect(parseInt(text || "0")).toBeGreaterThan(2);
  });

  test("wait for dynamic content", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="loading">Loading...</div>
          <div id="content" style="display: none;">Dynamic Content Loaded</div>
          <script>
            setTimeout(() => {
              document.getElementById('loading').style.display = 'none';
              document.getElementById('content').style.display = 'block';
            }, 800);
          </script>
        </body>
      </html>
    `);

    // Wait for content to appear
    await page.waitForSelector("#content", { state: "visible", timeout: 5000 });

    // Verify content loaded
    await expect(page.locator("#content")).toHaveText("Dynamic Content Loaded");
  });

  test("polling for changes", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="status">pending</div>
          <script>
            setTimeout(() => {
              document.getElementById('status').textContent = 'ready';
            }, 600);
          </script>
        </body>
      </html>
    `);

    // Poll for status change
    let status = "pending";
    let attempts = 0;
    while (status !== "ready" && attempts < 10) {
      await page.waitForTimeout(200);
      status = await page.locator("#status").textContent() || "pending";
      attempts++;
    }

    expect(status).toBe("ready");
  });

  test("content stability wait", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="unstable">Loading</div>
          <script>
            let updates = 0;
            const interval = setInterval(() => {
              updates++;
              document.getElementById('unstable').textContent = 'Update ' + updates;
              if (updates >= 5) {
                clearInterval(interval);
                document.getElementById('unstable').textContent = 'Stable';
              }
            }, 100);
          </script>
        </body>
      </html>
    `);

    // Wait for content to stabilize
    await page.waitForFunction(() => {
      const el = document.getElementById('unstable');
      return el?.textContent === 'Stable';
    }, { timeout: 5000 });

    // Verify stable
    await expect(page.locator("#unstable")).toHaveText("Stable");
  });
});
