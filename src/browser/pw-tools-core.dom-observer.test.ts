import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { snapshotDeltaViaPlaywright } from "./pw-tools-core.dom-observer.js";

test("MutationObserver detects added elements", async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Load a simple page
    await page.setContent(`
      <html>
        <body>
          <div id="container"></div>
          <button id="trigger">Add Element</button>
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

    // Start observation
    const startResult = await snapshotDeltaViaPlaywright({
      page,
      action: "start",
      cdpUrl: "",
    });
    assert.deepEqual(startResult, { observing: true });

    // Trigger change
    await page.click("#trigger");
    
    // Wait a bit for the observer to catch up (it's sync but just in case)
    await page.waitForSelector("#new-el");

    // Stop observation
    const delta = await snapshotDeltaViaPlaywright({
      page,
      action: "stop",
      cdpUrl: "",
    });

    if ("addedElements" in delta) {
      assert.ok(delta.addedElements.length >= 1, "Should have at least one added element");
      const added = delta.addedElements.find(el => el.text === "I am new");
      assert.ok(added, "Should find the added element by text");
      assert.equal(added?.role, "status");
      assert.equal(added?.tagName, "div");
    } else {
      assert.fail("Delta should contain addedElements");
    }
  } finally {
    await browser.close();
  }
});

test("MutationObserver detects removed elements", async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <html>
        <body>
          <div id="to-remove" aria-ref="e1">Remove me</div>
          <button id="trigger">Remove</button>
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

    if ("removedElements" in delta) {
      assert.ok(delta.removedElements.length >= 1);
      const removed = delta.removedElements.find(el => el.text === "Remove me");
      assert.ok(removed);
      assert.equal(removed?.ref, "e1");
    } else {
      assert.fail("Delta should contain removedElements");
    }
  } finally {
    await browser.close();
  }
});

test("MutationObserver detects attribute changes", async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <html>
        <body>
          <input id="target" aria-invalid="false" value="old">
          <button id="trigger">Change</button>
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

    if ("modifiedElements" in delta) {
      const invalidChange = delta.modifiedElements.find(m => m.attr === "aria-invalid");
      assert.ok(invalidChange);
      assert.equal(invalidChange?.newValue, "true");
      
      // Note: 'value' attribute change might not trigger if it's updated via property 
      // but MutationObserver with attributes: true should catch setAttribute.
      // In many frameworks value is set via property.
    } else {
      assert.fail("Delta should contain modifiedElements");
    }
  } finally {
    await browser.close();
  }
});

// ─── Lightweight dropdown observer tests (Plan 01) ───────────────────

import { startDomObserver, stopDomObserver } from "./pw-tools-core.dom-observer.js";

test("dom observer captures new dropdown options", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.setContent(`
            <html>
                <body>
                    <button id="trigger">Click me</button>
                    <div id="container"></div>
                    <script>
                        document.getElementById('trigger').onclick = () => {
                            const div = document.createElement('div');
                            div.innerHTML = '<div role="option" data-value="val1">Option 1</div>';
                            document.getElementById('container').appendChild(div);
                        };
                    </script>
                </body>
            </html>
        `);

        await startDomObserver(page);
        await page.click('#trigger');
        await page.waitForTimeout(200);
        const snapshot = await stopDomObserver(page);

        assert.ok(snapshot.newElements.length >= 1, "Should have captured new elements");
        const option = snapshot.newElements.find(e => e.role === 'option');
        assert.ok(option, "Should have captured the option element");
        assert.equal(option?.text, 'Option 1');
    } finally {
        await browser.close();
    }
});
