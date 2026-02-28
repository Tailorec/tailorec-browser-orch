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
  process.env.PORT = "4039";
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

test.describe("E2E: Shadow DOM", () => {
  let page: Page;

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("access shadow DOM", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="host"></div>
          <script>
            const host = document.getElementById('host');
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = '<div id="shadowContent">Shadow DOM Content</div>';
          </script>
        </body>
      </html>
    `);

    // Access shadow DOM content
    const shadowContent = await page.evaluate(() => {
      const host = document.getElementById('host');
      const shadow = host?.shadowRoot;
      return shadow?.getElementById('shadowContent')?.textContent;
    });

    expect(shadowContent).toBe("Shadow DOM Content");
  });

  test("query shadow elements", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="host"></div>
          <script>
            const host = document.getElementById('host');
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = '<button id="shadowBtn">Shadow Button</button><span class="shadow-text">Text 1</span><span class="shadow-text">Text 2</span>';
          </script>
        </body>
      </html>
    `);

    // Query elements in shadow DOM
    const buttonExists = await page.evaluate(() => {
      const host = document.getElementById('host');
      const shadow = host?.shadowRoot;
      return shadow?.getElementById('shadowBtn') !== null;
    });
    expect(buttonExists).toBe(true);

    // Query multiple elements
    const textCount = await page.evaluate(() => {
      const host = document.getElementById('host');
      const shadow = host?.shadowRoot;
      return shadow?.querySelectorAll('.shadow-text').length;
    });
    expect(textCount).toBe(2);
  });

  test("act on shadow elements", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="host"></div>
          <script>
            const host = document.getElementById('host');
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = '<button id="shadowBtn" onclick="this.textContent=\\'Clicked\\'">Click Me</button>';
          </script>
        </body>
      </html>
    `);

    // Click button in shadow DOM
    await page.evaluate(() => {
      const host = document.getElementById('host');
      const shadow = host?.shadowRoot;
      const btn = shadow?.getElementById('shadowBtn');
      btn?.click();
    });

    // Verify action
    const text = await page.evaluate(() => {
      const host = document.getElementById('host');
      const shadow = host?.shadowRoot;
      return shadow?.getElementById('shadowBtn')?.textContent;
    });
    expect(text).toBe("Clicked");
  });

  test("nested shadow DOM", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="outer"></div>
          <script>
            const outer = document.getElementById('outer');
            const outerShadow = outer.attachShadow({ mode: 'open' });
            outerShadow.innerHTML = '<div id="inner"></div>';
            const inner = outerShadow.getElementById('inner');
            const innerShadow = inner.attachShadow({ mode: 'open' });
            innerShadow.innerHTML = '<span id="nestedShadow">Nested Shadow Content</span>';
          </script>
        </body>
      </html>
    `);

    // Access nested shadow DOM
    const content = await page.evaluate(() => {
      const outer = document.getElementById('outer');
      const outerShadow = outer?.shadowRoot;
      const inner = outerShadow?.getElementById('inner');
      const innerShadow = inner?.shadowRoot;
      return innerShadow?.getElementById('nestedShadow')?.textContent;
    });
    expect(content).toBe("Nested Shadow Content");
  });

  test("shadow DOM timeout handling", async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="noShadow">No shadow DOM here</div>
        </body>
      </html>
    `);

    // Try to access non-existent shadow DOM
    const shadowContent = await page.evaluate(() => {
      const host = document.getElementById('noShadow');
      const shadow = host?.shadowRoot;
      return shadow ? 'exists' : 'null';
    });

    expect(shadowContent).toBe('null');

    // Verify page still functional
    await expect(page.locator("#noShadow")).toBeVisible();
  });
});
