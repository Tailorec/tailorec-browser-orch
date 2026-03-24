import { createHmac } from "node:crypto";
import { test, expect, request, type Browser, type BrowserContext } from "@playwright/test";
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
  process.env.PORT = "4028";
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

test.describe("E2E: Viewport Resizing", () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await browser.newContext();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("resize viewport", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Get initial viewport size
    const initialSize = page.viewportSize();
    expect(initialSize?.width).toBeGreaterThan(0);
    expect(initialSize?.height).toBeGreaterThan(0);

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 600 });

    // Verify new size
    const newSize = page.viewportSize();
    expect(newSize?.width).toBe(800);
    expect(newSize?.height).toBe(600);
  });

  test("verify new dimensions affect layout", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Set small viewport (mobile)
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify page still functional
    await expect(page.locator("h1")).toBeVisible();

    // Set large viewport (desktop)
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Verify page still functional
    await expect(page.locator("h1")).toBeVisible();
  });

  test("responsive layout check", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileHeading = await page.locator("h1").boundingBox();
    expect(mobileHeading).toBeTruthy();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    const tabletHeading = await page.locator("h1").boundingBox();
    expect(tabletHeading).toBeTruthy();

    // Test desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopHeading = await page.locator("h1").boundingBox();
    expect(desktopHeading).toBeTruthy();
  });

  test("multiple resize operations", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Resize multiple times
    const sizes = [
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1024, height: 768 },  // Landscape tablet
      { width: 1920, height: 1080 }, // Desktop
      { width: 800, height: 600 },   // Small desktop
    ];

    for (const size of sizes) {
      await page.setViewportSize(size);
      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(size.width);
      expect(viewport?.height).toBe(size.height);
    }
  });

  test("invalid size handling", async () => {
    const page = await context.newPage();
    await page.goto(`file://${pagesDir}/simple-form.html`, { waitUntil: "domcontentloaded" });

    // Test very small viewport (should still work)
    await page.setViewportSize({ width: 100, height: 100 });
    const smallViewport = page.viewportSize();
    expect(smallViewport?.width).toBe(100);
    expect(smallViewport?.height).toBe(100);

    // Test very large viewport (should work)
    await page.setViewportSize({ width: 2560, height: 1440 });
    const largeViewport = page.viewportSize();
    expect(largeViewport?.width).toBe(2560);
    expect(largeViewport?.height).toBe(1440);

    // Verify page still functional after resizes
    await expect(page.locator("h1")).toBeVisible();
  });
});
