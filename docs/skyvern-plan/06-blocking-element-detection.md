# 06 — Blocking Element Detection

## Problem

Job application pages frequently show elements that **block** the form:

1. **Cookie consent banners** — full-width overlays at bottom or center of page
2. **Chat widgets** — floating "Help" buttons covering form fields
3. **Session timeout modals** — "Are you still there?" dialogs
4. **GDPR popups** — consent dialogs that must be dismissed before interaction
5. **Sticky headers/footers** — fixed-position elements covering form fields at certain scroll positions
6. **Loading spinners** — overlay divs that block all interaction during AJAX calls

When the agent tries to click or fill a field that is obscured, Playwright raises:
- `Element is not visible` (if the overlay has a higher z-index)
- `Element is outside viewport` (if scroll is blocked)
- Or worse: the click lands on the **overlay** instead of the target field

### How Skyvern Solves This

Skyvern's `SkyvernElement.find_blocking_element()` method (in `dom.py`):

1. Gets the bounding box of the target element
2. Uses `document.elementFromPoint(centerX, centerY)` to find what's actually on top
3. If the top element is NOT the target (and not a child/parent), it's a blocker
4. Returns the blocking element so the agent can dismiss it first

Additionally, in `handler.py` (lines 1376-1395), after detecting a blocking element on an input:

```python
blocking_element, exist = await skyvern_element.find_blocking_element(dom=dom, incremental_page=incremental_scraped)
if blocking_element and exist:
    if await blocking_element.is_editable():
        skyvern_element = blocking_element  # Route input to the overlay's field instead
    else:
        await blocking_element.press_key("Escape")  # Try to dismiss
        await blocking_element.blur()
```

---

## Implementation Plan

### Phase 1: openclaw-browser — Blocking Element Detection

#### File: `src/browser/pw-tools-core.interactions.ts`

**Add `detectBlockingElementViaPlaywright` function:**

```typescript
export type BlockingElementInfo = {
  isBlocked: boolean;
  blockerTagName?: string;
  blockerRole?: string;
  blockerText?: string;
  blockerClassName?: string;
  blockerRef?: string;          // if the blocker has an assigned ref
  blockerZIndex?: number;
  blockerRect?: { x: number; y: number; width: number; height: number };
  dismissStrategy?: "click_close" | "press_escape" | "click_outside" | "scroll" | "unknown";
  closeButtonRef?: string;      // ref of a close/dismiss button if found on the blocker
};

/**
 * Check if an element is blocked by an overlay/modal/popup.
 *
 * Algorithm:
 * 1. Get bounding box of target element
 * 2. Check document.elementFromPoint at the center
 * 3. If top element is different → target is blocked
 * 4. Analyze the blocker to suggest a dismiss strategy:
 *    - Look for close/dismiss/X buttons within the blocker
 *    - Check if blocker has role="dialog" or role="alertdialog"
 *    - Check if blocker responds to Escape key
 */
export async function detectBlockingElementViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
}): Promise<BlockingElementInfo> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });

  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);

  const result = await locator.evaluate((target: Element) => {
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { isBlocked: false, reason: "target_not_visible" };
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topElement = document.elementFromPoint(centerX, centerY);

    if (!topElement) {
      return { isBlocked: false };
    }

    // Check if topElement is the target or a descendant/ancestor
    if (topElement === target || target.contains(topElement) || topElement.contains(target)) {
      return { isBlocked: false };
    }

    // topElement is blocking the target
    const blocker = topElement;

    // Walk up to find the modal/overlay container
    let container = blocker;
    let depth = 0;
    while (container.parentElement && depth < 10) {
      const style = getComputedStyle(container);
      const role = container.getAttribute("role");
      if (
        role === "dialog" ||
        role === "alertdialog" ||
        style.position === "fixed" ||
        style.position === "absolute" ||
        (style.zIndex && parseInt(style.zIndex) > 100)
      ) {
        break;
      }
      container = container.parentElement;
      depth++;
    }

    // Look for close buttons in the blocking container
    const closeSelectors = [
      'button[aria-label*="close" i]',
      'button[aria-label*="dismiss" i]',
      'button[aria-label*="accept" i]',
      'button[class*="close" i]',
      'button[class*="dismiss" i]',
      '[role="button"][aria-label*="close" i]',
      'a[class*="close" i]',
      'button:has(svg)', // icon-only close buttons
    ];

    let closeButton = null;
    for (const selector of closeSelectors) {
      const found = container.querySelector(selector);
      if (found) {
        const foundRect = found.getBoundingClientRect();
        if (foundRect.width > 0 && foundRect.height > 0) {
          closeButton = found;
          break;
        }
      }
    }

    // Also look for "Accept", "OK", "Got it", "I agree" buttons
    const acceptPatterns = /accept|ok|got it|i agree|i understand|continue|dismiss|close/i;
    if (!closeButton) {
      const buttons = container.querySelectorAll("button, a[role='button'], [role='button']");
      for (const btn of buttons) {
        if (acceptPatterns.test(btn.textContent || "")) {
          const btnRect = btn.getBoundingClientRect();
          if (btnRect.width > 0 && btnRect.height > 0) {
            closeButton = btn;
            break;
          }
        }
      }
    }

    const containerRect = container.getBoundingClientRect();
    const containerStyle = getComputedStyle(container);
    const role = container.getAttribute("role");

    let dismissStrategy = "unknown";
    if (closeButton) {
      dismissStrategy = "click_close";
    } else if (role === "dialog" || role === "alertdialog") {
      dismissStrategy = "press_escape";
    } else if (containerStyle.position === "fixed") {
      dismissStrategy = "press_escape";
    }

    return {
      isBlocked: true,
      blockerTagName: container.tagName.toLowerCase(),
      blockerRole: role || undefined,
      blockerText: (container.textContent || "").trim().slice(0, 200),
      blockerClassName: (container.className?.toString?.() || "").slice(0, 100),
      blockerZIndex: parseInt(containerStyle.zIndex) || undefined,
      blockerRect: {
        x: containerRect.x,
        y: containerRect.y,
        width: containerRect.width,
        height: containerRect.height,
      },
      dismissStrategy,
      closeButtonText: closeButton ? (closeButton.textContent || "").trim().slice(0, 50) : undefined,
      closeButtonAriaLabel: closeButton?.getAttribute("aria-label") || undefined,
    };
  });

  return result as BlockingElementInfo;
}
```

#### File: `src/browser/pw-tools-core.interactions.ts`

**Add `dismissBlockerViaPlaywright` function:**

```typescript
/**
 * Attempt to dismiss a blocking overlay.
 * Tries strategies in order: click close button → press Escape → click outside.
 */
export async function dismissBlockerViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  targetRef: string;          // the ref that was blocked
  strategy?: "click_close" | "press_escape" | "click_outside";
  closeButtonRef?: string;    // specific close button ref
}): Promise<{ dismissed: boolean; strategy: string }> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });

  const strategies = opts.strategy
    ? [opts.strategy]
    : ["click_close", "press_escape", "click_outside"];

  for (const strategy of strategies) {
    try {
      if (strategy === "click_close" && opts.closeButtonRef) {
        await refLocator(page, opts.closeButtonRef).click({ timeout: 3000 });
      } else if (strategy === "press_escape") {
        await page.keyboard.press("Escape");
      } else if (strategy === "click_outside") {
        await page.mouse.click(1, 1); // click top-left corner
      }

      // Wait for animation
      await page.waitForTimeout(500);

      // Verify the target is no longer blocked
      const check = await detectBlockingElementViaPlaywright({
        cdpUrl: opts.cdpUrl,
        targetId: opts.targetId,
        ref: opts.targetRef,
      });

      if (!check.isBlocked) {
        return { dismissed: true, strategy };
      }
    } catch {
      // Strategy failed, try next
    }
  }

  return { dismissed: false, strategy: "all_failed" };
}
```

#### File: `src/browser/routes/agent.act.ts`

Add action kinds:

```typescript
case "detect_blocker": { /* call detectBlockingElementViaPlaywright */ }
case "dismiss_blocker": { /* call dismissBlockerViaPlaywright */ }
```

#### File: `src/browser/routes/agent.act.shared.ts`

Add `"detect_blocker"` and `"dismiss_blocker"` to valid action kinds.

---

### Phase 2: open-agent — Blocker Detection Tool + Auto-Dismiss

#### File: `../open-agent/src/tools/browser-adapter.ts`

```typescript
async detectBlocker(ref: string): Promise<JsonRecord> {
  return this.post("/act", { kind: "detect_blocker", ref, timeoutMs: this.config.browserTimeoutMs });
}

async dismissBlocker(targetRef: string, strategy?: string, closeButtonRef?: string): Promise<JsonRecord> {
  return this.post("/act", {
    kind: "dismiss_blocker",
    targetRef,
    strategy,
    closeButtonRef,
    timeoutMs: this.config.browserTimeoutMs,
  });
}
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.act.dismiss_blocker",
  label: "Dismiss Blocking Overlay",
  description:
    "Attempt to dismiss a modal/popup/overlay that is blocking a form element. " +
    "Automatically tries: clicking a close button, pressing Escape, clicking outside. " +
    "Use when browser.act.fill or browser.act.click fails because the element is obscured.",
  parameters: Type.Object({
    targetRef: Type.String({ description: "Ref of the element being blocked" }),
    strategy: Type.Optional(Type.String({ description: "Specific strategy: click_close | press_escape | click_outside" })),
    closeButtonRef: Type.Optional(Type.String({ description: "Ref of the close/dismiss button if known" })),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.act.dismiss_blocker", params as Record<string, unknown>),
},
```

---

### Phase 3: Auto-Dismiss on Fill Failure

#### File: `src/browser/pw-tools-core.interactions.ts`

Integrate blocker detection into `fillAndVerifyField` (from plan 03):

```typescript
// In fillAndVerifyField, when fill() throws:
catch (fillError) {
  // Check if failure is due to blocking element
  const blockerInfo = await detectBlockingElementViaPlaywright({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
    ref,
  });

  if (blockerInfo.isBlocked) {
    // Auto-dismiss attempt
    const dismissResult = await dismissBlockerViaPlaywright({
      cdpUrl: opts.cdpUrl,
      targetId: opts.targetId,
      targetRef: ref,
    });

    if (dismissResult.dismissed) {
      // Retry fill after dismissing blocker
      await locator.fill(value, { timeout });
      // ... continue with verification
    } else {
      result.warning = `Element blocked by ${blockerInfo.blockerTagName} (${blockerInfo.dismissStrategy}). Auto-dismiss failed.`;
      return result;
    }
  }
  // ... existing fallback logic
}
```

---

### Phase 4: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Overlay / modal / popup handling
- If fill or click fails with "element not visible" or "element is obscured":
  1. Call `browser.act.dismiss_blocker` with the blocked element's ref.
  2. If auto-dismiss fails, take a snapshot to identify the blocker.
  3. Look for close/dismiss/accept buttons on the overlay.
  4. Click the close button, then retry the original action.
- Common blockers on job sites:
  - Cookie consent: usually has "Accept" or "Got it" button
  - Chat widgets: may have minimize/close button
  - Session timeout: click "Continue" or "I'm still here"
  - GDPR consent: click "Accept All" or "I Agree"
- After dismissing, always take a fresh snapshot — the page state may have changed.
```

---

## Skyvern Reference

- `skyvern/webeye/utils/dom.py` → `SkyvernElement.find_blocking_element()` — core detection
- `skyvern/webeye/actions/handler.py` lines 1376-1395 — auto-routing to blocking element
- `skyvern/webeye/actions/handler.py` lines 1830-1870 — `<select>` blocked by overlay handling
- `skyvern/webeye/actions/handler.py` — `Escape` + `blur()` dismiss pattern used throughout
