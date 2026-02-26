import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startDomObserver, stopDomObserver } from "./pw-tools-core.dom-observer.js";

test("dom observer captures new elements", async () => {
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
        // Give it a bit of time for the mutation to be processed and our observer to catch it
        await page.waitForTimeout(200);
        const snapshot = await stopDomObserver(page);

        assert.ok(snapshot.newElements.length >= 1, "Should have captured new elements");
        const option = snapshot.newElements.find(e => e.role === 'option');
        assert.ok(option, "Should have captured the option element");
        assert.equal(option?.text, 'Option 1');
        assert.equal(option?.attributes['data-value'], 'val1');
    } finally {
        await browser.close();
    }
});
