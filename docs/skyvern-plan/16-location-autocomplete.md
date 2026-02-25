# 16 — Location Autocomplete Handling

## Problem

Location fields in job applications are **the second most common failure point** after dropdowns. They use Google Places, Algolia, or custom autocomplete widgets that:

1. Require typing, then waiting for suggestions, then clicking a suggestion
2. Don't accept `fill()` — the value doesn't persist unless a suggestion is selected
3. Show a dropdown of location options after a debounce delay (200-500ms)
4. Validate on blur — if no suggestion was selected, the field clears itself
5. Some split into City / State / Country cascading selects after an initial location search

### Failure Modes

| ATS | Location Widget Type | Failure Mode |
|---|---|---|
| **Greenhouse** | Google Places autocomplete | `fill()` works but value clears on blur; must click suggestion |
| **Lever** | Simple text input (usually) | `fill()` works — no autocomplete. Rare failure. |
| **Ashby** | Custom React autocomplete | Must type, wait for listbox, click option |
| **SmartRecruiters** | Google Places OR custom | Same as Greenhouse |
| **BambooHR** | Split fields (Street/City/State/ZIP) | Multiple fields; state is a `<select>` |

---

## Implementation Plan

### Phase 1: openclaw-browser — Autocomplete Widget Detection

#### File: `src/browser/pw-tools-core.interactions.ts`

**Add `handleLocationAutocompleteViaPlaywright`:**

```typescript
export type LocationAutocompleteResult = {
  success: boolean;
  strategy: "direct_fill" | "type_and_select" | "split_fields" | "failed";
  selectedOption: string | null;   // what option was clicked
  finalValue: string | null;       // final value in the field
  splitFields: Record<string, string> | null;  // for split-field forms (city, state, zip)
  errorDetail: string | null;
};

export async function handleLocationAutocompleteViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;           // ref of the location input field
  value: string;         // desired location (e.g., "San Francisco, CA")
  timeoutMs?: number;
}): Promise<LocationAutocompleteResult> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });

  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);
  const timeout = opts.timeoutMs ?? 5000;
  const result: LocationAutocompleteResult = {
    success: false,
    strategy: "failed",
    selectedOption: null,
    finalValue: null,
    splitFields: null,
    errorDetail: null,
  };

  try {
    // Step 1: Check if this is a simple text input (no autocomplete widget)
    const hasAutocomplete = await locator.evaluate((el: Element) => {
      const input = el as HTMLInputElement;
      // Signals of autocomplete widget:
      return (
        input.getAttribute("role") === "combobox" ||
        input.getAttribute("aria-autocomplete") !== null ||
        input.getAttribute("aria-haspopup") !== null ||
        input.getAttribute("data-google-places") !== null ||
        input.classList.toString().match(/autocomplete|places|location-search|combobox/i) !== null ||
        input.parentElement?.querySelector("[role='listbox']") !== null
      );
    });

    if (!hasAutocomplete) {
      // Strategy 1: Direct fill — simple text input
      await locator.fill(opts.value, { timeout });
      result.finalValue = await locator.inputValue({ timeout: 2000 }).catch(() => null);
      if (result.finalValue && result.finalValue.length > 0) {
        result.success = true;
        result.strategy = "direct_fill";
        return result;
      }
    }

    // Strategy 2: Type and select from autocomplete suggestions
    // Clear any existing value
    await locator.click({ timeout: 2000 });
    await locator.fill("", { timeout: 2000 });

    // Type the location slowly to trigger autocomplete
    const searchText = opts.value.split(",")[0].trim();  // Type just the city name first
    await locator.pressSequentially(searchText, { delay: 80 });

    // Wait for autocomplete suggestions to appear
    let suggestionClicked = false;

    // Strategy 2a: Look for role="listbox" or role="option" elements
    try {
      const listbox = page.locator('[role="listbox"]:visible, .pac-container:visible, [class*="autocomplete-dropdown"]:visible, [class*="suggestion"]:visible');
      await listbox.first().waitFor({ state: "visible", timeout: 3000 });

      // Find the best matching option
      const options = page.locator('[role="option"]:visible, .pac-item:visible, [class*="suggestion-item"]:visible, [class*="autocomplete-option"]:visible');
      const count = await options.count();

      if (count > 0) {
        // Try to find the best match
        let bestMatch = 0;
        let bestScore = 0;
        const targetLower = opts.value.toLowerCase();

        for (let i = 0; i < count && i < 10; i++) {
          const optionText = await options.nth(i).textContent().catch(() => "");
          if (!optionText) continue;
          const optLower = optionText.toLowerCase();

          // Scoring: prefer exact city match, then partial match
          let score = 0;
          if (optLower.includes(searchText.toLowerCase())) score += 10;
          if (optLower.includes(targetLower)) score += 20;
          // Prefer shorter options (more specific)
          score -= (optionText.length - opts.value.length) * 0.1;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = i;
          }
        }

        // Click the best match
        await options.nth(bestMatch).click({ timeout: 2000 });
        result.selectedOption = await options.nth(bestMatch).textContent().catch(() => "");
        suggestionClicked = true;
      }
    } catch {
      // No listbox appeared
    }

    // Strategy 2b: Google Places specific — .pac-container
    if (!suggestionClicked) {
      try {
        const pacContainer = page.locator(".pac-container .pac-item");
        await pacContainer.first().waitFor({ state: "visible", timeout: 2000 });
        await pacContainer.first().click({ timeout: 2000 });
        result.selectedOption = await pacContainer.first().textContent().catch(() => "");
        suggestionClicked = true;
      } catch {
        // No Google Places dropdown
      }
    }

    // Strategy 2c: Press ArrowDown + Enter (keyboard selection)
    if (!suggestionClicked) {
      try {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("Enter");
        suggestionClicked = true;
      } catch {
        // Keyboard selection failed
      }
    }

    if (suggestionClicked) {
      // Verify value stuck
      await page.waitForTimeout(500);
      result.finalValue = await locator.inputValue({ timeout: 2000 }).catch(() => null);
      if (result.finalValue && result.finalValue.length > 0) {
        result.success = true;
        result.strategy = "type_and_select";

        // Check if selecting the location auto-populated other fields (city/state/zip)
        const cityField = page.locator('[name*="city" i], [autocomplete="address-level2"]').first();
        const stateField = page.locator('[name*="state" i], [autocomplete="address-level1"]').first();
        const zipField = page.locator('[name*="zip" i], [name*="postal" i], [autocomplete="postal-code"]').first();

        const split: Record<string, string> = {};
        const cityVal = await cityField.inputValue({ timeout: 1000 }).catch(() => "");
        const stateVal = await stateField.inputValue({ timeout: 1000 }).catch(() => "");
        const zipVal = await zipField.inputValue({ timeout: 1000 }).catch(() => "");

        if (cityVal) split.city = cityVal;
        if (stateVal) split.state = stateVal;
        if (zipVal) split.zip = zipVal;

        if (Object.keys(split).length > 0) {
          result.splitFields = split;
        }

        return result;
      }
    }

    // Strategy 3: Just type and blur — for inputs that accept free text but prefer autocomplete
    await locator.click({ timeout: 2000 });
    await locator.fill(opts.value, { timeout });
    await page.keyboard.press("Tab");  // blur to trigger validation
    await page.waitForTimeout(500);
    result.finalValue = await locator.inputValue({ timeout: 2000 }).catch(() => null);

    if (result.finalValue && result.finalValue.length > 0) {
      result.success = true;
      result.strategy = "direct_fill";
    } else {
      result.errorDetail = "Location value did not persist after any strategy";
    }

    return result;
  } catch (e) {
    result.errorDetail = `Error: ${(e as Error).message}`;
    return result;
  }
}
```

#### File: `src/browser/routes/agent.act.ts`

Add `fill_location` action kind that calls `handleLocationAutocompleteViaPlaywright`.

---

### Phase 2: open-agent — Location Tool

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.fill_location",
  label: "Fill Location Autocomplete Field",
  description:
    "Specialized handler for location fields with autocomplete widgets " +
    "(Google Places, Algolia, etc.). Types the location, waits for suggestions, " +
    "and clicks the best match. Falls back to direct fill if no autocomplete " +
    "widget is detected. Returns selected option and final value. " +
    "Use instead of browser.act.fill for ANY location/address field.",
  parameters: Type.Object({
    ref: Type.String({ description: "Ref of the location input field" }),
    value: Type.String({ description: 'Location to fill (e.g., "San Francisco, CA, USA")' }),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.fill_location", params as Record<string, unknown>),
},
```

---

### Phase 3: Location Value Formatting

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

The agent should know how to format locations for different ATS:

```typescript
// In compactSnapshotForModel or as a utility:
function formatLocationForAts(
  location: { city?: string; state?: string; country?: string; zip?: string },
  ats: string | null,
): string {
  const { city, state, country, zip } = location;

  // Most ATS accept: "City, State" or "City, State, Country"
  const parts: string[] = [];
  if (city) parts.push(city);
  if (state) parts.push(state);
  if (country && country !== "United States" && country !== "US") {
    parts.push(country);
  }

  return parts.join(", ");
}
```

---

### Phase 4: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Location field protocol
1. **Identify location fields**: Look for fields labeled "Location", "City", "Where are you based",
   or fields with `autocomplete="address-*"` in the enriched snapshot.
2. **Use `browser.fill_location`** instead of `browser.act.fill`:
   - It handles Google Places autocomplete, custom React autocomplete, and plain text inputs.
   - Provide the full location string (e.g., "San Francisco, CA, USA").
3. **Verify the result**:
   - `success: true` → location was filled and persisted.
   - `success: false` → try a shorter location (just city name), or type manually.
   - Check `splitFields` — the autocomplete may have auto-populated City/State/ZIP fields.
4. **Split address forms** (BambooHR, some Greenhouse):
   - If City, State, ZIP are separate fields, fill each individually.
   - State field is often a `<select>` — use `smart_select` or fill with state abbreviation.
   - ZIP/Postal code is a text input — fill directly.
5. **Format guidance**:
   - US locations: "City, ST" (e.g., "San Francisco, CA")
   - International: "City, Country" (e.g., "London, United Kingdom")
   - Remote: Some jobs ask "Where will you work from?" — use user's actual location.
```

---

## Testing Strategy

1. **Greenhouse Google Places**: Type "San Francisco", wait for suggestions, verify selection.
2. **Lever plain text**: Fill "New York, NY" directly. Verify it persists.
3. **Ashby React autocomplete**: Type "Austin", wait for listbox, click option.
4. **BambooHR split fields**: Fill City + State dropdown + ZIP separately.
5. **Location clears on blur**: Type and blur without selecting. Verify retry with suggestion click.
6. **International location**: Type "London, United Kingdom". Verify autocomplete handles it.
