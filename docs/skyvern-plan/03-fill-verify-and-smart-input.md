# 03 — Fill-Verify and Smart Input

## Problem

Your current `fillFormViaPlaywright` (in `src/browser/pw-tools-core.interactions.ts:211`) does:

```typescript
await locator.fill(value, { timeout });
```

This has multiple failure modes on real job application forms:

1. **Silent fill failure**: `locator.fill()` succeeds from Playwright's perspective, but the React/Vue component's state didn't update (value not in `useState`, only in DOM)
2. **Masked inputs**: Phone fields with input masks (`(___) ___-____`) reject `.fill()` because the mask library intercepts keystrokes
3. **Date inputs**: `<input type="date">` requires specific format; `.fill("January 15, 2024")` silently fails
4. **Number spinners**: `<input type="number">` may clamp or reject non-numeric `.fill()` text
5. **Auto-formatting fields**: Fields that auto-format (SSN, phone, ZIP+4) produce different final values than what was typed
6. **Contenteditable divs**: Rich text fields (`<div contenteditable>`) don't respond to `.fill()`

### How Skyvern Solves This

Skyvern's `handle_input_text_action` (~600 lines in `handler.py:540-1140`) does:

1. **Pre-check**: Reads current value. If already matches target, skips.
2. **Type detection**: Checks `type` attr → routes to specialized handlers:
   - `type="tel"` → calls `check_phone_number_format()` which uses a **secondary LLM** to reformat
   - `type="date"` → calls `check_date_format()` which uses a **secondary LLM** to match format
3. **Input strategy selection**:
   - Editable standard inputs → `locator.fill()`
   - Non-standard elements → `locator.input_fill()` (dispatches `input` event)
   - Elements with blinking cursor class → `press_sequentially()`
   - Spin buttons → special clear logic (doesn't use `.clear()`)
4. **Post-fill verification**: Reads back the value after fill
5. **Autocomplete handling**: After typing, checks for new DOM elements (autocomplete suggestions) and selects the right one
6. **Fallback**: If `.fill()` didn't work, tries `.pressSequentially()` with character-by-character typing

---

## Implementation Plan

### Phase 1: openclaw-browser — Fill-then-Verify Pattern

#### File: `src/browser/pw-tools-core.interactions.ts`

**Change 1: Add `fillAndVerifyField` internal helper** (insert before `fillFormViaPlaywright`, ~line 205)

```typescript
type FillResult = {
  ref: string;
  requestedValue: string;
  actualValue: string;
  matched: boolean;
  strategy: "fill" | "sequential" | "pressSequentially" | "inputEvent" | "skip";
  warning?: string;
};

/**
 * Fill a single field with verification and fallback strategies.
 *
 * Strategy escalation:
 * 1. If current value already matches → skip
 * 2. Try locator.fill()
 * 3. Read back value. If matches → done
 * 4. If mismatch → clear + pressSequentially (char by char with 30ms delay)
 * 5. Read back again. If mismatch → report warning with actual vs requested
 *
 * Special handling:
 * - type="date": use locator.fill() with ISO format (YYYY-MM-DD)
 * - type="tel": strip non-digit chars if fill fails, retry with digits-only
 * - contenteditable: use page.keyboard.type() after clicking
 */
async function fillAndVerifyField(
  page: Awaited<ReturnType<typeof getPageForTargetId>>,
  locator: ReturnType<typeof refLocator>,
  ref: string,
  value: string,
  inputType: string | null,
  timeout: number,
): Promise<FillResult> {
  const result: FillResult = {
    ref,
    requestedValue: value,
    actualValue: "",
    matched: false,
    strategy: "fill",
  };

  // Step 0: Read current value
  let currentValue = "";
  try {
    currentValue = await locator.inputValue({ timeout: 2000 });
  } catch {
    // Not an input — might be contenteditable or select
    try {
      currentValue = await locator.innerText({ timeout: 2000 });
    } catch {
      currentValue = "";
    }
  }

  if (currentValue.trim() === value.trim()) {
    result.actualValue = currentValue;
    result.matched = true;
    result.strategy = "skip";
    return result;
  }

  // Step 1: Try locator.fill()
  try {
    await locator.fill(value, { timeout });
  } catch {
    // fill() failed — might be contenteditable or non-standard
    try {
      await locator.click({ timeout: 3000 });
      await locator.selectText({ timeout: 2000 }).catch(() => {});
      await page.keyboard.type(value, { delay: 30 });
      result.strategy = "sequential";
    } catch (seqErr) {
      result.warning = `fill and sequential both failed: ${seqErr instanceof Error ? seqErr.message : String(seqErr)}`;
      result.actualValue = "";
      return result;
    }
  }

  // Step 2: Read back value
  try {
    result.actualValue = await locator.inputValue({ timeout: 2000 });
  } catch {
    try {
      result.actualValue = await locator.innerText({ timeout: 2000 });
    } catch {
      result.actualValue = "";
    }
  }

  if (result.actualValue.trim() === value.trim()) {
    result.matched = true;
    return result;
  }

  // Step 3: For specific input types, try format normalization
  if (inputType === "tel" && !result.matched) {
    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly !== value) {
      try {
        await locator.fill("", { timeout: 2000 });
        await locator.pressSequentially(digitsOnly, { delay: 30, timeout });
        result.actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => "");
        result.strategy = "pressSequentially";
        if (result.actualValue.replace(/\D/g, "") === digitsOnly) {
          result.matched = true;
          return result;
        }
      } catch { /* continue */ }
    }
  }

  // Step 4: General fallback — clear + pressSequentially
  if (!result.matched) {
    try {
      await locator.fill("", { timeout: 2000 });
      await locator.pressSequentially(value, { delay: 40, timeout });
      result.actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => "");
      result.strategy = "pressSequentially";
      result.matched = result.actualValue.trim() === value.trim();
    } catch { /* already have warning from above */ }
  }

  if (!result.matched) {
    result.warning =
      `Value mismatch after fill: requested="${value.slice(0, 50)}" ` +
      `actual="${result.actualValue.slice(0, 50)}"`;
  }

  return result;
}
```

**Change 2: Rewrite `fillFormViaPlaywright` to use fill-and-verify** (replace existing, ~line 211)

```typescript
export async function fillFormViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  fields: BrowserFormField[];
  timeoutMs?: number;
}): Promise<{ results: FillResult[] }> {
  const started = Date.now();
  log.debug("action fill started", actionMeta(opts, { fields: opts.fields.length }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const timeout = Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000));
  const results: FillResult[] = [];

  for (const field of opts.fields) {
    const ref = field.ref.trim();
    const type = field.type.trim();
    const rawValue = field.value;
    const value =
      typeof rawValue === "string"
        ? rawValue
        : typeof rawValue === "number" || typeof rawValue === "boolean"
          ? String(rawValue)
          : "";
    if (!ref || !type) continue;
    const locator = refLocator(page, ref);

    if (type === "checkbox" || type === "radio") {
      const checked =
        rawValue === true || rawValue === 1 || rawValue === "1" || rawValue === "true";
      try {
        await locator.setChecked(checked, { timeout });
        results.push({
          ref,
          requestedValue: String(checked),
          actualValue: String(checked),
          matched: true,
          strategy: "fill",
        });
      } catch (err) {
        results.push({
          ref,
          requestedValue: String(checked),
          actualValue: "",
          matched: false,
          strategy: "fill",
          warning: err instanceof Error ? err.message : String(err),
        });
      }
      continue;
    }

    // Determine input type for format-aware filling
    let inputType: string | null = null;
    try {
      inputType = await locator.getAttribute("type", { timeout: 1500 });
    } catch { /* not available */ }

    const fillResult = await fillAndVerifyField(page, locator, ref, value, inputType, timeout);
    results.push(fillResult);

    if (!fillResult.matched) {
      log.warn("fill verify mismatch", actionMeta(opts, {
        ref,
        type,
        requested: value.slice(0, 50),
        actual: fillResult.actualValue.slice(0, 50),
        strategy: fillResult.strategy,
      }));
    }
  }

  log.info("action fill completed", actionMeta(opts, {
    fields: opts.fields.length,
    matched: results.filter(r => r.matched).length,
    mismatched: results.filter(r => !r.matched).length,
    duration_ms: Date.now() - started,
  }));

  return { results };
}
```

#### File: `src/browser/routes/agent.act.ts`

**Change 3: Return fill results in response** (~line 367)

```typescript
case "fill": {
  // ...existing field parsing...
  const fillResponse = await pw.fillFormViaPlaywright({
    cdpUrl,
    targetId: tab.targetId,
    fields,
    timeoutMs: timeoutMs ?? undefined,
  });
  return res.json({
    ok: true,
    targetId: tab.targetId,
    results: fillResponse.results,
    allMatched: fillResponse.results.every(r => r.matched),
    mismatched: fillResponse.results.filter(r => !r.matched).map(r => ({
      ref: r.ref,
      requested: r.requestedValue,
      actual: r.actualValue,
      warning: r.warning,
    })),
  });
}
```

---

### Phase 2: openclaw-browser — Type-Specific Input Strategies

#### File: `src/browser/pw-tools-core.interactions.ts`

**Change 4: Add `typeViaPlaywrightSmart` for date inputs**

```typescript
/**
 * Smart date input: detect format from placeholder/pattern, convert value.
 * Playwright's fill() on date inputs requires YYYY-MM-DD (ISO format).
 * But users/LLMs may provide "January 15, 2024" or "01/15/2024".
 */
async function fillDateInput(
  locator: ReturnType<typeof refLocator>,
  value: string,
  timeout: number,
): Promise<{ filled: boolean; formatted: string }> {
  // Try common date formats and convert to YYYY-MM-DD
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    const iso = parsed.toISOString().split("T")[0]; // YYYY-MM-DD
    await locator.fill(iso, { timeout });
    return { filled: true, formatted: iso };
  }
  // Fallback: try filling raw value
  await locator.fill(value, { timeout });
  return { filled: true, formatted: value };
}
```

**Change 5: Integrate into `fillAndVerifyField`** (in the type-specific section)

```typescript
// In fillAndVerifyField, before Step 1 (locator.fill):
if (inputType === "date") {
  try {
    const dateResult = await fillDateInput(locator, value, timeout);
    result.actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => "");
    result.matched = result.actualValue.length > 0;
    result.strategy = "fill";
    if (result.matched) return result;
  } catch { /* fall through to general fill */ }
}
```

---

### Phase 3: open-agent — Interpret Fill Results

#### File: `../open-agent/src/tools/browser-adapter.ts`

**Change 6: Update `fill` return type to include results**

```typescript
async fill(fields: Array<{ ref: string; type: string; value?: string | number | boolean }>): Promise<JsonRecord> {
  // Existing code — no change needed since it already returns the full JSON response
  return this.post("/act", {
    kind: "fill",
    fields,
    timeoutMs: this.config.browserTimeoutMs,
  });
}
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

**Change 7: Update `browser.act.fill` tool to report mismatches** (~line 520)

Update the `execute` function of `browser.act.fill` in `createBrowserTools`:

```typescript
{
  name: "browser.act.fill",
  label: "Browser Fill",
  description:
    "Fill fields by refs. Returns per-field results with actual values. " +
    "If any field has matched=false, the fill did not stick — try " +
    "browser.act.discover_dropdown for select-like fields, or retry with " +
    "a different format. Check the 'mismatched' array for failures.",
  parameters: Type.Object({
    fields: Type.Array(
      Type.Object({
        ref: Type.String(),
        type: Type.String(),
        value: Type.Optional(Type.String()),
      }),
    ),
  }),
  execute: async (_toolCallId, params) => {
    const raw = await executeWithRecovery("browser.act.fill", params as Record<string, unknown>);
    // Emit warning event for mismatched fields
    const mismatched = Array.isArray((raw as any).mismatched) ? (raw as any).mismatched : [];
    if (mismatched.length > 0) {
      await args.events.emit(args.ctx, "run_progress", {
        code: "fill_value_mismatch",
        level: "warning",
        mismatched_count: mismatched.length,
        mismatched: mismatched.slice(0, 5),
        message: "Some fields did not accept the provided value. Consider using discover_dropdown or adjusting format.",
      });
    }
    return toToolResult(raw);
  },
},
```

#### File: `../open-agent/skills/job-application-execution.md`

**Change 8: Add fill verification guidance**

Add to **Execute phase**:

```markdown
## Fill verification
- After `browser.act.fill`, check the response `mismatched` array.
- For each mismatched field:
  - If the field is a dropdown/combobox → use `browser.act.discover_dropdown` instead.
  - If the field is type=tel → retry with digits-only format (no dashes/parentheses).
  - If the field is type=date → retry with ISO format (YYYY-MM-DD).
  - If the field uses an input mask → the actual value may contain mask characters; compare digits only.
- Do NOT assume fill succeeded just because no error was thrown.
- Take a snapshot after filling to visually confirm values are present.
```

---

## Testing Strategy

1. **Phone input mask**: Test page with `<input type="tel" placeholder="(555) 555-5555">` and a mask library. Verify digits-only fallback works.
2. **Date input**: Test `<input type="date">` with values "January 15, 2024", "01/15/2024", "2024-01-15". Verify all convert correctly.
3. **Contenteditable**: Test `<div contenteditable>` rich text field. Verify sequential typing fallback works.
4. **React controlled input**: Test React `<input value={state}>` where `.fill()` doesn't trigger `onChange`. Verify `pressSequentially` fallback catches it.
5. **Pre-filled fields**: Test that already-filled fields with correct values are skipped.

## Skyvern Reference

- `handler.py:handle_input_text_action` (lines 540-1140) — full input handler with all strategies
- `handler.py:check_phone_number_format` (lines 220-260) — secondary LLM for phone formatting
- `handler.py:check_date_format` (lines 262-305) — secondary LLM for date formatting
- `handler.py` line 1060: `await skyvern_element.input_sequentially(text=text)` — character-by-character fallback
- `handler.py` line 1140: `await skyvern_element.press_key("Tab")` — auto-complete acceptance hack
