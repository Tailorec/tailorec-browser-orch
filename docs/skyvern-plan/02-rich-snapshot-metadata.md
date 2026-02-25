# 02 — Rich Snapshot Metadata

## Problem

Your current snapshot pipeline uses Playwright's accessibility tree (`_snapshotForAI` / `ariaSnapshot`), which produces lines like:

```
- textbox "Phone Number" [ref=e12]
- combobox "Country" [ref=e14]
- checkbox "I agree to Terms" [ref=e18]
```

This loses **critical HTML attributes** that Skyvern preserves in its DOM scraper:

| Lost attribute | Why it matters for job apps |
|---|---|
| `required` | Agent doesn't know which fields MUST be filled vs optional |
| `type` (tel, date, email, url, number) | Agent can't format values correctly (phone format, date format) |
| `placeholder` | Hints about expected format ("MM/DD/YYYY", "(555) 555-5555") |
| `pattern` | Regex validation the form will enforce client-side |
| `maxlength` | Agent might type too-long values that get silently truncated |
| `value` / current input value | Agent can't see what's already filled — may overwrite correct values or skip already-filled fields |
| `disabled` / `readonly` | Agent wastes actions trying to fill unfillable fields |
| `aria-required` | Alternative required indicator |
| `accept` (on file inputs) | Agent doesn't know which file types are accepted |
| `autocomplete` | Hints about field semantics (`given-name`, `family-name`, `tel`, `email`) |
| `name` attribute | Often contains semantic hints like `applicant_phone`, `resume_file` |
| `min` / `max` / `step` (on number/date) | Range constraints |

### How Skyvern Solves This

Skyvern's `domUtils.js` (2,971 lines) walks every DOM element and preserves a curated set of attributes defined in `scraper.py` `RESERVED_ATTRIBUTES`:

```python
RESERVED_ATTRIBUTES = {
    "accept", "alt", "aria-checked", "aria-current", "aria-disabled",
    "aria-label", "aria-readonly", "aria-required", "aria-role",
    "aria-selected", "checked", "data-original-title", "data-ui",
    "disabled", "for", "href", "maxlength", "name", "pattern",
    "placeholder", "readonly", "required", "selected",
    "shape-description", "src", "text-value", "title", "type", "value",
}
```

Each element in the tree carries these attributes so the LLM prompt includes them.

---

## Implementation Plan

### Phase 1: openclaw-browser — Enrich Ref Metadata at Snapshot Time

#### File: `src/browser/pw-role-snapshot.ts`

**Change 1: Extend `RoleRef` type** (line 1)

```typescript
// BEFORE
export type RoleRef = {
  role: string;
  name?: string;
  nth?: number;
};

// AFTER
export type RoleRef = {
  role: string;
  name?: string;
  nth?: number;
  // --- NEW enriched metadata ---
  inputType?: string;        // <input type="...">: text, tel, email, date, url, number, file, password
  required?: boolean;        // from required attr or aria-required="true"
  disabled?: boolean;        // from disabled attr or aria-disabled="true"
  readonly?: boolean;        // from readonly attr or aria-readonly="true"
  placeholder?: string;      // placeholder text
  currentValue?: string;     // current value in the field (capped at 200 chars)
  maxLength?: number;        // maxlength attribute
  pattern?: string;          // pattern attribute (regex for validation)
  accept?: string;           // accept attribute on file inputs
  autocomplete?: string;     // autocomplete attribute (given-name, email, tel, etc.)
  fieldName?: string;        // name attribute (semantic hint)
  checked?: boolean;         // for checkboxes/radios
  options?: string[];        // for native <select>: first 20 option labels
  min?: string;              // min attr for number/date
  max?: string;              // max attr for number/date
};
```

#### File: `src/browser/pw-tools-core.snapshot.ts`

**Change 2: Post-process snapshot to enrich refs with HTML attributes**

Add a new function `enrichRefsWithHtmlAttributes` and call it after building the snapshot:

```typescript
import type { Page } from "playwright-core";
import type { RoleRefMap } from "./pw-role-snapshot.js";

/**
 * For each ref in the map, locate the actual DOM element via Playwright
 * and read HTML attributes that the accessibility tree doesn't expose.
 *
 * Runs in parallel (batched) for performance.
 */
async function enrichRefsWithHtmlAttributes(
  page: Page,
  refs: RoleRefMap,
): Promise<void> {
  const BATCH_SIZE = 30;
  const refEntries = Object.entries(refs);

  for (let i = 0; i < refEntries.length; i += BATCH_SIZE) {
    const batch = refEntries.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async ([refId, refData]) => {
        try {
          // Use the same ref locator mechanism used by interactions
          const locator = page.locator(`internal:aria-ref=${refId}`);
          const count = await locator.count();
          if (count === 0) return;

          const el = locator.first();

          const attrs = await el.evaluate((node: Element) => {
            const input = node as HTMLInputElement;
            return {
              tagName: node.tagName?.toLowerCase() || "",
              type: input.type || node.getAttribute("type") || "",
              required:
                input.required ||
                node.hasAttribute("required") ||
                node.getAttribute("aria-required") === "true",
              disabled:
                input.disabled ||
                node.hasAttribute("disabled") ||
                node.getAttribute("aria-disabled") === "true",
              readonly:
                input.readOnly ||
                node.hasAttribute("readonly") ||
                node.getAttribute("aria-readonly") === "true",
              placeholder: input.placeholder || node.getAttribute("placeholder") || "",
              value: (input.value || node.getAttribute("value") || "").slice(0, 200),
              maxLength: input.maxLength > 0 && input.maxLength < 100000 ? input.maxLength : null,
              pattern: node.getAttribute("pattern") || "",
              accept: node.getAttribute("accept") || "",
              autocomplete: node.getAttribute("autocomplete") || "",
              name: node.getAttribute("name") || "",
              checked: input.checked ?? null,
              min: node.getAttribute("min") || "",
              max: node.getAttribute("max") || "",
              // For native <select>, grab option labels
              options:
                node.tagName === "SELECT"
                  ? Array.from((node as HTMLSelectElement).options)
                      .slice(0, 20)
                      .map((o) => o.label || o.textContent?.trim() || "")
                      .filter(Boolean)
                  : null,
            };
          });

          // Only attach non-empty/non-default values
          if (attrs.type && attrs.type !== "text") refData.inputType = attrs.type;
          if (attrs.required) refData.required = true;
          if (attrs.disabled) refData.disabled = true;
          if (attrs.readonly) refData.readonly = true;
          if (attrs.placeholder) refData.placeholder = attrs.placeholder;
          if (attrs.value) refData.currentValue = attrs.value;
          if (attrs.maxLength) refData.maxLength = attrs.maxLength;
          if (attrs.pattern) refData.pattern = attrs.pattern;
          if (attrs.accept) refData.accept = attrs.accept;
          if (attrs.autocomplete) refData.autocomplete = attrs.autocomplete;
          if (attrs.name) refData.fieldName = attrs.name;
          if (attrs.checked !== null && (refData.role === "checkbox" || refData.role === "radio")) {
            refData.checked = attrs.checked;
          }
          if (attrs.options && attrs.options.length > 0) refData.options = attrs.options;
          if (attrs.min) refData.min = attrs.min;
          if (attrs.max) refData.max = attrs.max;
        } catch {
          // Element disappeared or inaccessible — skip silently
        }
      }),
    );
  }
}
```

**Change 3: Wire enrichment into `snapshotAiViaPlaywright`** (~line 62)

```typescript
// AFTER building refs from buildRoleSnapshotFromAiSnapshot:
const built = buildRoleSnapshotFromAiSnapshot(snapshot, opts.options);

// NEW: enrich refs with HTML attributes
await enrichRefsWithHtmlAttributes(page, built.refs);

storeRoleRefsForTarget({ ... });
```

**Change 4: Wire enrichment into `snapshotRoleViaPlaywright`** (~line 176 and ~line 210)

Same pattern — call `enrichRefsWithHtmlAttributes(page, built.refs)` after building refs in both the `aria` and `role` code paths.

---

### Phase 2: openclaw-browser — Embed Key Metadata in Snapshot Text

The enriched `refs` map is already returned in the JSON response, but the **snapshot text** (which is what the LLM sees in `interactiveView`) doesn't show these attributes. We should annotate the text lines.

#### File: `src/browser/pw-role-snapshot.ts`

**Change 5: Add `annotateSnapshotWithMetadata` function**

```typescript
/**
 * Post-process a snapshot string to append critical metadata tags to each ref line.
 *
 * Before: - textbox "Phone" [ref=e12]
 * After:  - textbox "Phone" [ref=e12] [type=tel] [required] [placeholder=(555) 555-5555]
 */
export function annotateSnapshotWithMetadata(
  snapshot: string,
  refs: RoleRefMap,
): string {
  const lines = snapshot.split("\n");
  return lines
    .map((line) => {
      const match = line.match(/\[ref=(e\d+)\]/);
      if (!match) return line;
      const ref = refs[match[1]];
      if (!ref) return line;

      const tags: string[] = [];
      if (ref.inputType && ref.inputType !== "text") tags.push(`[type=${ref.inputType}]`);
      if (ref.required) tags.push("[required]");
      if (ref.disabled) tags.push("[disabled]");
      if (ref.readonly) tags.push("[readonly]");
      if (ref.placeholder) tags.push(`[placeholder=${ref.placeholder.slice(0, 40)}]`);
      if (ref.currentValue) tags.push(`[value=${ref.currentValue.slice(0, 40)}]`);
      if (ref.maxLength) tags.push(`[maxlength=${ref.maxLength}]`);
      if (ref.pattern) tags.push(`[pattern=${ref.pattern.slice(0, 30)}]`);
      if (ref.accept) tags.push(`[accept=${ref.accept}]`);
      if (ref.checked !== undefined) tags.push(`[checked=${ref.checked}]`);
      if (ref.options && ref.options.length > 0) {
        tags.push(`[options=${ref.options.slice(0, 5).join("|")}${ref.options.length > 5 ? "|..." : ""}]`);
      }

      if (tags.length === 0) return line;
      return `${line} ${tags.join(" ")}`;
    })
    .join("\n");
}
```

**Change 6: Apply annotation in snapshot functions**

In `snapshotAiViaPlaywright` and `snapshotRoleViaPlaywright`, after enrichment:

```typescript
built.snapshot = annotateSnapshotWithMetadata(built.snapshot, built.refs);
```

---

### Phase 3: open-agent — Leverage Enriched Metadata

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

**Change 7: Update `rankSnapshotRef` to use new metadata** (~line 82)

```typescript
function rankSnapshotRef(args: {
  ref: string;
  role: string;
  name: string;
  snapshotLine: string;
  isNearForm: boolean;
  // NEW fields from enriched refs
  required?: boolean;
  inputType?: string;
  disabled?: boolean;
  currentValue?: string;
}): RankedSnapshotRef {
  // ...existing scoring...

  // NEW scoring boosts
  if (args.required) score += 100;       // Required fields are top priority
  if (args.disabled) score -= 200;       // Don't waste time on disabled fields
  if (args.currentValue) score -= 30;    // Already-filled fields are lower priority
  if (args.inputType === "file") score += 120;  // File uploads are critical
  if (args.inputType === "hidden") score -= 300; // Hidden inputs are irrelevant

  // ...rest of function...
}
```

**Change 8: Update `rankSnapshotRefsForModel` to pass enriched data** (~line 157)

```typescript
export function rankSnapshotRefsForModel(data: Record<string, unknown>): RankedSnapshotRef[] {
  // ...existing code...
  return Object.entries(refs)
    .map(([ref, value]) =>
      rankSnapshotRef({
        ref,
        role: String(value?.role ?? ""),
        name: String(value?.name ?? ""),
        snapshotLine: lineByRef.get(ref) ?? "",
        isNearForm: formProximityRefs.has(ref),
        // NEW: pass enriched metadata
        required: value?.required === true,
        inputType: typeof value?.inputType === "string" ? value.inputType : undefined,
        disabled: value?.disabled === true,
        currentValue: typeof value?.currentValue === "string" ? value.currentValue : undefined,
      }),
    )
    .sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));
}
```

**Change 9: Update `compactSnapshotForModel` to include metadata summary** (~line 170)

Add to the returned object:

```typescript
return {
  // ...existing fields...
  requiredFieldCount: topRefs.filter(r => refs[r.ref]?.required === true).length,
  filledFieldCount: topRefs.filter(r => typeof refs[r.ref]?.currentValue === "string" && refs[r.ref].currentValue).length,
  fileInputCount: topRefs.filter(r => refs[r.ref]?.inputType === "file").length,
  disabledFieldCount: topRefs.filter(r => refs[r.ref]?.disabled === true).length,
};
```

#### File: `../open-agent/skills/job-application-execution.md`

**Change 10: Add metadata awareness instructions**

Add to **Discover phase**:

```markdown
- Read the enriched snapshot metadata for each ref:
  - `[required]` → MUST fill this field
  - `[value=...]` → already has a value; skip unless incorrect
  - `[type=tel]` → format as phone number
  - `[type=date]` → use the format indicated by `[placeholder=...]`
  - `[type=file]` with `[accept=...]` → upload only matching file types
  - `[disabled]` or `[readonly]` → skip, cannot interact
  - `[maxlength=N]` → truncate value to N characters
  - `[pattern=...]` → value must match this regex
  - `[options=A|B|C]` → native select with these choices; use browser.act.fill with exact option text
  - `[checked=true/false]` → checkbox/radio current state
```

---

### Phase 4: open-agent — Skip Already-Filled Fields

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

**Change 11: Add filled-field summary to snapshot response**

In the `browser.snapshot` tool's execute handler, after compacting, add:

```typescript
// Summarize already-filled fields for the model
const filledFields = prioritizedRefs
  .filter((entry) => {
    const refData = refs[entry.ref];
    return refData && typeof refData.currentValue === "string" && refData.currentValue.trim().length > 0;
  })
  .slice(0, 20)
  .map((entry) => ({
    ref: entry.ref,
    role: entry.role,
    name: entry.name,
    currentValue: String(refs[entry.ref]?.currentValue ?? "").slice(0, 60),
  }));

// Add to compacted result
compactedRecord.alreadyFilledFields = filledFields;
compactedRecord.alreadyFilledCount = filledFields.length;
```

---

## Performance Considerations

- **Enrichment cost**: Reading attributes for 120 refs takes ~100-200ms (30 parallel batches of 4). Acceptable for snapshot operations that take 1-3s total.
- **Snapshot size increase**: Each annotated line adds ~40-80 chars. For 120 refs, that's ~5-10KB extra — well within the 70KB snapshot budget.
- **Token cost**: The enriched metadata is highly information-dense. A few extra tokens per ref saves entire LLM round-trips that would otherwise be spent discovering field types.

## Skyvern Reference

- `skyvern/webeye/scraper/scraper.py` → `RESERVED_ATTRIBUTES` set (line 40-63)
- `skyvern/webeye/scraper/scraper.py` → `trim_element` (line 692) — strips non-essential attributes but keeps reserved ones
- `skyvern/webeye/scraper/domUtils.js` — full DOM walk extracting attributes
- `skyvern/forge/prompts/skyvern/extract-action.j2` — prompt tells LLM: *"Don't return any action for the same field, if this field is already filled in and the value is the same"*
