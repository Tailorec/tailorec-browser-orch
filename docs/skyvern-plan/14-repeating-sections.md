# 14 — Repeating Sections (Work History / Education)

Alignment: inspired

## Problem

Many job applications have "Add another" repeating sections for:
- Work experience (current + past positions)
- Education (degrees)
- Certifications
- Languages
- References

The agent needs to:
1. Determine how many entries to add from the resume data
2. Click "Add another" N times
3. Fill each entry set with the correct data (position 1, position 2, etc.)
4. Handle "Remove" buttons that appear
5. Handle "Current position" checkbox that hides end date

This is NOT handled by any generic browser automation feature — it requires coordinating resume data with dynamic form sections.

---

## Implementation Plan

### Phase 1: openclaw-browser — Repeating Section Detection

#### File: `src/browser/pw-tools-core.snapshot.ts`

**Add `detectRepeatingSectionsViaPlaywright`:**

```typescript
export type RepeatingSection = {
  sectionType: "work_experience" | "education" | "certification" | "language" | "reference" | "other";
  currentCount: number;            // how many entries currently visible
  addButtonRef: string | null;     // ref of "Add another" button
  addButtonText: string | null;    // text of the button
  removeButtonRefs: string[];      // refs of "Remove" buttons for each entry
  entrySets: Array<{              // field refs grouped by entry
    entryIndex: number;
    fields: Array<{
      ref: string;
      role: string;
      name: string;
      inputType: string | null;
      required: boolean;
      currentValue: string;
    }>;
  }>;
};

export async function detectRepeatingSectionsViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
}): Promise<{ sections: RepeatingSection[] }> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);

  const sections = await page.evaluate(() => {
    const results: any[] = [];

    // Detect "Add another" buttons
    const addButtons = Array.from(document.querySelectorAll(
      'button, a[role="button"], [role="button"]'
    )).filter(el => {
      const text = (el.textContent || "").trim().toLowerCase();
      return /add\s+(another|more|new|entry|position|experience|education|certification|language|reference)/i.test(text) ||
             /\+\s*(add|new)/i.test(text);
    });

    for (const addBtn of addButtons) {
      const btnText = (addBtn.textContent || "").trim();
      const btnTextLower = btnText.toLowerCase();

      // Determine section type from button text
      let sectionType = "other";
      if (btnTextLower.match(/experience|position|employment|work/)) sectionType = "work_experience";
      else if (btnTextLower.match(/education|degree|school|university/)) sectionType = "education";
      else if (btnTextLower.match(/certification|certificate|license/)) sectionType = "certification";
      else if (btnTextLower.match(/language/)) sectionType = "language";
      else if (btnTextLower.match(/reference/)) sectionType = "reference";

      // Find the container section (parent that holds all entries)
      let container = addBtn.parentElement;
      let depth = 0;
      while (container && depth < 5) {
        // Look for a container that has multiple similar child groups
        const inputs = container.querySelectorAll('input:not([type="hidden"]), select, textarea');
        if (inputs.length > 3) break;
        container = container.parentElement;
        depth++;
      }

      if (!container) continue;

      // Count visible entry groups (look for repeated structures)
      const fieldsets = container.querySelectorAll('fieldset, [class*="entry"], [class*="item"], [class*="row"], [class*="section"]');
      const removeButtons = Array.from(container.querySelectorAll(
        'button, [role="button"]'
      )).filter(el => {
        const t = (el.textContent || "").toLowerCase();
        return /remove|delete|×|✕|close/i.test(t) ||
               el.getAttribute("aria-label")?.toLowerCase().includes("remove");
      });

      // Count entries by looking at grouped inputs
      const allInputs = container.querySelectorAll('input:not([type="hidden"]), select, textarea');
      const visibleInputs = Array.from(allInputs).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      // Simple heuristic: count entries by repeated field patterns
      let entryCount = Math.max(1, removeButtons.length);
      if (fieldsets.length > 0) entryCount = Math.max(entryCount, fieldsets.length);

      results.push({
        sectionType,
        currentCount: entryCount,
        addButtonRef: addBtn.getAttribute("aria-ref"),
        addButtonText: btnText.slice(0, 50),
        removeButtonRefs: removeButtons.map(rb => rb.getAttribute("aria-ref")).filter(Boolean),
        fieldCount: visibleInputs.length,
      });
    }

    return results;
  });

  return { sections: sections as RepeatingSection[] };
}
```

#### File: `src/browser/routes/agent.snapshot.ts`

Add `/snapshot/repeating-sections` route.

---

### Phase 2: open-agent — Repeating Section Tool

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.detect_repeating_sections",
  label: "Detect Repeating Sections",
  description:
    "Find 'Add another' sections in the form (work experience, education, " +
    "certifications, etc.). Returns section type, current entry count, " +
    "'Add another' button ref, and remove button refs. " +
    "Use to plan how many entries to add from resume data.",
  parameters: Type.Object({}),
  execute: async (_toolCallId, params) =>
    execute("browser.detect_repeating_sections", params as Record<string, unknown>),
},
```

Add to `createRuntimeTools` — a planning tool that maps resume data to entries:

```typescript
{
  name: "runtime.plan_repeating_entries",
  label: "Plan Repeating Section Entries",
  description:
    "Given a repeating section type and resume data, determine how many entries " +
    "to add and what values to fill for each. Returns a structured fill plan.",
  parameters: Type.Object({
    sectionType: Type.String({ description: "work_experience | education | certification" }),
    currentCount: Type.Number({ description: "How many entries are already on the form" }),
    maxEntries: Type.Optional(Type.Number({ description: "Maximum entries to fill (default 3)" })),
  }),
  execute: async (_toolCallId, params) => {
    const p = params as Record<string, unknown>;
    const sectionType = String(p.sectionType ?? "");
    const currentCount = Number(p.currentCount ?? 0);
    const maxEntries = Math.min(Number(p.maxEntries ?? 3), 5);
    const profile = compactDeferredProfile(contextCore, jobContext);
    const resume = (profile.resume ?? {}) as Record<string, unknown>;
    const experience = Array.isArray(resume.experience) ? resume.experience as Record<string, unknown>[] : [];
    const education = Array.isArray(resume.education) ? resume.education as Record<string, unknown>[] : [];

    let entries: Record<string, unknown>[] = [];
    let fieldMapping: Record<string, string> = {};

    if (sectionType === "work_experience") {
      entries = experience.slice(0, maxEntries);
      fieldMapping = {
        "Company / Employer": "company",
        "Job Title / Position": "title",
        "Start Date": "start_date",
        "End Date": "end_date (or check 'Current' if is_current)",
        "Description / Responsibilities": "description (2-3 bullet points)",
        "Location": "location",
      };
    } else if (sectionType === "education") {
      entries = education.slice(0, maxEntries);
      fieldMapping = {
        "School / University": "institution",
        "Degree": "degree",
        "Field of Study / Major": "field_of_study",
        "Start Date / Year": "start_date or start_year",
        "End Date / Year": "end_date or end_year",
        "GPA": "gpa (only if explicitly asked)",
      };
    }

    const entriesToAdd = Math.max(0, entries.length - currentCount);

    return toToolResult({
      ok: true,
      sectionType,
      totalEntriesInResume: entries.length,
      currentCountOnForm: currentCount,
      entriesToAdd,
      entries: entries.map((entry, i) => ({
        entryIndex: i,
        data: entry,
        isNew: i >= currentCount,
      })),
      fieldMapping,
      instructions:
        entriesToAdd > 0
          ? `Click "Add another" ${entriesToAdd} time(s), then fill each entry with the corresponding data.`
          : `${currentCount} entries already on form. Fill them with the resume data.`,
    });
  },
},
```

---

### Phase 3: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Repeating sections (work history, education)

### Detection
- Call `browser.detect_repeating_sections` to find "Add another" buttons.
- Note the section type and current entry count.

### Planning
- Call `runtime.plan_repeating_entries` with the section type and current count.
- It returns how many entries to add and the data for each.
- Limit to 2-3 most recent entries (most ATS don't need full career history).

### Execution
1. If entries need to be added:
   a. Click the "Add another" button (ref from detect_repeating_sections).
   b. Wait 1 second for new fields to appear.
   c. Snapshot to discover new field refs.
   d. Repeat for each additional entry needed.
2. Fill each entry set with the corresponding resume data:
   - Entry 0 = most recent position/degree
   - Entry 1 = second most recent, etc.
3. For "Current position" checkboxes:
   - Check it for the most recent entry if is_current=true in resume data.
   - This will hide the end date field — don't try to fill it.
4. For date fields in work history:
   - Use the format indicated by the placeholder.
   - If only month/year required, enter "MM/YYYY".
   - If "Present" is an option for end date, select it for current positions.

### Common pitfalls
- Don't add more entries than you have data for.
- Fields in entry 0 and entry 1 look the same but have different refs — use fresh snapshot after adding.
- "Remove" buttons may shift refs — always snapshot before filling a new entry set.
- Some ATS pre-populate the first entry from resume parsing — check before overwriting.
```

---

## Testing Strategy

1. **Greenhouse work history**: Add 2 work experience entries. Verify refs are correctly mapped to each entry.
2. **Education section**: Add 1 education entry. Fill with degree, school, dates.
3. **"Current position" checkbox**: Check the box, verify end date field disappears.
4. **Remove entry**: Add an entry, then remove it. Verify form state is correct.
5. **Pre-populated entry**: Upload resume first, verify first entry is pre-filled, then add second entry.
