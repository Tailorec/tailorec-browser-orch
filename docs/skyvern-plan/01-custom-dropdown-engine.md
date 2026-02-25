# 01 — Custom Dropdown Engine

## Problem

Job application forms (Greenhouse, Lever, Workday, iCIMS, Taleo) heavily use **custom dropdown components** — React/Vue/CSS-based select widgets that are NOT native `<select>` elements. These appear as `<div>`, `<input>`, or `<span>` elements that, when clicked, spawn a dynamic list of options into the DOM.

### Current Failure Mode

1. Agent sees `combobox "Country" [ref=e14]` in snapshot
2. Agent calls `browser.act.fill({ ref: "e14", type: "text", value: "United States" })`
3. `locator.fill("United States")` types the text — but the custom widget ignores `.fill()` or treats it as a search filter without selecting
4. The field remains visually unset; form validation fails on submit
5. Agent has no way to detect the dropdown opened, see the options, or click the right one

### How Skyvern Solves This

Skyvern uses a **MutationObserver-based incremental DOM listener** (see `skyvern/webeye/scraper/scraper.py:IncrementalScrapePage`):

1. Before clicking an element, starts `MutationObserver` on the DOM
2. Clicks the element (or presses ArrowDown)
3. Waits for animation end
4. Reads the incremental DOM tree — only newly-appeared nodes
5. Passes new nodes to LLM to pick the correct option
6. Clicks the chosen option
7. Verifies the dropdown closed

Key Skyvern code: `handler.py:handle_select_option_action` (~400 lines), `handler.py:sequentially_select_from_dropdown`, `handler.py:select_from_emerging_elements`

---

## Implementation Plan

### Phase 1: openclaw-browser — DOM Mutation Observer Infrastructure

#### File: `src/browser/pw-tools-core.dom-observer.ts` (NEW)

Create a new module that injects and manages DOM mutation observation:

```typescript
/**
 * Inject a MutationObserver into the page that tracks new interactive elements
 * appearing after a trigger action (click, keypress).
 *
 * Design inspired by Skyvern's IncrementalScrapePage.
 */

export type IncrementalElement = {
  ref: string;           // assigned ref for the new element
  tagName: string;       // e.g. "div", "li", "option", "span"
  role: string | null;   // aria role if any
  text: string;          // visible text content
  attributes: Record<string, string>; // relevant attrs (value, data-value, aria-selected, etc.)
  isInteractable: boolean;
  rect: { x: number; y: number; width: number; height: number } | null;
};

export type IncrementalSnapshot = {
  newElements: IncrementalElement[];
  removedCount: number;
  observationDurationMs: number;
};
```

**Functions to implement:**

1. `startDomObserver(page, anchorRef?)` — Injects JS into page:
   - Creates `MutationObserver` watching `childList` + `subtree` on `document.body` (or anchor element subtree)
   - Stores new nodes in `window.__skyvernIncrementalNodes = []`
   - Filters: only track nodes that are visible, have text content, or have interactive roles
   - Records: tagName, textContent, aria attributes, bounding rect, data-value

2. `stopDomObserver(page)` — Disconnects observer, returns incremental snapshot

3. `getIncrementalElements(page, options?)` — Reads `window.__skyvernIncrementalNodes`, builds element tree, assigns temporary refs, returns `IncrementalSnapshot`

**JS to inject (inspired by Skyvern's `domUtils.js` lines 2800-2971):**

```javascript
// Injected into page context
window.__skyvernIncrementalNodes = [];
window.__skyvernObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node;
      // Walk the subtree of the added node
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
      let current = el;
      while (current) {
        const rect = current.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        if (isVisible) {
          window.__skyvernIncrementalNodes.push({
            tagName: current.tagName.toLowerCase(),
            role: current.getAttribute('role'),
            text: (current.textContent || '').trim().slice(0, 200),
            ariaLabel: current.getAttribute('aria-label'),
            ariaSelected: current.getAttribute('aria-selected'),
            dataValue: current.getAttribute('data-value') || current.getAttribute('value'),
            className: current.className?.toString?.()?.slice(0, 100) || '',
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            isInteractable: (
              current.tagName === 'BUTTON' ||
              current.tagName === 'A' ||
              current.tagName === 'INPUT' ||
              current.tagName === 'OPTION' ||
              current.getAttribute('role') === 'option' ||
              current.getAttribute('role') === 'menuitem' ||
              current.getAttribute('role') === 'listitem' ||
              current.getAttribute('tabindex') !== null ||
              current.onclick !== null ||
              getComputedStyle(current).cursor === 'pointer'
            ),
          });
        }
        current = walker.nextNode();
      }
    }
  }
});
window.__skyvernObserver.observe(
  arguments[0] || document.body,
  { childList: true, subtree: true }
);
```

#### File: `src/browser/pw-tools-core.interactions.ts` — Add `smartSelectViaPlaywright`

Add a new function after `selectOptionViaPlaywright` (~line 152):

```typescript
/**
 * Smart select for custom dropdown components.
 *
 * Algorithm:
 * 1. Start DOM mutation observer on the target element's subtree + ancestors
 * 2. Click the target element to open dropdown
 * 3. Wait for animation (300ms + check for new elements)
 * 4. If no new elements: try ArrowDown key, wait again
 * 5. If still no new elements: try typing the value to trigger typeahead
 * 6. Collect incremental elements
 * 7. Return the options to caller (agent decides which to click)
 *
 * Does NOT pick the option — returns the discovered options so the LLM can choose.
 */
export async function discoverDropdownOptionsViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
  searchText?: string;      // optional text to type for typeahead filtering
  timeoutMs?: number;
}): Promise<{
  options: IncrementalElement[];
  dropdownOpen: boolean;
  triggerMethod: 'click' | 'arrowdown' | 'typeahead' | 'none';
}>;
```

**Implementation flow:**

```
1. page = getPageForTargetId(opts)
2. anchorLocator = refLocator(page, opts.ref)
3. scrollIntoView(anchorLocator)
4. startDomObserver(page, anchorElement)
5. click anchorLocator
6. wait 500ms + waitForLoadState('domcontentloaded', 2000ms)
7. incremental = getIncrementalElements(page)
8. if (incremental.newElements.length === 0):
   a. press ArrowDown
   b. wait 500ms
   c. incremental = getIncrementalElements(page)
9. if (incremental.newElements.length === 0 && searchText):
   a. type searchText sequentially (50ms delay between chars)
   b. wait 500ms
   c. incremental = getIncrementalElements(page)
10. stopDomObserver(page)
11. filter: keep only interactable elements or elements with text matching option-like patterns
12. assign temporary refs to each option (d1, d2, d3, ...)
13. store temporary refs in session ref map
14. return { options, dropdownOpen: options.length > 0, triggerMethod }
```

#### File: `src/browser/routes/agent.act.ts` — Add `discover_dropdown` action kind

Add a new case in the action switch (~line 339):

```typescript
case "discover_dropdown": {
  const ref = toStringOrEmpty(body.ref);
  if (!ref) return jsonError(res, 400, "ref is required");
  const searchText = toStringOrEmpty(body.searchText) || undefined;
  const timeoutMs = toNumber(body.timeoutMs);
  const result = await pw.discoverDropdownOptionsViaPlaywright({
    cdpUrl,
    targetId: tab.targetId,
    ref,
    searchText,
    timeoutMs: timeoutMs ?? undefined,
  });
  return res.json({ ok: true, targetId: tab.targetId, ...result });
}
```

#### File: `src/browser/routes/agent.act.shared.ts` — Register new kind

Add `"discover_dropdown"` to the valid action kinds array.

---

### Phase 2: open-agent — Browser Adapter + Tool Integration

#### File: `../open-agent/src/tools/browser-adapter.ts` — Add `discoverDropdown` method

```typescript
async discoverDropdown(ref: string, searchText?: string): Promise<JsonRecord> {
  return this.post("/act", {
    kind: "discover_dropdown",
    ref,
    searchText,
    timeoutMs: this.config.browserTimeoutMs,
  });
}
```

#### File: `../open-agent/src/tools/browser-executor.ts` — Add tool case

Add to the switch in `execute()`:

```typescript
case "browser.act.discover_dropdown":
  result = await this.adapter.discoverDropdown(
    args.ref as string,
    args.searchText as string | undefined,
  );
  await this.emitBrowserEvent("discover_dropdown", {
    ref: args.ref,
    options_count: Array.isArray((result as any).options) ? (result as any).options.length : 0,
  });
  break;
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts` — Add tool definition

Add in `createBrowserTools()` function (~after `browser.act.fill` definition, line ~520):

```typescript
{
  name: "browser.act.discover_dropdown",
  label: "Discover Dropdown Options",
  description:
    "Click a dropdown/combobox/select trigger to open it, observe which new options appear " +
    "in the DOM, and return them as a list. Use this when browser.act.fill fails on a " +
    "combobox/listbox/select-like element. After discovering options, click the desired one " +
    "with browser.act.click using the returned ref.",
  parameters: Type.Object({
    ref: Type.String({ description: "Ref of the dropdown trigger element" }),
    searchText: Type.Optional(
      Type.String({ description: "Optional text to type for typeahead filtering" }),
    ),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.act.discover_dropdown", params as Record<string, unknown>),
},
```

#### File: `../open-agent/src/tools/browser-tools.ts` — Register tool name

Add `"browser.act.discover_dropdown"` to the tool names list.

---

### Phase 3: open-agent — Prompt / Skill Improvements

#### File: `../open-agent/skills/job-application-execution.md`

Add to the **Execute phase** section:

```markdown
## Dropdown / select handling
- First attempt: Use `browser.act.fill` for native `<select>` or straightforward text inputs.
- If fill fails or the element role is `combobox` / `listbox`:
  1. Call `browser.act.discover_dropdown` with the element ref.
  2. Review the returned options list.
  3. Pick the best-matching option by text/value.
  4. Call `browser.act.click` on that option's ref.
  5. Take a fresh snapshot to confirm the selection stuck.
- For typeahead/autocomplete fields (e.g., location, university, company):
  1. Call `browser.act.discover_dropdown` with `searchText` set to the target value.
  2. Pick the closest match from returned filtered options.
  3. Click it.
- If no options appear after discover_dropdown, try pressing Escape and re-approaching:
  - Clear the field, type the value slowly, then discover_dropdown again.
```

---

### Phase 4: Dropdown Close / Cleanup Safety

#### File: `src/browser/pw-tools-core.interactions.ts`

Add a companion function:

```typescript
/**
 * Close an open dropdown by pressing Escape, then blur the anchor element.
 * Use after discover_dropdown if the agent decides not to select an option.
 */
export async function closeDropdownViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
}): Promise<void>;
```

#### File: `src/browser/routes/agent.act.ts`

Add `close_dropdown` action kind that calls `closeDropdownViaPlaywright`.

---

## Testing Strategy

1. **Unit test the JS injection**: Create a test HTML page with a custom React-style dropdown, inject the observer, click, verify incremental elements captured.
2. **Integration test**: Start openclaw-browser against a local test page with:
   - Native `<select>` dropdown
   - Custom `<div role="listbox">` dropdown
   - Typeahead/autocomplete `<input>` with dynamic suggestions
   - Cascading dropdown (country → state)
3. **E2E test**: Run open-agent against Greenhouse/Lever test application pages and verify dropdown selections succeed.

## Risk Mitigation

- **Performance**: MutationObserver is lightweight; observer runs ~1-2ms per mutation batch. The JS injection is <2KB.
- **Iframe dropdowns**: Some ATS render forms in iframes. The observer should be injected into the correct frame. Use `page.frame()` or `frameLocator` to target.
- **Race condition**: The observer may miss options that appear before observation starts. Mitigation: inject observer BEFORE clicking, not after.
- **Memory**: `window.__skyvernIncrementalNodes` should be capped at 500 entries to prevent memory leaks on pages with heavy DOM churn.

## Job Application Specific Dropdown Patterns

These are the **exact dropdown types** encountered on Greenhouse, Lever, Ashby, SmartRecruiters, and BambooHR:

### Greenhouse Dropdowns
- **Country / State / City**: Cascading — selecting country loads states, selecting state loads cities. Rendered as `<div class="select2-container">` wrapping a hidden `<select>`. Click opens a `<div class="select2-results">` with `<li role="option">` items. Often has a search input inside the dropdown.
- **How did you hear about us**: Custom select with `role="listbox"`.
- **Work authorization / Visa sponsorship**: Usually native `<select>` but sometimes radio buttons.
- **Department / Team**: Custom searchable select with typeahead filtering.

### Lever Dropdowns
- **Location preference**: Custom combobox with autocomplete. Type to filter, click to select.
- **Pronouns / Gender / Race / Veteran / Disability**: Native `<select>` elements inside EEO section. Standard options.
- **Resume source**: Dropdown for "How did you find this job" — usually native `<select>`.

### Ashby Dropdowns
- All custom React components. Every select is a `<div>` with `role="combobox"` → opens a `<div role="listbox">` overlay.
- Options are `<div role="option">` items.
- Has search/filter built into most dropdowns.

### SmartRecruiters Dropdowns
- Mix of native `<select>` and custom. EEO questions are native.
- Location is a Google Places autocomplete — type text, wait for API response, click suggestion.

### Common Patterns to Handle

| Dropdown Type | Trigger | Options Container | Option Element | Selection Confirmation |
|---|---|---|---|---|
| Native `<select>` | N/A (use selectOption) | Browser-native | `<option>` | Value attribute set |
| Select2 (Greenhouse) | Click `.select2-container` | `.select2-results` | `li.select2-result` | `.select2-chosen` text changes |
| React Listbox (Ashby) | Click `[role=combobox]` | `[role=listbox]` | `[role=option]` | `aria-selected="true"` |
| Typeahead/Autocomplete | Type text into input | Dynamic `<ul>` or `<div>` | `<li>` or `[role=option]` | Input value changes |
| Cascading (Country→State) | Select parent first | Child dropdown reloads | Same as parent type | New options loaded |

### Cascading Dropdown Handling

**Critical for job apps** — Country/State/City is on nearly every application form.

Add to `../open-agent/skills/job-application-execution.md`:

```markdown
## Cascading dropdown protocol (Country → State → City)
1. Fill/select the parent dropdown (Country) first.
2. Wait 1-2 seconds for the child dropdown (State) to reload options.
3. Take a fresh snapshot — the State dropdown now has new options.
4. Fill/select the child dropdown (State).
5. If there's a City dropdown, repeat the wait-snapshot-select cycle.
6. NEVER try to fill a child dropdown before its parent — the options won't match.
```

### EEO Dropdown Defaults

Add to skill file — these dropdowns appear on 80%+ of applications:

```markdown
## EEO / Demographic dropdown defaults
Always select the LEAST specific option unless user profile explicitly specifies:
- Gender: "Decline to self-identify" or "Prefer not to say"
- Race/Ethnicity: "Decline to self-identify" or "Two or more races" if no option to decline
- Veteran Status: "I am not a protected veteran" or "Prefer not to answer"
- Disability: "Prefer not to answer" or "I don't wish to answer"
- These fields are voluntary. Selecting "decline" is always safe.
```

## Skyvern Reference

- `skyvern/webeye/scraper/scraper.py` → `IncrementalScrapePage` class (lines 650-837)
- `skyvern/webeye/actions/handler.py` → `handle_select_option_action` (lines 1690-2010)
- `skyvern/webeye/actions/handler.py` → `sequentially_select_from_dropdown` (lines 2200-2500)
- `skyvern/webeye/actions/handler.py` → `select_from_emerging_elements` (lines 2500-2700)
- `skyvern/webeye/scraper/domUtils.js` → `startGlobalIncrementalObserver` / `stopGlobalIncrementalObserver` (lines ~2800-2971)
