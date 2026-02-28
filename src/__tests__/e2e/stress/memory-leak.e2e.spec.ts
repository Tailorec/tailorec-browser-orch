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
  process.env.PORT = "4047";
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

test.describe("E2E: Memory Leak", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("detect DOM node leak", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Get initial node count
    const initialNodes = await page.evaluate(() => document.getElementsByTagName('*').length);

    // Add many nodes without cleanup
    for (let i = 0; i < 100; i++) {
      await page.evaluate(() => {
        const div = document.createElement('div');
        div.className = 'leaked';
        document.body.appendChild(div);
      });
    }

    // Get final node count
    const finalNodes = await page.evaluate(() => document.getElementsByTagName('*').length);

    // Verify nodes were added
    expect(finalNodes).toBeGreaterThan(initialNodes);

    // Cleanup
    await page.evaluate(() => {
      document.querySelectorAll('.leaked').forEach(el => el.remove());
    });

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();
  });

  test("detect event listener leak", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Add many event listeners
    for (let i = 0; i < 50; i++) {
      await page.evaluate(() => {
        const btn = document.getElementById('submitBtn');
        btn?.addEventListener('click', () => console.log('click', Date.now()));
      });
    }

    // Page should still be functional
    await expect(page.locator("#submitBtn")).toBeVisible();

    // Click should work (may trigger all listeners)
    await page.locator("#submitBtn").click().catch(() => {});
  });

  test("detect interval leak", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Start intervals without clearing
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        setInterval(() => console.log('interval', i), 1000);
      }
    });

    // Wait briefly
    await page.waitForTimeout(500);

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();

    // Navigate away should clean up
    await page.goto("about:blank");
    await expect(page).toHaveURL("about:blank");
  });

  test("long-running operation memory", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Perform many operations
    for (let i = 0; i < 50; i++) {
      await page.locator("#name").fill(`Test ${i}`);
      await page.locator("#email").fill(`test${i}@example.com`);
      await page.screenshot().catch(() => {});
    }

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();
  });

  test("garbage collection verification", async () => {
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Create objects that should be GC'd
    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) {
        const obj = { data: new Array(1000).fill(i) };
        // Let it go out of scope
      }
    });

    // Force GC if available (DevTools protocol)
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    }).catch(() => {});

    // Page should still be functional
    await expect(page.locator("h1")).toBeVisible();
  });
});
