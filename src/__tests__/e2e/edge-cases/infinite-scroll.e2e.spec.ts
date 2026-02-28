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
  process.env.PORT = "4035";
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

test.describe("E2E: Infinite Scroll", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("trigger infinite scroll", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content">
            ${Array.from({ length: 20 }, (_, i) => `<div class="item">Item ${i + 1}</div>`).join('')}
          </div>
          <script>
            let count = 20;
            window.addEventListener('scroll', () => {
              if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
                for (let i = 0; i < 10; i++) {
                  const div = document.createElement('div');
                  div.className = 'item';
                  div.textContent = 'Item ' + (++count);
                  document.getElementById('content').appendChild(div);
                }
              }
            });
          </script>
          <style>.item { padding: 10px; height: 50px; }</style>
        </body>
      </html>
    `);

    // Scroll to trigger load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Verify more items loaded
    const itemCount = await page.locator(".item").count();
    expect(itemCount).toBeGreaterThan(20);
  });

  test("load multiple pages of content", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content"></div>
          <script>
            let count = 0;
            function loadMore() {
              for (let i = 0; i < 10; i++) {
                const div = document.createElement('div');
                div.className = 'item';
                div.textContent = 'Item ' + (++count);
                document.getElementById('content').appendChild(div);
              }
            }
            loadMore();
            window.addEventListener('scroll', () => {
              if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
                loadMore();
              }
            });
          </script>
          <style>.item { padding: 10px; height: 50px; }</style>
        </body>
      </html>
    `);

    // Scroll multiple times
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
    }

    // Verify many items loaded
    const itemCount = await page.locator(".item").count();
    expect(itemCount).toBeGreaterThanOrEqual(40);
  });

  test("stop scrolling", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content">
            ${Array.from({ length: 20 }, (_, i) => `<div class="item">Item ${i + 1}</div>`).join('')}
          </div>
          <button id="stopBtn" onclick="stopped = true">Stop Loading</button>
          <script>
            let count = 20;
            let stopped = false;
            window.addEventListener('scroll', () => {
              if (!stopped && window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
                for (let i = 0; i < 10; i++) {
                  const div = document.createElement('div');
                  div.className = 'item';
                  div.textContent = 'Item ' + (++count);
                  document.getElementById('content').appendChild(div);
                }
              }
            });
          </script>
          <style>.item { padding: 10px; height: 50px; }</style>
        </body>
      </html>
    `);

    // Stop loading
    await page.locator("#stopBtn").click();

    // Scroll - should not load more
    const initialCount = await page.locator(".item").count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const finalCount = await page.locator(".item").count();
    expect(finalCount).toBe(initialCount);
  });

  test("act on loaded content", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content"></div>
          <script>
            let count = 0;
            function loadMore() {
              for (let i = 0; i < 5; i++) {
                const div = document.createElement('div');
                div.className = 'item';
                div.innerHTML = '<button class="actionBtn" onclick="this.textContent=\'Clicked\'">Item ' + (++count) + '</button>';
                document.getElementById('content').appendChild(div);
              }
            }
            loadMore();
            window.addEventListener('scroll', () => {
              if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
                loadMore();
              }
            });
          </script>
          <style>.item { padding: 10px; height: 60px; }</style>
        </body>
      </html>
    `);

    // Scroll to load more
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Click a button in loaded content
    const buttons = page.locator(".actionBtn");
    await buttons.nth(5).click();

    // Verify action completed
    await expect(buttons.nth(5)).toHaveText("Clicked");
  });

  test("memory cleanup after infinite scroll", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content"></div>
          <script>
            let count = 0;
            function loadMore() {
              for (let i = 0; i < 20; i++) {
                const div = document.createElement('div');
                div.className = 'item';
                div.textContent = 'Item ' + (++count);
                document.getElementById('content').appendChild(div);
              }
            }
            loadMore();
            window.addEventListener('scroll', () => {
              if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
                loadMore();
              }
            });
          </script>
          <style>.item { padding: 10px; height: 50px; }</style>
        </body>
      </html>
    `);

    // Scroll multiple times
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
    }

    // Verify page still responsive
    const itemCount = await page.locator(".item").count();
    expect(itemCount).toBeGreaterThan(50);

    // Navigate away (cleanup)
    await page.goto("about:blank");
    await expect(page).toHaveURL("about:blank");
  });
});
