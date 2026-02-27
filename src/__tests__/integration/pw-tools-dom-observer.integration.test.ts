import { describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import {
  snapshotDeltaViaPlaywright,
  startDomObserver,
  stopDomObserver,
} from "../../browser/pw-tools-core.dom-observer.js";

describe("integration: dom observer", () => {
  it("MutationObserver detects added elements", async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.setContent(`
        <html>
          <body>
            <div id=\"container\"></div>
            <button id=\"trigger\">Add Element</button>
            <script>
              document.getElementById('trigger').onclick = () => {
                const el = document.createElement('div');
                el.id = 'new-el';
                el.style.width = '100px';
                el.style.height = '20px';
                el.textContent = 'I am new';
                el.setAttribute('role', 'status');
                document.getElementById('container').appendChild(el);
              };
            </script>
          </body>
        </html>
      `);

      const startResult = await snapshotDeltaViaPlaywright({
        page,
        action: "start",
        cdpUrl: "",
      });
      expect(startResult).toEqual({ observing: true });

      await page.click("#trigger");
      await page.waitForSelector("#new-el");

      const delta = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "",
      });

      expect("addedElements" in delta).toBe(true);
      if ("addedElements" in delta) {
        expect(delta.addedElements.length).toBeGreaterThanOrEqual(1);
        const added = delta.addedElements.find((el) => el.text === "I am new");
        expect(added).toBeTruthy();
        expect(added?.role).toBe("status");
        expect(added?.tagName).toBe("div");
      }
    } finally {
      await browser.close();
    }
  });

  it("MutationObserver detects removed elements", async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.setContent(`
        <html>
          <body>
            <div id=\"to-remove\" aria-ref=\"e1\">Remove me</div>
            <button id=\"trigger\">Remove</button>
            <script>
              document.getElementById('trigger').onclick = () => {
                const el = document.getElementById('to-remove');
                el.remove();
              };
            </script>
          </body>
        </html>
      `);

      await snapshotDeltaViaPlaywright({
        page,
        action: "start",
        cdpUrl: "",
      });

      await page.click("#trigger");

      const delta = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "",
      });

      expect("removedElements" in delta).toBe(true);
      if ("removedElements" in delta) {
        expect(delta.removedElements.length).toBeGreaterThanOrEqual(1);
        const removed = delta.removedElements.find((el) => el.text === "Remove me");
        expect(removed).toBeTruthy();
        expect(removed?.ref).toBe("e1");
      }
    } finally {
      await browser.close();
    }
  });

  it("MutationObserver detects attribute changes", async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.setContent(`
        <html>
          <body>
            <input id=\"target\" aria-invalid=\"false\" value=\"old\">
            <button id=\"trigger\">Change</button>
            <script>
              document.getElementById('trigger').onclick = () => {
                const el = document.getElementById('target');
                el.setAttribute('aria-invalid', 'true');
                el.value = 'new';
              };
            </script>
          </body>
        </html>
      `);

      await snapshotDeltaViaPlaywright({
        page,
        action: "start",
        cdpUrl: "",
      });

      await page.click("#trigger");

      const delta = await snapshotDeltaViaPlaywright({
        page,
        action: "stop",
        cdpUrl: "",
      });

      expect("modifiedElements" in delta).toBe(true);
      if ("modifiedElements" in delta) {
        const invalidChange = delta.modifiedElements.find((m) => m.attr === "aria-invalid");
        expect(invalidChange).toBeTruthy();
        expect(invalidChange?.newValue).toBe("true");
      }
    } finally {
      await browser.close();
    }
  });

  it("captures new dropdown options", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.setContent(`
        <html>
          <body>
            <button id=\"trigger\">Click me</button>
            <div id=\"container\"></div>
            <script>
              document.getElementById('trigger').onclick = () => {
                const div = document.createElement('div');
                div.innerHTML = '<div role=\"option\" data-value=\"val1\">Option 1</div>';
                document.getElementById('container').appendChild(div);
              };
            </script>
          </body>
        </html>
      `);

      await startDomObserver(page);
      await page.click("#trigger");
      await page.waitForTimeout(200);
      const snapshot = await stopDomObserver(page);

      expect(snapshot.newElements.length).toBeGreaterThanOrEqual(1);
      const option = snapshot.newElements.find((e) => e.role === "option");
      expect(option).toBeTruthy();
      expect(option?.text).toBe("Option 1");
    } finally {
      await browser.close();
    }
  });
});
