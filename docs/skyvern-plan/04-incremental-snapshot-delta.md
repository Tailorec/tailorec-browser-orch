# 04 — Incremental Snapshot Delta

## Problem

After every action (fill, click, select), the agent currently must take a **full snapshot** to see the updated page state. This is:

1. **Expensive**: A full snapshot on a complex ATS page takes 1-3 seconds + produces 30-70KB of text
2. **Token-heavy**: The LLM re-processes the entire page even though only 2-3 elements changed
3. **Blind to dynamics**: The agent can't distinguish "what just appeared" from "what was already there" — so it can't detect:
   - New validation errors that appeared after a fill
   - New form sections that appeared after a dropdown selection (conditional fields)
   - A success banner that replaced the form
   - A new step/page in a multi-step wizard

### How Skyvern Solves This

Skyvern's `IncrementalScrapePage` class listens for DOM mutations via `MutationObserver` and returns **only the new/changed elements**:

```python
# Before action:
await incremental_scraped.start_listen_dom_increment(element_handler)

# Execute action (click, type, etc.)
await skyvern_element.click(...)

# After action:
incremental_elements = await incremental_scraped.get_incremental_element_tree(cleanup_func)
# → returns ONLY new elements that appeared since the observer started
```

The agent prompt then sees a compact diff instead of the full page.

---

## Implementation Plan

### Phase 1: openclaw-browser — New `POST /snapshot/delta` Endpoint

#### File: `src/browser/pw-tools-core.dom-observer.ts` (NEW — shared with 01-custom-dropdown-engine)

This file is created in plan `01`. Here we extend it with delta-snapshot capabilities.

**Add `captureDomDelta` function:**

```typescript
export type DomDelta = {
  addedElements: IncrementalElement[];
  removedElements: Array<{ ref?: string; text: string }>;
  modifiedElements: Array<{
    ref: string;
    changes: Record<string, { before: string; after: string }>;
  }>;
  urlChanged: boolean;
  previousUrl: string;
  currentUrl: string;
  observationDurationMs: number;
};
```

**JS injection for comprehensive delta tracking:**

```javascript
// Extended observer that tracks additions, removals, and attribute changes
window.__skyvernDeltaObserver = {
  added: [],
  removed: [],
  modified: [],
  startUrl: window.location.href,

  start(anchorElement) {
    this.added = [];
    this.removed = [];
    this.modified = [];
    this.startUrl = window.location.href;
    this.startTime = Date.now();

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Track added nodes
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          this._processAddedNode(node);
        }
        // Track removed nodes
        for (const node of mutation.removedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          this.removed.push({
            tagName: node.tagName?.toLowerCase() || '',
            text: (node.textContent || '').trim().slice(0, 100),
            ref: node.getAttribute?.('aria-ref') || null,
          });
        }
        // Track attribute changes (value, class, disabled, aria-invalid, etc.)
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target.nodeType !== Node.ELEMENT_NODE) continue;
          const attr = mutation.attributeName;
          const interestingAttrs = [
            'value', 'class', 'disabled', 'readonly', 'aria-invalid',
            'aria-expanded', 'aria-hidden', 'aria-selected', 'style'
          ];
          if (interestingAttrs.includes(attr)) {
            this.modified.push({
              tagName: target.tagName?.toLowerCase() || '',
              attr,
              oldValue: mutation.oldValue,
              newValue: target.getAttribute(attr),
              ref: target.getAttribute('aria-ref') || null,
              text: (target.textContent || '').trim().slice(0, 80),
            });
          }
        }
      }
    });

    this.observer.observe(anchorElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [
        'value', 'class', 'disabled', 'readonly', 'aria-invalid',
        'aria-expanded', 'aria-hidden', 'aria-selected', 'style',
      ],
    });
  },

  stop() {
    if (this.observer) this.observer.disconnect();
    return {
      added: this.added.slice(0, 200),
      removed: this.removed.slice(0, 50),
      modified: this.modified.slice(0, 100),
      urlChanged: window.location.href !== this.startUrl,
      startUrl: this.startUrl,
      currentUrl: window.location.href,
      durationMs: Date.now() - (this.startTime || Date.now()),
    };
  },

  _processAddedNode(node) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    this.added.push({
      tagName: node.tagName.toLowerCase(),
      role: node.getAttribute('role'),
      text: (node.textContent || '').trim().slice(0, 200),
      className: (node.className?.toString?.() || '').slice(0, 80),
      ariaInvalid: node.getAttribute('aria-invalid'),
      isError: (
        (node.className?.toString?.() || '').match(/error|invalid|danger|warning/i) !== null ||
        node.getAttribute('role') === 'alert' ||
        node.getAttribute('aria-invalid') === 'true'
      ),
    });
    // Also process children (for subtree additions like entire form sections)
    for (const child of node.querySelectorAll('*')) {
      const childRect = child.getBoundingClientRect();
      if (childRect.width > 0 && childRect.height > 0) {
        this.added.push({
          tagName: child.tagName.toLowerCase(),
          role: child.getAttribute('role'),
          text: (child.textContent || '').trim().slice(0, 200),
          isError: (
            (child.className?.toString?.() || '').match(/error|invalid|danger|warning/i) !== null ||
            child.getAttribute('role') === 'alert' ||
            child.getAttribute('aria-invalid') === 'true'
          ),
        });
      }
    }
  },
};
```

#### File: `src/browser/pw-tools-core.snapshot.ts`

**Add `snapshotDeltaViaPlaywright` function:**

```typescript
export async function snapshotDeltaViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  action: "start" | "stop";
  anchorRef?: string;
}): Promise<DomDelta | { observing: true }> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);

  if (opts.action === "start") {
    let anchorElement = null;
    if (opts.anchorRef) {
      restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
      anchorElement = await refLocator(page, opts.anchorRef).elementHandle();
    }
    await page.evaluate(
      `(anchor) => { window.__skyvernDeltaObserver.start(anchor); }`,
      anchorElement,
    );
    return { observing: true };
  }

  // action === "stop"
  const delta = await page.evaluate(`() => window.__skyvernDeltaObserver.stop()`);
  return delta as DomDelta;
}
```

#### File: `src/browser/routes/agent.snapshot.ts`

**Add `/snapshot/delta` route:**

```typescript
router.post("/snapshot/delta", async (req, res) => {
  const { action, anchorRef } = req.body;
  if (action !== "start" && action !== "stop") {
    return res.status(400).json({ ok: false, error: "action must be 'start' or 'stop'" });
  }
  const result = await pw.snapshotDeltaViaPlaywright({
    cdpUrl,
    targetId: tab.targetId,
    action,
    anchorRef,
  });
  return res.json({ ok: true, ...result });
});
```

---

### Phase 2: open-agent — Delta-Aware Snapshot Tool

#### File: `../open-agent/src/tools/browser-adapter.ts`

**Add `snapshotDelta` methods:**

```typescript
async startDeltaObserver(anchorRef?: string): Promise<JsonRecord> {
  return this.post("/snapshot/delta", {
    action: "start",
    anchorRef,
    timeoutMs: this.config.browserTimeoutMs,
  });
}

async stopDeltaObserver(): Promise<JsonRecord> {
  return this.post("/snapshot/delta", {
    action: "stop",
    timeoutMs: this.config.browserTimeoutMs,
  });
}
```

#### File: `../open-agent/src/tools/browser-executor.ts`

**Add executor cases:**

```typescript
case "browser.snapshot.delta_start":
  result = await this.adapter.startDeltaObserver(args.anchorRef as string | undefined);
  break;

case "browser.snapshot.delta_stop":
  result = await this.adapter.stopDeltaObserver();
  await this.emitBrowserEvent("snapshot_delta", {
    added_count: Array.isArray((result as any).addedElements) ? (result as any).addedElements.length : 0,
    url_changed: (result as any).urlChanged ?? false,
  });
  break;
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

**Add delta snapshot tools in `createBrowserTools`:**

```typescript
{
  name: "browser.snapshot.delta_start",
  label: "Start Delta Observer",
  description:
    "Begin observing DOM changes. Call this BEFORE performing an action " +
    "(click, fill, select) to track what changes on the page. Then call " +
    "browser.snapshot.delta_stop AFTER the action to see what appeared, " +
    "disappeared, or changed. Useful for detecting: new validation errors, " +
    "conditional form sections, dropdown options, success/error banners.",
  parameters: Type.Object({
    anchorRef: Type.Optional(
      Type.String({ description: "Optional ref to scope observation to element subtree" }),
    ),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.snapshot.delta_start", params as Record<string, unknown>),
},
{
  name: "browser.snapshot.delta_stop",
  label: "Stop Delta Observer and Get Changes",
  description:
    "Stop DOM observation and return all changes since delta_start. " +
    "Returns: addedElements (new DOM nodes), removedElements, " +
    "modifiedElements (attribute changes like aria-invalid, disabled), " +
    "urlChanged (page navigated). Check addedElements for error messages " +
    "(isError=true) and new form fields.",
  parameters: Type.Object({}),
  execute: async (_toolCallId, params) =>
    execute("browser.snapshot.delta_stop", params as Record<string, unknown>),
},
```

---

### Phase 3: open-agent — Automatic Delta Usage in Fill Results

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

**Change: Enhance `browser.act.fill` to automatically capture deltas**

Modify the `browser.act.fill` execute function to wrap the fill in a delta observation:

```typescript
execute: async (_toolCallId, params) => {
  // Automatically observe DOM changes during fill
  try {
    await executeWithRecovery("browser.snapshot.delta_start", {});
  } catch { /* observer injection failed — continue without delta */ }

  const fillResult = await executeWithRecovery("browser.act.fill", params as Record<string, unknown>);

  let delta = null;
  try {
    delta = await executeWithRecovery("browser.snapshot.delta_stop", {});
  } catch { /* delta collection failed — continue */ }

  // Detect validation errors from delta
  const addedElements = Array.isArray((delta as any)?.addedElements) ? (delta as any).addedElements : [];
  const errorElements = addedElements.filter((el: any) => el.isError);

  if (errorElements.length > 0) {
    await args.events.emit(args.ctx, "run_progress", {
      code: "fill_triggered_validation_errors",
      level: "warning",
      error_count: errorElements.length,
      errors: errorElements.slice(0, 5).map((e: any) => e.text),
      message: "Filling fields triggered validation errors on the page.",
    });
  }

  return toToolResult({
    ...fillResult,
    delta: delta ? {
      newElementCount: addedElements.length,
      errorElements: errorElements.slice(0, 5).map((e: any) => ({
        text: e.text,
        tagName: e.tagName,
        role: e.role,
      })),
      urlChanged: (delta as any)?.urlChanged ?? false,
    } : null,
  });
},
```

---

### Phase 4: open-agent — Conditional Field Detection

#### File: `../open-agent/skills/job-application-execution.md`

**Add instructions for delta-based conditional field handling:**

```markdown
## Conditional / dynamic fields
- Many forms show/hide fields based on previous selections:
  - "Are you authorized to work?" → Yes → reveals "visa type" dropdown
  - "Do you have a disability?" → reveals additional fields
  - Selecting a country → reveals state/province dropdown
- To detect these:
  1. Call `browser.snapshot.delta_start` before filling/selecting.
  2. Perform the fill or click action.
  3. Call `browser.snapshot.delta_stop` to see new elements.
  4. If new interactive elements appeared, take a full snapshot and fill them.
- Check `delta.errorElements` for validation errors after each fill batch.
  - If errors appeared, fix them before proceeding to next fields.
```

---

## Performance Characteristics

| Metric | Full snapshot | Delta snapshot |
|---|---|---|
| Time | 1-3 seconds | 50-200ms |
| Data size | 30-70KB | 1-5KB |
| Token cost | 8K-20K tokens | 200-1K tokens |
| Information | Complete page state | Only changes |
| Use case | Initial discovery, periodic re-sync | After each action |

## Skyvern Reference

- `skyvern/webeye/scraper/scraper.py` → `IncrementalScrapePage` class (lines 650-837)
- `skyvern/webeye/scraper/scraper.py` → `start_listen_dom_increment` / `stop_listen_dom_increment`
- `skyvern/webeye/scraper/scraper.py` → `get_incremental_element_tree`
- `skyvern/webeye/scraper/domUtils.js` → `startGlobalIncrementalObserver` / `stopGlobalIncrementalObserver`
- `skyvern/webeye/actions/handler.py` → Every action handler wraps execution with incremental observation
