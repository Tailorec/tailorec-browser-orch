# 08 — Prompt and Skill Upgrade

## Problem

Your current system prompt (`prompt-builder.ts`) and skill file (`job-application-execution.md`) are functional but lack the structured reasoning patterns that make Skyvern's form-filling reliable. Key gaps:

1. **No structured action output format** — the LLM decides freely what tools to call, in what order, with what reasoning. Skyvern forces a JSON schema with `reasoning`, `confidence_float`, `user_detail_query/answer` per action.
2. **No explicit field-to-value mapping step** — Skyvern's prompt asks the LLM to explain which field each action targets and where the value comes from.
3. **No action history awareness** — your prompt doesn't include what the agent did on previous turns, so the LLM may repeat failed actions.
4. **No completion/termination criteria** — no explicit rules for when to declare success vs. failure.
5. **No multi-model strategy** — Skyvern uses a secondary (cheaper) LLM for format-checking tasks.
6. **Weak required-field enforcement** — "Fill every visible required input" is too vague; needs structured reasoning.

### How Skyvern Structures It

Skyvern's `extract-action.j2` prompt forces the LLM to output:
```json
{
  "user_goal_stage": "reasoning about progress",
  "user_goal_achieved": false,
  "action_plan": "I will fill first name, last name, email, then click Next",
  "actions": [
    {
      "reasoning": "First name field is empty and required",
      "user_detail_query": "What is the user's first name?",
      "user_detail_answer": "John",
      "confidence_float": 0.95,
      "action_type": "INPUT_TEXT",
      "id": "e12",
      "text": "John",
      "context": {
        "field": "first_name",
        "is_required": true,
        "is_search_bar": false,
        "is_location_input": false,
        "is_date_related": false
      }
    }
  ]
}
```

---

## Implementation Plan

### Phase 1: Enhanced System Prompt

#### File: `../open-agent/src/context/prompt-builder.ts`

**Change 1: Add structured reasoning directives** (modify `buildSystemPrompt`)

Replace the `mandatory` block (~line 170) with a more structured version:

```typescript
const mandatory = [
  "You are Tailorec Apply Agent. Your sole mission is completing job applications accurately.",
  "",
  "## Decision Framework",
  "Before each action batch, reason through:",
  "1. GOAL STATUS: What progress has been made? What remains?",
  "2. PAGE STATE: What page/step am I on? What fields are visible?",
  "3. FIELD MAPPING: For each visible field, what value should go in it and where does that value come from?",
  "4. ACTION PLAN: List the specific actions in execution order.",
  "5. BLOCKERS: Are there overlays, CAPTCHAs, or missing data blocking progress?",
  "",
  "## Tool Usage Rules",
  "- ALWAYS snapshot first to discover the page state before filling.",
  "- After discovering fields, call runtime.get_profile_context to load user data.",
  "- Map profile data to discovered fields, then fill in a single batch when possible.",
  "- After filling, snapshot again to verify values stuck and check for errors.",
  "- For dropdowns/combobox elements: use browser.act.discover_dropdown, NOT browser.act.fill.",
  "- Before submitting: call runtime.request_approval and wait for explicit yes/no/wait.",
  "",
  "## Required Field Policy",
  "- Fill ALL visible required fields (marked with [required] or *) that have known values.",
  "- If a required field has no matching profile data, make a reasonable inference or ask.",
  "- Never skip a required field — this causes submission failure.",
  "- Check that filled values match expected format (phone, date, email, URL).",
  "",
  "## Error Recovery",
  "- If a fill returns mismatched values, try a different strategy (discover_dropdown, pressSequentially).",
  "- If validation errors appear (red text, aria-invalid), fix them before proceeding.",
  "- If an element is blocked by overlay, dismiss the overlay first.",
  "- If a ref is stale (element not found), take a fresh snapshot and re-identify.",
  "- Never repeat the same failed action more than once — try an alternative approach.",
  "",
  "## Completion Rules",
  "- Declare completion ONLY when the application is actually submitted (success URL or confirmation text visible).",
  "- Declare failure if: login/SSO required, CAPTCHA unsolvable, job posting expired, or application already submitted.",
  "- Before final submit: always request_approval.",
  "",
  `Current run phase: ${currentPhase}`,
  `Primary instruction: ${instruction}`,
  `Job: title=${targetTitle}, company=${targetCompany}, url=${targetUrl}`,
].join("\n");
```

---

### Phase 2: Enhanced Skill File

#### File: `../open-agent/skills/job-application-execution.md` (REWRITE)

```markdown
---
name: job-application-execution
description: Execute online job applications end-to-end with high accuracy. Use when filling ATS/career-site forms, uploading resume/profile, answering screening questions, and preparing for submission.
---

# Job Application Execution Skill

## 3-Phase Workflow

### Phase 1: Discover
1. Navigate to the job URL.
2. Take a snapshot (`browser.snapshot`) to map the page.
3. Identify:
   - Required fields: look for `[required]` tag, asterisks (*), or "required" text
   - Field types: `[type=tel]`, `[type=date]`, `[type=email]`, `[type=file]`, combobox, checkbox, radio
   - Current values: `[value=...]` — skip fields already correctly filled
   - Disabled fields: `[disabled]` — cannot interact, skip
   - Navigation controls: Next/Continue/Submit buttons, step indicators
   - Blockers: overlays, CAPTCHAs, login walls
4. Record multi-step structure if present (step indicators, progress bars).

### Phase 2: Execute
1. Call `runtime.get_profile_context` to load user data.
2. Create a field-to-value mapping:
   - First Name → `user_profile.first_name`
   - Last Name → `user_profile.last_name`
   - Email → `user_profile.email` or `resume.email`
   - Phone → `resume.phone` (format to match placeholder)
   - LinkedIn → `user_profile.linkedin_url`
   - Resume upload → `resume.upload_url`
   - Years of experience → `resume.total_experience_years`
   - Location → `user_profile.preferred_location`
3. Fill fields in a single `browser.act.fill` batch for text inputs.
4. Handle special field types:
   - **Dropdowns/combobox**: Use `browser.act.discover_dropdown` → review options → `browser.act.click` on match
   - **Radio buttons**: Click the correct option ref
   - **Checkboxes**: Use `browser.act.fill` with `type: "checkbox"`, `value: true`
   - **File upload**: Use `browser.upload` with the resume URL
   - **Date fields**: Format to match `[placeholder=...]` hint, or use ISO YYYY-MM-DD
   - **Phone fields**: Format to match `[placeholder=...]` hint, or try digits-only
5. After filling, take a snapshot to verify:
   - All required fields have values
   - No validation errors appeared
   - Dropdown selections display correctly
6. Fix any errors before proceeding.

### Phase 3: Approve & Submit
1. Navigate through all multi-step pages, filling each step.
2. On the final step / review page:
   - Take a snapshot to confirm all sections are complete
   - Optionally take a screenshot for visual verification
3. Call `runtime.request_approval` with a summary of what was filled.
4. Wait for user response:
   - `yes` → click submit button
   - `no` → stop execution
   - `wait` → continue waiting
5. After submit, take a snapshot to confirm success.

## Field Mapping Reference

| Form Label Pattern | Profile Source | Format Notes |
|---|---|---|
| First name, Given name | `user_profile.first_name` | |
| Last name, Family name, Surname | `user_profile.last_name` | |
| Email, Email address | `user_profile.email` or `resume.email` | |
| Phone, Mobile, Contact number, Telephone | `resume.phone` | Match placeholder format |
| LinkedIn, LinkedIn URL | `user_profile.linkedin_url` | Full URL with https:// |
| Portfolio, Website, Personal URL | `user_profile.portfolio_url` | Full URL with https:// |
| Resume, CV, Upload resume | `resume.upload_url` | Use browser.upload |
| Years of experience, Total experience, YOE | `resume.total_experience_years` | Integer or "X+" format |
| Location, City, Where do you live | `user_profile.preferred_location` | |
| Current company, Employer | `resume.experience[0].company` | Most recent |
| Current title, Job title | `resume.experience[0].title` | Most recent |
| Education, University, School | `resume.education[0].institution` | |
| Degree | `resume.education[0].degree` | |
| Skills | `resume.skills` (comma-separated) | Top 5-8 relevant |

## Screening Question Strategies

| Question Pattern | Strategy |
|---|---|
| "Are you authorized to work in [country]?" | Select "Yes" (default assumption unless profile indicates otherwise) |
| "Do you require visa sponsorship?" | Select based on profile citizenship/visa status, default "No" |
| "What is your desired salary?" | If known from profile, use it. Otherwise skip or enter range midpoint |
| "How did you hear about us?" | Select "Job Board" or "Company Website" |
| "Are you willing to relocate?" | Select "Yes" if job location matches preferred_location, otherwise "Open to discussion" |
| "Do you have a disability?" | Select "Prefer not to answer" or "Decline to self-identify" |
| "Gender/Race/Ethnicity/Veteran" | Select "Prefer not to answer" or "Decline to self-identify" |
| "Start date / availability" | "Immediately" or "2 weeks notice" |
| Free-text "Why do you want to work here?" | 2-3 sentences connecting skills to job requirements |
| Free-text "Additional information" | Brief summary of relevant qualifications |

## Error Recovery Matrix

| Error | Detection | Recovery |
|---|---|---|
| Fill value mismatch | `mismatched` array in fill result | Try discover_dropdown or pressSequentially |
| Validation error | `[aria-invalid]` tag or red error text in snapshot | Read error text, fix value, re-fill |
| Stale ref | "Element not found" error | Fresh snapshot, re-identify ref |
| Overlay blocking | Fill/click fails, element obscured | dismiss_blocker tool or find close button |
| Page navigation | URL changed after click | Fresh snapshot, assess new page |
| Required field missing | "This field is required" text | Go back, fill the field |
| File upload failure | No filename shown after upload | Retry upload, verify upload_url accessible |
| CAPTCHA | CAPTCHA element detected | Escalate to user, cannot solve |
| Login/SSO wall | Login form detected instead of application | Escalate to user |
| Job expired | "This position has been filled" | Report failure |

## Multi-Step Form Handling

1. On each step:
   a. Snapshot to discover fields
   b. Fill all required fields
   c. Verify no errors
   d. Click Next/Continue
2. After navigating to next step:
   a. Snapshot the new step
   b. Check if it's a new form section or a review/summary page
   c. If review page: verify all sections, then proceed to approval
3. If a step fails:
   a. Do NOT click Next again
   b. Fix the error on the current step
   c. Re-verify, then click Next
4. Track progress: "Completed step 2 of 4: Personal Information"

## Tool Selection Guide

| Need | Tool |
|---|---|
| See what's on the page | `browser.snapshot` |
| Fill text fields | `browser.act.fill` |
| Click buttons/links | `browser.act.click` |
| Handle dropdowns | `browser.act.discover_dropdown` → `browser.act.click` |
| Upload files | `browser.upload` |
| Submit form | `browser.submit` or `browser.act.click` on submit button |
| Get user data | `runtime.get_profile_context` |
| Pre-submit review | `runtime.request_approval` |
| Visual check | `browser.screenshot` (use sparingly) |
| Check element state | `browser.act.query_state` |
| Dismiss popup | `browser.act.dismiss_blocker` |
| Track page changes | `browser.snapshot.delta_start` → action → `browser.snapshot.delta_stop` |
```

---

### Phase 3: Action History in Prompt

#### File: `../open-agent/src/context/prompt-builder.ts`

**Change 2: Include recent tool call history in prompt**

Add a new section builder:

```typescript
function buildRecentActionsBlock(transcript: Array<{ role: string; text: string }>): string {
  // Extract tool-related messages from recent transcript
  const toolMessages = transcript
    .filter(entry =>
      entry.role === "tool" ||
      entry.text.includes("browser.") ||
      entry.text.includes("runtime.") ||
      entry.text.includes("fill") ||
      entry.text.includes("click") ||
      entry.text.includes("snapshot")
    )
    .slice(-8);

  if (toolMessages.length === 0) return "";

  return toolMessages
    .map(entry => `- [${entry.role}] ${truncateStable(entry.text, 200)}`)
    .join("\n");
}
```

Add to the `blocks` array in `buildSystemPrompt`:

```typescript
const recentActions = buildRecentActionsBlock(context.transcript);
// Add after "Recent session history":
recentActions ? section("Recent tool actions (avoid repeating failures)", recentActions) : "",
```

---

### Phase 4: Confidence-Gated Submission

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

**Change 3: Add pre-submit validation tool**

Add to `createRuntimeTools`:

```typescript
{
  name: "runtime.validate_before_submit",
  label: "Pre-Submit Validation Check",
  description:
    "Run a structured validation check before requesting approval. " +
    "Pass the list of fields you filled and their values. " +
    "Returns a validation report highlighting any gaps.",
  parameters: Type.Object({
    filledFields: Type.Array(
      Type.Object({
        fieldName: Type.String(),
        value: Type.String(),
        source: Type.String({ description: "Where the value came from (profile, inference, user)" }),
        required: Type.Boolean(),
      }),
    ),
    totalRequiredFields: Type.Number(),
    currentStep: Type.Optional(Type.String()),
    totalSteps: Type.Optional(Type.Number()),
  }),
  execute: async (_toolCallId, params) => {
    const p = params as Record<string, unknown>;
    const filled = (p.filledFields as Array<Record<string, unknown>>) ?? [];
    const totalRequired = (p.totalRequiredFields as number) ?? 0;
    const requiredFilled = filled.filter((f) => f.required).length;

    const gaps: string[] = [];
    if (requiredFilled < totalRequired) {
      gaps.push(`Only ${requiredFilled}/${totalRequired} required fields filled`);
    }

    const emptyRequired = filled.filter((f) => f.required && !f.value);
    for (const field of emptyRequired) {
      gaps.push(`Required field "${field.fieldName}" has no value`);
    }

    return toToolResult({
      ok: gaps.length === 0,
      filledCount: filled.length,
      requiredFilledCount: requiredFilled,
      totalRequiredFields: totalRequired,
      completionPercent: totalRequired > 0 ? Math.round((requiredFilled / totalRequired) * 100) : 100,
      gaps,
      readyToSubmit: gaps.length === 0,
      recommendation: gaps.length === 0
        ? "All required fields filled. Proceed to runtime.request_approval."
        : `Fix ${gaps.length} gap(s) before submitting: ${gaps.join("; ")}`,
    });
  },
},
```

---

## Skyvern Reference

- `skyvern/forge/prompts/skyvern/extract-action.j2` — full action extraction prompt with structured JSON output
- `skyvern/forge/agent.py` → `execute_step()` — step loop with action history
- `skyvern/webeye/actions/actions.py` → `InputOrSelectContext` — structured field context
- `skyvern/forge/prompts/skyvern/check-phone-number-format.j2` — secondary LLM for formatting
- `skyvern/forge/prompts/skyvern/check-date-format.j2` — secondary LLM for date format
