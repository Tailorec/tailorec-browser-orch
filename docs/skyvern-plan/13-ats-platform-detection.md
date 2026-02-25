# 13 — ATS Platform Detection and Platform-Specific Skills

## Problem

Each ATS (Greenhouse, Lever, Ashby, SmartRecruiters, BambooHR, iCIMS) has different UI patterns, form structures, and quirks. A generic "fill the form" approach fails because:

- Greenhouse uses custom Select2 dropdowns; Lever uses native `<select>`
- Lever has a single-page form; Greenhouse has a multi-step wizard
- Ashby has ALL custom React components; BambooHR uses standard HTML
- File upload widgets differ completely across platforms
- EEO sections appear in different positions with different formats

The agent needs to **detect which ATS it's on** and adjust its strategy accordingly.

---

## Implementation Plan

### Phase 1: openclaw-browser — ATS Detection in Page Identity

#### File: `src/browser/pw-tools-core.snapshot.ts`

Extend `detectPageIdentityViaPlaywright` (from plan 10) to include robust ATS detection:

```typescript
// Add to the page.evaluate block in detectPageIdentityViaPlaywright:

// ATS Detection — multiple signals
let atsDetected: string | null = null;
let atsConfidence: "high" | "medium" | "low" = "low";
const url = window.location.href.toLowerCase();
const hostname = window.location.hostname.toLowerCase();
const html = document.documentElement.innerHTML.slice(0, 10000).toLowerCase();
const metaTags = Array.from(document.querySelectorAll("meta")).map(
  (m) => `${m.getAttribute("name") || ""} ${m.getAttribute("content") || ""}`
).join(" ").toLowerCase();

// URL-based detection (high confidence)
if (hostname.includes("greenhouse.io") || hostname.includes("boards.greenhouse")) {
  atsDetected = "greenhouse"; atsConfidence = "high";
} else if (hostname.includes("lever.co") || hostname.includes("jobs.lever")) {
  atsDetected = "lever"; atsConfidence = "high";
} else if (hostname.includes("ashbyhq.com") || hostname.includes("jobs.ashby")) {
  atsDetected = "ashby"; atsConfidence = "high";
} else if (hostname.includes("smartrecruiters.com") || hostname.includes("jobs.smartrecruiters")) {
  atsDetected = "smartrecruiters"; atsConfidence = "high";
} else if (hostname.includes("bamboohr.com")) {
  atsDetected = "bamboohr"; atsConfidence = "high";
} else if (hostname.includes("icims.com") || hostname.includes("careers-")) {
  atsDetected = "icims"; atsConfidence = "high";
}

// HTML content-based detection (medium confidence for embedded ATS)
if (!atsDetected) {
  if (html.includes("greenhouse") && html.includes("application")) {
    atsDetected = "greenhouse"; atsConfidence = "medium";
  } else if (html.includes("lever-jobs") || html.includes("lever-application")) {
    atsDetected = "lever"; atsConfidence = "medium";
  } else if (html.includes("ashby") && html.includes("application")) {
    atsDetected = "ashby"; atsConfidence = "medium";
  } else if (metaTags.includes("greenhouse")) {
    atsDetected = "greenhouse"; atsConfidence = "medium";
  } else if (metaTags.includes("lever")) {
    atsDetected = "lever"; atsConfidence = "medium";
  }
}

// CSS class-based detection (medium confidence)
if (!atsDetected) {
  if (document.querySelector(".greenhouse-job-board, #grnhse_app")) {
    atsDetected = "greenhouse"; atsConfidence = "medium";
  } else if (document.querySelector("[class*='lever-']")) {
    atsDetected = "lever"; atsConfidence = "medium";
  }
}

// Return in result:
// atsDetected, atsConfidence
```

Add to `PageIdentity` type:

```typescript
ats: {
  platform: string | null;      // "greenhouse" | "lever" | "ashby" | etc.
  confidence: "high" | "medium" | "low" | "none";
};
```

---

### Phase 2: open-agent — Platform-Specific Skill Files

#### File: `../open-agent/skills/ats-greenhouse.md` (NEW)

```markdown
---
name: ats-greenhouse
description: Greenhouse-specific application strategies. Loaded when ATS is detected as Greenhouse.
---

# Greenhouse Application Guide

## Form structure
- Multi-step wizard (3-6 steps depending on employer configuration).
- Step order: Resume/Cover Letter → Personal Info → Custom Questions → EEOC → Review.
- Progress bar at top shows step labels.

## Key behaviors
- Resume upload is step 1. Upload FIRST — Greenhouse parses the resume and pre-fills Personal Info.
- After upload, wait 3-5 seconds, then snapshot. Check which fields were auto-filled.
- Phone field often uses input mask with format `(XXX) XXX-XXXX`. Use pressSequentially with digits only.
- "How did you hear about us?" is a custom Select2 dropdown — use discover_dropdown.
- Country/State selects are cascading Select2 widgets. Select country first, wait, then select state.

## Dropdown patterns
- Select2 containers: `<div class="select2-container">` wrapping a hidden `<select>`.
- Click the container → opens a `<div class="select2-results">` with `<li>` options.
- Many Select2 dropdowns have a search input inside — type to filter, then click.

## EEOC section
- Usually the last step before review.
- Gender, Race/Ethnicity, Veteran Status, Disability — all native `<select>`.
- All voluntary. Select "Decline to self-identify" for each.

## Submit
- Review page shows all entered data with edit links per section.
- Submit button: "Submit Application" — only appears on review page.
- After submit: redirects to a thank-you page with confirmation.

## Common pitfalls
- File upload widget is NOT `<input type="file">` — it's a styled button that triggers a hidden input.
- Some employers add a required "Cover Letter" upload that's easy to miss.
- Custom questions can include radio buttons, checkboxes, dropdowns, and free text — all custom components.
- Some employers embed Greenhouse in an iframe on their careers page — ensure snapshot captures iframe content.
```

#### File: `../open-agent/skills/ats-lever.md` (NEW)

```markdown
---
name: ats-lever
description: Lever-specific application strategies. Loaded when ATS is detected as Lever.
---

# Lever Application Guide

## Form structure
- Single-page long form. NO wizard/steps. All sections visible at once.
- Sections (top to bottom): Contact Info → Resume → Links → Additional → EEOC.
- Single "Submit application" button at the very bottom.

## Key behaviors
- Name is often a SINGLE field (not split into first/last). Enter "FirstName LastName".
- Resume upload is a drag-and-drop zone — NOT a native file input.
  - The `<input type="file">` is hidden (`display: none`).
  - Click the drop zone area to trigger the file chooser.
- All fields are on one page — no need for step tracking or "Next" clicks.
- LinkedIn and other URL fields accept full URLs (https://linkedin.com/in/...).
- "Additional information" is a large textarea — use for a brief candidate pitch (2-3 sentences).

## Dropdown patterns
- EEOC dropdowns are native `<select>` elements — use smart_select.
- Other dropdowns (rare) may be custom — detect and use discover_dropdown.

## EEOC section
- Located at the bottom of the page, often collapsed.
- May need to scroll down to see it.
- Gender, Race, Veteran, Disability — all native `<select>`.
- Select "Decline to self-identify" for all.

## Submit
- "Submit application" button at the bottom.
- After submit: page shows "Application submitted" confirmation.
- No separate review step.

## Common pitfalls
- The drop zone upload widget doesn't look like a file input — detect it with detect_upload_widget.
- Some Lever forms auto-save — if you navigate away and come back, fields may be pre-filled.
- The form can be very long — ensure all sections are filled by scrolling through the full page.
- Phone field is usually plain text — any format works.
```

#### File: `../open-agent/skills/ats-ashby.md` (NEW)

```markdown
---
name: ats-ashby
description: Ashby-specific application strategies. Loaded when ATS is detected as Ashby.
---

# Ashby Application Guide

## Form structure
- Single-page form, similar to Lever.
- All custom React components — NO native HTML form elements.
- Sections: Contact → Resume → Links → Questions → Demographics.

## Key behaviors
- Every dropdown is a custom React component with `role="combobox"`.
- ALWAYS use discover_dropdown for ANY select-like field — native selectOption will never work.
- File upload is a custom React button — use detect_upload_widget to find the trigger.
- Fields may have custom validation that fires on blur (when you tab/click away).

## Dropdown patterns
- All dropdowns: `<div role="combobox">` → opens `<div role="listbox">` → `<div role="option">`.
- Many have search/filter built in — type to filter, then click the option.
- discover_dropdown is REQUIRED for all select fields.

## Submit
- Single "Submit" button at the bottom.
- May have a "Save draft" option.
- After submit: confirmation message on the same page.

## Common pitfalls
- fill() may not work on any field — Ashby React components often need click + type.
- If fill doesn't stick, use pressSequentially fallback.
- Custom date pickers are click-based (month/year selectors, not text input).
- Form validation errors appear as styled `<div>` elements, not native browser validation.
```

#### File: `../open-agent/skills/ats-generic.md` (NEW)

```markdown
---
name: ats-generic
description: Generic application strategies for unrecognized ATS platforms.
---

# Generic ATS Application Guide

## When no specific ATS is detected
1. Start with browser.page_identity to detect form structure (wizard vs single-page).
2. Take a full snapshot to discover all fields.
3. Try browser.act.fill first — if it fails, try discover_dropdown or pressSequentially.
4. Look for step indicators (progress bar, step numbers, breadcrumbs).
5. Look for upload widgets — try detect_upload_widget if a file upload is needed.

## General strategies
- Upload resume early in the process (before filling text fields).
- Fill required fields first, then optional fields.
- For any dropdown that fails with fill, switch to discover_dropdown.
- Check for EEO section — always "Decline to self-identify".
- Before submit, snapshot to verify all fields are filled.

## Common generic patterns
- Submit buttons: "Submit", "Apply", "Submit Application", "Complete Application".
- Next buttons: "Next", "Continue", "Proceed", "Next Step".
- Back buttons: "Back", "Previous", "Go Back".
- Required indicators: asterisk (*), "required" text, `[required]` attribute.
```

---

### Phase 3: open-agent — Dynamic Skill Loading Based on ATS

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add ATS-specific skill injection to the `browser.page_identity` tool response:

```typescript
// In browser.page_identity execute handler:
execute: async (_toolCallId, params) => {
  const raw = await executeWithRecovery("browser.page_identity", params as Record<string, unknown>);
  const ats = (raw as any).ats?.platform;

  // Load ATS-specific guidance into the tool response
  let atsGuidance = "";
  if (ats === "greenhouse") {
    atsGuidance = await loadAtsSkill("ats-greenhouse.md");
  } else if (ats === "lever") {
    atsGuidance = await loadAtsSkill("ats-lever.md");
  } else if (ats === "ashby") {
    atsGuidance = await loadAtsSkill("ats-ashby.md");
  } else {
    atsGuidance = await loadAtsSkill("ats-generic.md");
  }

  return toToolResult({
    ...raw,
    atsGuidance: atsGuidance.slice(0, 3000),
    note: ats
      ? `Detected ATS: ${ats}. Follow the platform-specific guidance below.`
      : "No specific ATS detected. Using generic strategies.",
  });
},
```

Helper function:

```typescript
async function loadAtsSkill(filename: string): Promise<string> {
  try {
    const skillPath = path.join(config.skillsDir, filename);
    return await fs.readFile(skillPath, "utf8");
  } catch {
    return "";
  }
}
```

---

### Phase 4: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

Add:

```markdown
## ATS detection protocol
1. ALWAYS call `browser.page_identity` first when landing on an application page.
2. Check the `ats.platform` field in the response.
3. If a specific ATS is detected, follow the platform-specific `atsGuidance` in the response.
4. Key platform differences:
   - **Greenhouse**: Multi-step wizard. Upload resume first. Select2 dropdowns.
   - **Lever**: Single page. Hidden file input behind drop zone. Native selects for EEO.
   - **Ashby**: Single page. ALL custom React components. discover_dropdown for everything.
   - **SmartRecruiters**: Multi-step. May prompt LinkedIn import (skip it).
   - **Generic**: Try fill first, fallback to discover_dropdown on failure.
```

---

## Testing Strategy

1. **Detection accuracy**: Navigate to Greenhouse, Lever, Ashby, SmartRecruiters, BambooHR application pages. Verify correct ATS detection.
2. **Embedded ATS**: Navigate to a company careers page that embeds Greenhouse in an iframe. Verify detection still works.
3. **Skill loading**: Verify the correct skill content is returned in page_identity response.
4. **Strategy application**: Run full application on Greenhouse, verify multi-step wizard handling. Run on Lever, verify single-page handling.
