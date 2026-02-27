import { describe, expect, it } from "vitest";
import {
  clickViaPlaywright,
  discoverDropdownOptionsViaPlaywright,
} from "../../browser/pw-tools-core.interactions.js";
import {
  closePlaywrightBrowserConnection,
  createPageViaPlaywright,
  getPageForTargetId,
  rememberRoleRefsForTarget,
} from "../../browser/pw-session.js";
import { withRemoteDebugBrowser } from "../helpers/remote-debug-browser.js";

describe("integration: pw tools interactions", () => {
  it("discoverDropdownOptionsViaPlaywright finds options with real browser", async () => {
    await withRemoteDebugBrowser(async (cdpUrl) => {
      try {
        const { targetId } = await createPageViaPlaywright({
          cdpUrl,
          url: "about:blank",
        });

        const page = await getPageForTargetId({ cdpUrl, targetId });
        await page.setContent(`
          <html>
            <body>
              <div id=\"dropdown-trigger\" role=\"combobox\" style=\"padding: 10px; border: 1px solid black;\">Select option</div>
              <div id=\"container\"></div>
              <script>
                document.getElementById('dropdown-trigger').onclick = () => {
                  const list = document.createElement('ul');
                  list.setAttribute('role', 'listbox');
                  list.innerHTML = '<li role="option" data-value="opt1">Option 1</li><li role="option" data-value="opt2">Option 2</li>';
                  document.getElementById('container').appendChild(list);
                };
              </script>
            </body>
          </html>
        `);

        rememberRoleRefsForTarget({
          cdpUrl,
          targetId,
          refs: { e1: { role: "combobox" } },
        });

        const result = await discoverDropdownOptionsViaPlaywright({ cdpUrl, targetId, ref: "e1" });
        const options = result.options.filter((o) => o.role === "option");

        expect(result.dropdownOpen).toBe(true);
        expect(options).toHaveLength(2);
        expect(options[0]?.text).toBe("Option 1");
        expect(options[1]?.text).toBe("Option 2");
        expect(result.triggerMethod).toBe("click");

        const optionRef = options[0]?.ref;
        expect(optionRef).toBeTruthy();
        await clickViaPlaywright({ cdpUrl, targetId, ref: optionRef! });
      } finally {
        await closePlaywrightBrowserConnection();
      }
    });
  });
});
