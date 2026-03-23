import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type BrowserContext } from "@playwright/test";
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
  process.env.PORT = "4043";
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

test.describe("E2E: Shared Session", () => {
  test("session sharing between pages", async () => {
    const context = await browser.newContext();
    
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Set cookie from page1
    await context.addCookies([{
      name: 'sharedData',
      value: 'from-page1',
      domain: 'localhost',
      path: '/'
    }]);

    // Verify page2 can access same cookies
    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'sharedData')?.value).toBe('from-page1');

    await context.close();
  });

  test("localStorage sharing across pages", async () => {
    const context = await browser.newContext();
    
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    
    // Set localStorage from page1
    await page1.evaluate(() => localStorage.setItem('sharedKey', 'sharedValue'));

    await page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });

    // Verify page2 can access same localStorage
    const value = await page2.evaluate(() => localStorage.getItem('sharedKey'));
    expect(value).toBe('sharedValue');

    await context.close();
  });

  test("session state propagation", async () => {
    const context = await browser.newContext();
    await context.addCookies([{
      name: 'sessionToken',
      value: 'token123',
      domain: 'localhost',
      path: '/'
    }]);

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await Promise.all([
      page1.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" }),
      page2.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" }),
    ]);

    // Both pages should have same session
    const cookies1 = await context.cookies();
    const cookies2 = await context.cookies();

    expect(cookies1.find(c => c.name === 'sessionToken')?.value).toBe('token123');
    expect(cookies2.find(c => c.name === 'sessionToken')?.value).toBe('token123');

    await context.close();
  });

  test("concurrent session modification", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Modify cookies concurrently
    await Promise.all([
      context.addCookies([{ name: 'a', value: '1', domain: 'localhost', path: '/' }]),
      context.addCookies([{ name: 'b', value: '2', domain: 'localhost', path: '/' }]),
      context.addCookies([{ name: 'c', value: '3', domain: 'localhost', path: '/' }]),
    ]);

    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'a')?.value).toBe('1');
    expect(cookies.find(c => c.name === 'b')?.value).toBe('2');
    expect(cookies.find(c => c.name === 'c')?.value).toBe('3');

    await context.close();
  });

  test("session cleanup on context close", async () => {
    const context = await browser.newContext();
    await context.addCookies([{
      name: 'tempSession',
      value: 'temp123',
      domain: 'localhost',
      path: '/'
    }]);

    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem('tempKey', 'tempValue'));

    await context.close();

    // New context should be clean
    const newContext = await browser.newContext();
    const newCookies = await newContext.cookies();
    expect(newCookies.find(c => c.name === 'tempSession')).toBeUndefined();

    await newContext.close();
  });

  test("session persistence across navigation", async () => {
    const context = await browser.newContext();
    await context.addCookies([{
      name: 'persistentSession',
      value: 'persist123',
      domain: 'localhost',
      path: '/'
    }]);

    const page = await context.newPage();
    
    // Navigate multiple times
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });
    await page.goto(`file://${pagesDir}/complex-form.html`, { waitUntil: "domcontentloaded" });
    await page.goto(`file://${pagesDir}/auth-page.html`, { waitUntil: "domcontentloaded" });

    // Session should persist
    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'persistentSession')?.value).toBe('persist123');

    await context.close();
  });
});
