# 09 — Select Option Improvements

Alignment: direct_port

## Problem

Your current `selectOptionViaPlaywright` (in `pw-tools-core.interactions.ts:133`) only handles native `<select>` elements:

```typescript
await refLocator(page, ref).selectOption(opts.values, { timeout });
```

This fails for:

1. **Custom styled selects** — `<div>` wrappers hiding a native `<select>` underneath
2. **React/Vue select components** — `<input role="combobox">` with `<div role="listbox">` options
3. **Multi-select** — checkboxes within a dropdown panel
4. **Cascading selects** — selecting Country changes the State dropdown options
5. **Native `<select>` with grouped options** — `<optgroup>` labels confuse matching
6. **Select by partial match** — "United States of America" vs "United States" vs "US" vs "USA"

Additionally, the tool isn't exposed as an agent tool — the agent can only use `browser.act.fill` or `browser.act.click`.

### How Skyvern Solves This

Skyvern has a **layered select strategy** (handler.py lines 1690-2010):

1. **Is it a native `<select>`?** → Try `select_option()` by label, then value, then index
2. **Is the `<select>` blocked by an overlay?** → Find the blocker, interact with that instead
3. **Is it a checkbox/radio?** → Route to click handler
4. **Is it a custom dropdown?** → Full incremental DOM observation pipeline:
   a. Click to open
   b. MutationObserver captures new options
   c. LLM picks the best match via a secondary prompt (`custom-select`)
   d. Click the chosen option
   e. Verify dropdown closed
5. **Fallback: type + ArrowDown + select from autocomplete**

For native `<select>`, Skyvern uses `normal_select()` which tries multiple strategies:

```python
async def normal_select(action, skyvern_element, builder, task, step):
    # Strategy 1: Select by label
    try:
        await locator.select_option(label=option.label)
    except:
        pass
    # Strategy 2: Select by value
    try:
        await locator.select_option(value=option.value)
    except:
        pass
    # Strategy 3: Select by index
    try:
        await locator.select_option(index=option.index)
    except:
        pass
    # Strategy 4: LLM picks from available options
    prompt = load_prompt("normal-select", ...)
    response = await LLM(prompt)
```

---

## Implementation Plan

### Phase 1: openclaw-browser — Smart Select Function

#### File: `src/browser/pw-tools-core.interactions.ts`

**Add `smartSelectViaPlaywright` function** (after `selectOptionViaPlaywright`, ~line 152):

```typescript
export type SelectResult = {
  ref: string;
  success: boolean;
  strategy: "native_label" | "native_value" | "native_index" | "native_fuzzy" | "custom_click" | "failed";
  selectedText?: string;
  availableOptions?: string[];
  error?: string;
};

/**
 * Intelligent select that handles both native <select> and custom dropdown components.
 *
 * Strategy order:
 * 1. Check if element is a native <select>:
 *    a. Try selectOption by label (exact match)
 *    b. Try selectOption by value
 *    c. Try fuzzy match on label (case-insensitive, trimmed, partial)
 *    d. Return available options if all fail
 * 2. If not native <select>:
 *    a. Check if element has role="combobox" or similar
 *    b. Delegate to discover_dropdown flow
 */
export async function smartSelectViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
  value: string;          // The desired value/label to select
  timeoutMs?: number;
}): Promise<SelectResult> {
  const started = Date.now();
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });

  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);
  const timeout = Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000));
  const targetValue = opts.value.trim();

  // Step 0: Determine element type
  const elementInfo = await locator.evaluate((el: Element) => ({
    tagName: el.tagName.toLowerCase(),
    role: el.getAttribute("role"),
    isNativeSelect: el.tagName === "SELECT",
    options: el.tagName === "SELECT"
      ? Array.from((el as HTMLSelectElement).options).map(o => ({
          label: o.label || o.textContent?.trim() || "",
          value: o.value,
          index: o.index,
          selected: o.selected,
        }))
      : null,
  }));

  if (elementInfo.isNativeSelect && elementInfo.options) {
    return await handleNativeSelect(locator, ref, targetValue, elementInfo.options, timeout);
  }

  // Not a native select — return info so agent can use discover_dropdown
  return {
    ref,
    success: false,
    strategy: "failed",
    error: `Element is ${elementInfo.tagName} (role=${elementInfo.role}), not a native <select>. Use browser.act.discover_dropdown instead.`,
  };
}

async function handleNativeSelect(
  locator: ReturnType<typeof refLocator>,
  ref: string,
  targetValue: string,
  options: Array<{ label: string; value: string; index: number; selected: boolean }>,
  timeout: number,
): Promise<SelectResult> {
  const availableOptions = options.map(o => o.label).filter(Boolean);

  // Strategy 1: Exact label match
  const exactLabel = options.find(o =>
    o.label.trim().toLowerCase() === targetValue.toLowerCase()
  );
  if (exactLabel) {
    try {
      await locator.selectOption({ label: exactLabel.label }, { timeout });
      return { ref, success: true, strategy: "native_label", selectedText: exactLabel.label, availableOptions };
    } catch { /* try next */ }
  }

  // Strategy 2: Exact value match
  const exactValue = options.find(o =>
    o.value.trim().toLowerCase() === targetValue.toLowerCase()
  );
  if (exactValue) {
    try {
      await locator.selectOption({ value: exactValue.value }, { timeout });
      return { ref, success: true, strategy: "native_value", selectedText: exactValue.label, availableOptions };
    } catch { /* try next */ }
  }

  // Strategy 3: Fuzzy match — case-insensitive partial match
  const fuzzyMatch = options.find(o => {
    const label = o.label.trim().toLowerCase();
    const target = targetValue.toLowerCase();
    return (
      label.includes(target) ||
      target.includes(label) ||
      levenshteinSimilarity(label, target) > 0.8
    );
  });
  if (fuzzyMatch) {
    try {
      await locator.selectOption({ label: fuzzyMatch.label }, { timeout });
      return { ref, success: true, strategy: "native_fuzzy", selectedText: fuzzyMatch.label, availableOptions };
    } catch { /* try next */ }
  }

  // Strategy 4: By index if target is numeric
  const targetIndex = parseInt(targetValue);
  if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < options.length) {
    try {
      await locator.selectOption({ index: targetIndex }, { timeout });
      const selected = options[targetIndex];
      return { ref, success: true, strategy: "native_index", selectedText: selected?.label, availableOptions };
    } catch { /* try next */ }
  }

  // All strategies failed
  return {
    ref,
    success: false,
    strategy: "failed",
    availableOptions,
    error: `Could not match "${targetValue}" to any of ${availableOptions.length} options. Available: ${availableOptions.slice(0, 10).join(", ")}`,
  };
}

/**
 * Simple Levenshtein similarity (0-1 scale).
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return 1 - matrix[a.length][b.length] / maxLen;
}
```

#### File: `src/browser/routes/agent.act.ts`

**Add `smart_select` action kind:**

```typescript
case "smart_select": {
  const ref = toStringOrEmpty(body.ref);
  const value = toStringOrEmpty(body.value);
  if (!ref || !value) return jsonError(res, 400, "ref and value are required");
  const timeoutMs = toNumber(body.timeoutMs);
  const result = await pw.smartSelectViaPlaywright({
    cdpUrl,
    targetId: tab.targetId,
    ref,
    value,
    timeoutMs: timeoutMs ?? undefined,
  });
  return res.json({ ok: true, targetId: tab.targetId, ...result });
}
```

#### File: `src/browser/routes/agent.act.shared.ts`

Add `"smart_select"` to valid action kinds.

---

### Phase 2: open-agent — Smart Select Tool

#### File: `../open-agent/src/tools/browser-adapter.ts`

```typescript
async smartSelect(ref: string, value: string): Promise<JsonRecord> {
  return this.post("/act", {
    kind: "smart_select",
    ref,
    value,
    timeoutMs: this.config.browserTimeoutMs,
  });
}
```

#### File: `../open-agent/src/tools/browser-executor.ts`

```typescript
case "browser.act.smart_select":
  result = await this.adapter.smartSelect(
    args.ref as string,
    args.value as string,
  );
  await this.emitBrowserEvent("smart_select", {
    ref: args.ref,
    success: (result as any).success ?? false,
    strategy: (result as any).strategy ?? "unknown",
  });
  break;
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.act.smart_select",
  label: "Smart Select Option",
  description:
    "Select an option from a native <select> element with intelligent matching. " +
    "Tries: exact label match → exact value match → fuzzy/partial match → index. " +
    "If the element is NOT a native <select> (custom dropdown), returns available info " +
    "and recommends using browser.act.discover_dropdown instead. " +
    "Returns the list of available options if matching fails.",
  parameters: Type.Object({
    ref: Type.String({ description: "Ref of the select element" }),
    value: Type.String({ description: "Desired option text, value, or index" }),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.act.smart_select", params as Record<string, unknown>),
},
```

#### File: `../open-agent/src/tools/browser-tools.ts`

Add `"browser.act.smart_select"` to tool names.

---

### Phase 3: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

Update the dropdown handling section:

```markdown
## Select / dropdown decision tree
1. **Native `<select>`** (role shows as `combobox` with `[options=...]` in snapshot):
   - Use `browser.act.smart_select` with the desired option text.
   - If it returns available options but fails to match, pick the closest from the list.
2. **Custom dropdown** (role shows as `combobox` without `[options=...]`, or `textbox` with dropdown behavior):
   - Use `browser.act.discover_dropdown` to open and discover options.
   - Review returned options, pick the best match.
   - Use `browser.act.click` on the matching option's ref.
3. **Autocomplete / typeahead** (e.g., location, university, company fields):
   - Use `browser.act.discover_dropdown` with `searchText` set to the target value.
   - Pick from filtered results.
4. **Radio button group**:
   - Use `browser.act.click` on the specific radio option ref.
5. **Checkbox group** (multi-select):
   - Use `browser.act.fill` with `type: "checkbox"` and `value: true` for each checked option.
```

---

## Testing Strategy

1. **Native select**: Test with `<select>` having options "United States", "United Kingdom". Try selecting with "US", "united states", "United States".
2. **Fuzzy matching**: Test with option "United States of America" and query "United States".
3. **Value vs label**: Test where label is "USA" but value is "US". Both should work.
4. **Empty first option**: Test `<select>` with `<option value="">Select...</option>` as first option.
5. **Optgroup**: Test `<select>` with `<optgroup label="North America">` containing options.
6. **Custom dropdown fallback**: Test on a `<div role="combobox">`. Verify it reports "not native select, use discover_dropdown".

## Skyvern Reference

- `skyvern/webeye/actions/handler.py` → `handle_select_option_action` (lines 1690-2010)
- `skyvern/webeye/actions/handler.py` → `normal_select()` — multi-strategy native select
- `skyvern/forge/prompts/skyvern/normal-select.j2` — LLM prompt for option matching
- `skyvern/webeye/utils/dom.py` → `SkyvernElement.is_selectable()` — detection
- `skyvern/webeye/utils/dom.py` → `SkyvernElement.find_selectable_child()` — hidden select discovery
