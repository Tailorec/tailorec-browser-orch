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
  process.env.PORT = "4036";
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

test.describe("E2E: Lazy Loading", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("wait for lazy-loaded images", async () => {
    await page.setContent(`
      <html>
        <body>
          <img id="img1" loading="lazy" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23007bff' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='14'%3EImage 1%3C/text%3E%3C/svg%3E" alt="Image 1" style="display: block; margin: 500px 0;">
          <img id="img2" loading="lazy" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%2328a745' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='14'%3EImage 2%3C/text%3E%3C/svg%3E" alt="Image 2" style="display: block; margin: 500px 0;">
        </body>
      </html>
    `);

    // Scroll to load images
    await page.locator("#img2").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Verify images loaded
    const img2Loaded = await page.evaluate((selector) => {
      const img = document.querySelector(selector) as HTMLImageElement;
      return img.complete && img.naturalHeight > 0;
    }, "#img2");
    expect(img2Loaded).toBe(true);
  });

  test("scroll to trigger loading", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content" style="height: 2000px;">Scroll down to load</div>
          <div id="bottomTrigger">Bottom</div>
          <div id="lazyContent" style="display: none;">
            <div class="loaded-item">Loaded Item 1</div>
            <div class="loaded-item">Loaded Item 2</div>
          </div>
          <script>
            const observer = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  document.getElementById('lazyContent').style.display = 'block';
                }
              });
            });
            observer.observe(document.getElementById('bottomTrigger'));
          </script>
        </body>
      </html>
    `);

    // Lazy content should be hidden initially
    await expect(page.locator("#lazyContent")).not.toBeVisible();

    // Scroll to trigger loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Verify content loaded
    await expect(page.locator("#lazyContent")).toBeVisible();
  });

  test("verify loaded content", async () => {
    await page.setContent(`
      <html>
        <body>
          <div style="height: 1000px;"></div>
          <div id="lazy" style="display: none;">
            <h2>Lazy Loaded Content</h2>
            <p>This content was loaded on scroll.</p>
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('lazy').style.display = 'block';
            }, 500);
          </script>
        </body>
      </html>
    `);

    // Wait for content to load
    await page.waitForTimeout(800);

    // Verify content
    await expect(page.locator("#lazy h2")).toHaveText("Lazy Loaded Content");
  });

  test("act on loaded elements", async () => {
    await page.setContent(`
      <html>
        <body>
          <div style="height: 1000px;"></div>
          <div id="lazy">
            <button id="lazyBtn" style="display: none;" onclick="this.textContent='Clicked!'">Click Me</button>
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('lazyBtn').style.display = 'block';
            }, 300);
          </script>
        </body>
      </html>
    `);

    // Wait for button to appear
    await page.waitForTimeout(500);

    // Click button
    await page.locator("#lazyBtn").click();

    // Verify action
    await expect(page.locator("#lazyBtn")).toHaveText("Clicked!");
  });

  test("timeout handling for lazy loading", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="neverLoads" style="display: none;">
            This will never load
          </div>
        </body>
      </html>
    `);

    // Try to wait for element that never loads
    let error: Error | null = null;
    try {
      await page.waitForSelector("#neverLoads", { state: "visible", timeout: 1000 });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeTruthy();

    // Verify page still functional
    await expect(page.locator("body")).toBeVisible();
  });
});
