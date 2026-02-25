# 05 — Dynamic Element State Checks

## Problem

Your current flow snapshots the page once, then issues fill/click/select actions against the captured refs. But element state can **change between actions**:

1. A field starts `disabled` → becomes `enabled` after a previous field is filled (e.g., "Submit" button enables after all required fields are filled)
2. A field starts `visible` → becomes `hidden` after a selection (e.g., selecting "No" for a question hides follow-up fields)
3. A field starts `readonly` → becomes `editable` after clicking an "Edit" button
4. An overlay/modal appears, blocking interaction with form elements underneath
5. A field's `required` attribute is added/removed dynamically via JavaScript

The agent tries to interact with a stale-state element and gets:
- `Element is not visible` errors
- `Element is disabled` errors
- `Element is outside of the viewport` errors
- Silent failures where the action appears to succeed but nothing happens

### How Skyvern Solves This

In `handler.py`, every action handler dynamically validates element state **at interaction time**, not at snapshot time:

```python
# handler.py line 470 (click handler):
if await skyvern_element.is_disabled(dynamic=True):
    return [ActionFailure(InteractWithDisabledElement(...))]

# handler.py line 600 (input handler):
if await skyvern_element.is_disabled(dynamic=True):
    return [ActionFailure(InteractWithDisabledElement(...))]

# handler.py line 1335:
if await skyvern_element.is_readonly(dynamic=True):
    return [ActionFailure(InputToReadonlyElement(...))]
```

The `dynamic=True` flag means it queries the **live DOM** at that instant, not the cached attribute.

The `SkyvernElement` class (in `dom.py`) has 76 methods including:
- `is_disabled(dynamic)`, `is_readonly(dynamic)`, `is_visible()`, `is_editable()`
- `is_checkbox()`, `is_radio()`, `is_file_input()`, `is_spinbtn_input()`
- `has_hidden_attr()`, `get_selectable()`, `is_auto_completion_input()`
- `find_blocking_element()` — detects overlays

---

## Implementation Plan

### Phase 1: openclaw-browser — Element State Query Endpoint

#### File: `src/browser/pw-tools-core.interactions.ts`

**Add `queryElementStateViaPlaywright` function:**

```typescript
export type ElementState = {
  ref: string;
  exists: boolean;
  visible: boolean;
  enabled: boolean;         // !disabled
  editable: boolean;        // !readonly
  focusable: boolean;
  checked: boolean | null;  // for checkboxes/radios
  tagName: string;
  inputType: string | null;
  currentValue: string;
  required: boolean;
  ariaInvalid: boolean;     // has validation error
  ariaExpanded: boolean | null; // dropdown open state
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  isObscured: boolean;      // another element is on top (overlay detection)
};

/**
 * Query the live state of an element by ref.
 * All checks are dynamic (live DOM, not cached snapshot).
 */
export async function queryElementStateViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
}): Promise<ElementState> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });

  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);

  const exists = (await locator.count()) > 0;
  if (!exists) {
    return {
      ref,
      exists: false,
      visible: false,
      enabled: false,
      editable: false,
      focusable: false,
      checked: null,
      tagName: "",
      inputType: null,
      currentValue: "",
      required: false,
      ariaInvalid: false,
      ariaExpanded: null,
      boundingBox: null,
      isObscured: false,
    };
  }

  const el = locator.first();

  const [visible, enabled, editable, boundingBox] = await Promise.all([
    el.isVisible().catch(() => false),
    el.isEnabled().catch(() => false),
    el.isEditable().catch(() => false),
    el.boundingBox().catch(() => null),
  ]);

  const domState = await el.evaluate((node: Element) => {
    const input = node as HTMLInputElement;
    const rect = node.getBoundingClientRect();

    // Check if element is obscured by another element
    let isObscured = false;
    if (rect.width > 0 && rect.height > 0) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);
      if (topElement && topElement !== node && !node.contains(topElement) && !topElement.contains(node)) {
        isObscured = true;
      }
    }

    return {
      tagName: node.tagName?.toLowerCase() || "",
      inputType: input.type || node.getAttribute("type") || null,
      currentValue: (input.value || "").slice(0, 200),
      required:
        input.required ||
        node.hasAttribute("required") ||
        node.getAttribute("aria-required") === "true",
      ariaInvalid: node.getAttribute("aria-invalid") === "true",
      ariaExpanded:
        node.getAttribute("aria-expanded") === "true"
          ? true
          : node.getAttribute("aria-expanded") === "false"
            ? false
            : null,
      checked: typeof input.checked === "boolean" ? input.checked : null,
      focusable: node.tabIndex >= 0,
      isObscured,
    };
  });

  return {
    ref,
    exists,
    visible,
    enabled,
    editable,
    ...domState,
    boundingBox,
  };
}
```

**Add batch version for multiple refs:**

```typescript
/**
 * Query state for multiple elements in one call.
 * More efficient than N individual calls.
 */
export async function queryElementStatesViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  refs: string[];
}): Promise<{ states: ElementState[] }> {
  const states: ElementState[] = [];
  for (const ref of opts.refs.slice(0, 50)) {
    states.push(
      await queryElementStateViaPlaywright({
        cdpUrl: opts.cdpUrl,
        targetId: opts.targetId,
        ref,
      }),
    );
  }
  return { states };
}
```

#### File: `src/browser/routes/agent.act.ts`

**Add `query_state` action kind:**

```typescript
case "query_state": {
  const ref = toStringOrEmpty(body.ref);
  const refs = Array.isArray(body.refs) ? body.refs.map(String).filter(Boolean) : [];

  if (refs.length > 0) {
    const result = await pw.queryElementStatesViaPlaywright({
      cdpUrl,
      targetId: tab.targetId,
      refs,
    });
    return res.json({ ok: true, targetId: tab.targetId, ...result });
  }

  if (!ref) return jsonError(res, 400, "ref or refs is required");
  const state = await pw.queryElementStateViaPlaywright({
    cdpUrl,
    targetId: tab.targetId,
    ref,
  });
  return res.json({ ok: true, targetId: tab.targetId, state });
}
```

#### File: `src/browser/routes/agent.act.shared.ts`

Add `"query_state"` to valid action kinds.

---

### Phase 2: openclaw-browser — Pre-Fill Validation

#### File: `src/browser/pw-tools-core.interactions.ts`

**Change: Add pre-interaction validation to `fillAndVerifyField`** (from plan 03)

Before attempting to fill, check the live state:

```typescript
// Inside fillAndVerifyField, at the beginning:

// Pre-check: is the element actually fillable right now?
const preState = await queryElementStateViaPlaywright({
  cdpUrl: opts.cdpUrl,
  targetId: opts.targetId,
  ref,
});

if (!preState.exists) {
  result.warning = "Element no longer exists in DOM (ref stale)";
  return result;
}
if (!preState.visible) {
  result.warning = "Element is not visible (hidden or display:none)";
  return result;
}
if (!preState.enabled) {
  result.warning = "Element is disabled — cannot fill";
  return result;
}
if (!preState.editable && preState.tagName !== "select") {
  result.warning = "Element is readonly — cannot fill";
  return result;
}
if (preState.isObscured) {
  result.warning = `Element is obscured by another element (overlay/modal). Try closing the overlay first.`;
  return result;
}
```

---

### Phase 3: open-agent — State Query Tool

#### File: `../open-agent/src/tools/browser-adapter.ts`

```typescript
async queryElementState(ref: string): Promise<JsonRecord> {
  return this.post("/act", {
    kind: "query_state",
    ref,
    timeoutMs: this.config.browserTimeoutMs,
  });
}

async queryElementStates(refs: string[]): Promise<JsonRecord> {
  return this.post("/act", {
    kind: "query_state",
    refs,
    timeoutMs: this.config.browserTimeoutMs,
  });
}
```

#### File: `../open-agent/src/tools/browser-executor.ts`

```typescript
case "browser.act.query_state":
  if (Array.isArray(args.refs)) {
    result = await this.adapter.queryElementStates(args.refs as string[]);
  } else {
    result = await this.adapter.queryElementState(args.ref as string);
  }
  break;
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.act.query_state",
  label: "Query Element State",
  description:
    "Check the LIVE state of one or more elements: visible, enabled, editable, " +
    "current value, required, has validation error (ariaInvalid), is obscured by overlay. " +
    "Use before interacting with elements that might have changed state since last snapshot. " +
    "Pass a single 'ref' or an array of 'refs' (max 50).",
  parameters: Type.Object({
    ref: Type.Optional(Type.String()),
    refs: Type.Optional(Type.Array(Type.String())),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.act.query_state", params as Record<string, unknown>),
},
```

#### File: `../open-agent/src/tools/browser-tools.ts`

Add `"browser.act.query_state"` to tool names.

---

### Phase 4: open-agent — Skill / Prompt Integration

#### File: `../open-agent/skills/job-application-execution.md`

Add to **Execute phase**:

```markdown
## Dynamic state awareness
- After filling a dropdown or making a selection, some fields may become:
  - **Enabled**: a previously disabled field becomes fillable
  - **Visible**: a hidden section appears (conditional fields)
  - **Invalid**: a validation error appears (ariaInvalid=true)
  - **Obscured**: a modal/overlay covers the form
- Use `browser.act.query_state` with a batch of refs to check before interacting.
- If an element is `isObscured=true`:
  1. Look for a close/dismiss button on the overlay
  2. Click it, then retry the original action
  3. If no close button, try pressing Escape
- If an element shows `ariaInvalid=true`:
  1. Read the associated error message (usually a nearby text element)
  2. Correct the value
  3. Re-check ariaInvalid after correction
```

---

## Testing Strategy

1. **Conditional fields**: Create test form where selecting "Yes" on radio enables a new input. Verify `query_state` shows the new input as `enabled: true` after selection.
2. **Overlay detection**: Create test with a cookie consent overlay covering form fields. Verify `isObscured: true` is reported.
3. **Disabled submit**: Create form where submit button is disabled until all required fields are filled. Verify state transitions from `enabled: false` to `enabled: true`.
4. **Validation errors**: Create form where typing an invalid email shows `aria-invalid="true"`. Verify `ariaInvalid: true` is reported.
5. **Stale refs**: Navigate to a new page and query old refs. Verify `exists: false` is reported.

## Skyvern Reference

- `skyvern/webeye/utils/dom.py` → `SkyvernElement` class (1,095 lines, 76 methods)
- `skyvern/webeye/utils/dom.py` → `is_disabled(dynamic=True)` — re-evaluates at interaction time
- `skyvern/webeye/utils/dom.py` → `is_readonly(dynamic=True)`
- `skyvern/webeye/utils/dom.py` → `find_blocking_element()` — overlay/obstruction detection
- `skyvern/webeye/utils/dom.py` → `is_auto_completion_input()` — detects autocomplete widgets
- `skyvern/webeye/actions/handler.py` → Pre-checks in every action handler before executing
