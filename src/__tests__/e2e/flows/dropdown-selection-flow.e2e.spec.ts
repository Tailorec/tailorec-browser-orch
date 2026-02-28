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
  process.env.PORT = "4019";
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

test.describe("E2E: Dropdown Selection Flow", () => {
  let page: Page;
  let dropdownUrl: string;

  test.beforeEach(async () => {
    page = await browser.newPage();
    dropdownUrl = `file://${pagesDir}/dropdown-page.html`;
    await page.goto(dropdownUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("select single dropdown option by value", async () => {
    const dropdown = page.locator("#singleSelect");

    // Select by value
    await dropdown.selectOption("option3");

    // Verify selection
    await expect(dropdown).toHaveValue("option3");

    // Verify result updated
    const result = page.locator("#selectedValues");
    await expect(result).toContainText("Single Select: option3");
  });

  test("select dropdown option by label", async () => {
    const dropdown = page.locator("#singleSelect");

    // Select by label
    await dropdown.selectOption({ label: "Option 5" });

    // Verify selection
    await expect(dropdown).toHaveValue("option5");
  });

  test("multi-select dropdown options", async () => {
    const multiSelect = page.locator("#multiSelect");

    // Select multiple options
    await multiSelect.selectOption(["multi1", "multi3", "multi5"]);

    // Verify selections
    const selectedOptions = await multiSelect.evaluateAll(
      (options) => Array.from(options).filter((o) => (o as HTMLOptionElement).selected).map((o) => o.value)
    );
    expect(selectedOptions).toEqual(["multi1", "multi3", "multi5"]);

    // Verify result updated
    const result = page.locator("#selectedValues");
    await expect(result).toContainText("multi1");
    await expect(result).toContainText("multi3");
    await expect(result).toContainText("multi5");
  });

  test("select from dropdown with optgroups", async () => {
    const dropdown = page.locator("#optgroupSelect");

    // Select from first optgroup (Fruits)
    await dropdown.selectOption("banana");
    await expect(dropdown).toHaveValue("banana");

    // Select from second optgroup (Vegetables)
    await dropdown.selectOption("carrot");
    await expect(dropdown).toHaveValue("carrot");

    // Select from third optgroup (Grains)
    await dropdown.selectOption("oats");
    await expect(dropdown).toHaveValue("oats");
  });

  test("dynamic dropdown options loading", async () => {
    const dropdown = page.locator("#dynamicSelect");

    // Verify initial state
    await expect(dropdown).toHaveValue("");

    // Load dynamic options
    await page.locator("#loadDynamic").click();

    // Wait for options to load
    await page.waitForTimeout(500);

    // Verify options loaded
    const options = dropdown.locator("option");
    await expect(options).toHaveCount(10);

    // Select a dynamic option
    await dropdown.selectOption("dynamic5");
    await expect(dropdown).toHaveValue("dynamic5");
  });

  test("clear dynamic dropdown options", async () => {
    const dropdown = page.locator("#dynamicSelect");

    // Load options first
    await page.locator("#loadDynamic").click();
    await page.waitForTimeout(500);

    // Verify options loaded
    let optionCount = await dropdown.locator("option").count();
    expect(optionCount).toBe(10);

    // Clear options
    await page.locator("#clearDynamic").click();

    // Verify options cleared
    optionCount = await dropdown.locator("option").count();
    expect(optionCount).toBe(1);
    await expect(dropdown).toHaveValue("");
  });
});
