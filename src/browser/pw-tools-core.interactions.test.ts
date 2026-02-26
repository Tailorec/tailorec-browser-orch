import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { discoverDropdownOptionsViaPlaywright } from "./pw-tools-core.interactions.js";
import { createPageViaPlaywright, closePlaywrightBrowserConnection } from "./pw-session.js";

test("discoverDropdownOptionsViaPlaywright finds options with real browser", async () => {
    // Start a real browser with remote debugging port
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--remote-debugging-port=9223']
    });
    
    try {
        const cdpUrl = "http://127.0.0.1:9223";
        
        // Create a page using the tool we want to test with
        const { targetId } = await createPageViaPlaywright({
            cdpUrl,
            url: "about:blank"
        });

        // We need to get the actual Playwright Page object to set its content
        // Since we are using createPageViaPlaywright, it will be cached in pw-session
        const { getPageForTargetId } = await import("./pw-session.js");
        const page = await getPageForTargetId({ cdpUrl, targetId });

        await page.setContent(`
            <html>
                <body>
                    <div id="dropdown-trigger" role="combobox" style="padding: 10px; border: 1px solid black;">Select option</div>
                    <div id="container"></div>
                    <script>
                        document.getElementById('dropdown-trigger').onclick = () => {
                            const list = document.createElement('ul');
                            list.setAttribute('role', 'listbox');
                            list.innerHTML = \`
                                <li role="option" data-value="opt1">Option 1</li>
                                <li role="option" data-value="opt2">Option 2</li>
                            \`;
                            document.getElementById('container').appendChild(list);
                        };
                    </script>
                </body>
            </html>
        `);

        // We also need to mock role refs for the target
        const { rememberRoleRefsForTarget } = await import("./pw-session.js");
        rememberRoleRefsForTarget({
            cdpUrl,
            targetId,
            refs: {
                "e1": { role: "combobox" }
            }
        });

        const result = await discoverDropdownOptionsViaPlaywright({
            cdpUrl,
            targetId,
            ref: "e1",
        });

        assert.ok(result.dropdownOpen, "Dropdown should be detected as open");
        const options = result.options.filter(o => o.role === 'option');
        assert.equal(options.length, 2, "Should find 2 options");
        assert.equal(options[0].text, 'Option 1');
        assert.equal(options[1].text, 'Option 2');
        
        // Verify trigger method
        assert.equal(result.triggerMethod, 'click');

        // Verify that we can click the discovered option using the ref
        const optionRef = options[0].ref;
        const { clickViaPlaywright } = await import("./pw-tools-core.interactions.js");
        await clickViaPlaywright({
            cdpUrl,
            targetId,
            ref: optionRef
        });

        // Verify that it was clicked (in our case, just that no error was thrown)
    } finally {
        await closePlaywrightBrowserConnection();
        await browser.close();
    }
});
