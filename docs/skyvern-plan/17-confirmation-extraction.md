# 17 — Confirmation Extraction

## Problem

After submitting a job application, the agent needs to confirm it was actually submitted and extract any confirmation signals. Without this:

1. The agent reports "success" but the application was actually rejected by validation
2. No record of the confirmation number or reference ID
3. No way to verify later whether the application was received
4. The run completes without knowing if the form went through

### Confirmation Patterns by ATS

| ATS | Post-Submit Behavior | Confirmation Signals |
|---|---|---|
| **Greenhouse** | Redirect to thank-you page | "Your application has been received" + optional confirmation email note |
| **Lever** | Same-page confirmation message | "Application submitted" banner + "You'll hear back from us" text |
| **Ashby** | Same-page or redirect | "Thank you for applying" message |
| **SmartRecruiters** | Multi-step → confirmation page | "Application submitted successfully" + confirmation number |
| **BambooHR** | Redirect to confirmation | "Thank you" page |
| **Generic** | Varies | Page title change, URL change, success message |

---

## Implementation Plan

### Phase 1: openclaw-browser — Post-Submit Page Analysis

#### File: `src/browser/pw-tools-core.snapshot.ts`

**Add `extractSubmitConfirmationViaPlaywright`:**

```typescript
export type SubmitConfirmation = {
  submitted: boolean;                // confident that submission succeeded
  confidence: "high" | "medium" | "low";
  confirmationId: string | null;     // reference number if found
  confirmationMessage: string | null; // the success message text
  nextSteps: string | null;          // "You'll hear back..." type text
  redirectedTo: string | null;       // URL after redirect
  signals: string[];                 // all detected signals
  errors: string[];                  // validation errors if any
};

export async function extractSubmitConfirmationViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  preSubmitUrl: string;     // URL before clicking submit
}): Promise<SubmitConfirmation> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);

  const currentUrl = page.url();
  const result: SubmitConfirmation = {
    submitted: false,
    confidence: "low",
    confirmationId: null,
    confirmationMessage: null,
    nextSteps: null,
    redirectedTo: currentUrl !== opts.preSubmitUrl ? currentUrl : null,
    signals: [],
    errors: [],
  };

  const analysis = await page.evaluate((args: { preSubmitUrl: string }) => {
    const bodyText = document.body.innerText;
    const bodyLower = bodyText.toLowerCase();
    const title = document.title.toLowerCase();
    const signals: string[] = [];
    const errors: string[] = [];
    let confirmationMessage: string | null = null;
    let confirmationId: string | null = null;
    let nextSteps: string | null = null;

    // ----- SUCCESS SIGNALS -----

    const successPatterns = [
      { pattern: /application\s+(?:has\s+been\s+)?(?:received|submitted|sent)/i, weight: 3 },
      { pattern: /thank\s+you\s+for\s+(?:applying|your\s+application|your\s+interest)/i, weight: 3 },
      { pattern: /application\s+submitted\s+successfully/i, weight: 3 },
      { pattern: /we(?:'ve|\s+have)\s+received\s+your\s+application/i, weight: 3 },
      { pattern: /you(?:'ve|\s+have)\s+successfully\s+applied/i, weight: 3 },
      { pattern: /your\s+application\s+is\s+complete/i, weight: 3 },
      { pattern: /application\s+complete/i, weight: 2 },
      { pattern: /congratulations/i, weight: 1 },
      { pattern: /we\s+will\s+(?:review|get\s+back|be\s+in\s+touch)/i, weight: 1 },
      { pattern: /you(?:'ll|\s+will)\s+hear\s+(?:back|from\s+us)/i, weight: 1 },
      { pattern: /check\s+your\s+email/i, weight: 1 },
    ];

    let successScore = 0;
    for (const { pattern, weight } of successPatterns) {
      if (pattern.test(bodyText)) {
        signals.push(`success_text: "${bodyText.match(pattern)?.[0]}"`);
        successScore += weight;

        // Capture the full sentence as confirmation message
        const match = bodyText.match(new RegExp(`[^.!?]*${pattern.source}[^.!?]*[.!?]?`, "i"));
        if (match && (!confirmationMessage || match[0].length > confirmationMessage.length)) {
          confirmationMessage = match[0].trim().slice(0, 300);
        }
      }
    }

    // Title-based signals
    if (title.match(/thank|submitted|confirmation|success|applied/)) {
      signals.push(`title_signal: "${document.title}"`);
      successScore += 2;
    }

    // URL-based signals
    const url = window.location.href.toLowerCase();
    if (url.match(/thank|confirm|success|submitted|complete/)) {
      signals.push(`url_signal: "${url.slice(url.lastIndexOf("/"))}"`);
      successScore += 2;
    }

    // ----- CONFIRMATION ID -----

    const idPatterns = [
      /(?:confirmation|reference|application|tracking)\s*(?:#|number|id|code)[:\s]*([A-Z0-9-]{4,20})/i,
      /(?:#|number|id)[:\s]*([A-Z0-9-]{6,20})/i,
      /application\s+id[:\s]*(\d{4,})/i,
    ];
    for (const pattern of idPatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        confirmationId = match[1].trim();
        signals.push(`confirmation_id: "${confirmationId}"`);
        break;
      }
    }

    // ----- NEXT STEPS TEXT -----

    const nextStepsPatterns = [
      /we\s+will\s+(?:review|get\s+back|be\s+in\s+touch|contact)[^.]*\./i,
      /you(?:'ll|\s+will)\s+hear[^.]*\./i,
      /(?:next\s+steps|what\s+happens\s+next)[^.]*\./i,
      /check\s+your\s+email[^.]*\./i,
      /expect\s+(?:to\s+hear|a\s+response)[^.]*\./i,
    ];
    for (const pattern of nextStepsPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        nextSteps = match[0].trim().slice(0, 300);
        break;
      }
    }

    // ----- ERROR SIGNALS -----

    const errorPatterns = [
      /please\s+(?:fix|correct|review)\s+(?:the\s+)?(?:following|errors|highlighted)/i,
      /(?:required|mandatory)\s+field/i,
      /(?:invalid|incorrect)\s+(?:format|value|email|phone)/i,
      /please\s+(?:enter|fill|provide|select)/i,
      /this\s+field\s+is\s+required/i,
      /error\s*:/i,
    ];
    for (const pattern of errorPatterns) {
      if (pattern.test(bodyText)) {
        const match = bodyText.match(new RegExp(`[^.!?]*${pattern.source}[^.!?]*[.!?]?`, "i"));
        if (match) {
          errors.push(match[0].trim().slice(0, 200));
        }
      }
    }

    // Check for visible error elements
    const errorEls = document.querySelectorAll(
      '[class*="error"]:not([style*="display: none"]), ' +
      '[role="alert"], ' +
      '.field-error, .form-error, .validation-error'
    );
    for (const el of errorEls) {
      const text = (el.textContent || "").trim();
      if (text && text.length > 3 && text.length < 200) {
        errors.push(text);
      }
    }

    // Check if form is still present (if yes, submission probably failed)
    const formStillPresent = document.querySelector('form:not([style*="display: none"])') !== null;
    const submitStillPresent = Array.from(document.querySelectorAll("button")).some(b =>
      /submit\s+application|apply|submit/i.test(b.textContent || "")
    );

    if (formStillPresent && submitStillPresent && errors.length > 0) {
      signals.push("form_still_present_with_errors");
      successScore -= 5;
    }

    if (formStillPresent && submitStillPresent && errors.length === 0 && successScore === 0) {
      // Form is still there, no success signals, no errors — submission probably didn't happen
      signals.push("form_still_present_no_change");
      successScore -= 3;
    }

    return {
      successScore,
      confirmationMessage,
      confirmationId,
      nextSteps,
      signals,
      errors,
    };
  }, { preSubmitUrl: opts.preSubmitUrl });

  result.signals = analysis.signals;
  result.errors = analysis.errors;
  result.confirmationId = analysis.confirmationId;
  result.confirmationMessage = analysis.confirmationMessage;
  result.nextSteps = analysis.nextSteps;

  // Determine final submitted status
  if (analysis.successScore >= 3 && analysis.errors.length === 0) {
    result.submitted = true;
    result.confidence = analysis.successScore >= 5 ? "high" : "medium";
  } else if (result.redirectedTo && analysis.successScore >= 2) {
    result.submitted = true;
    result.confidence = "medium";
  } else if (analysis.errors.length > 0) {
    result.submitted = false;
    result.confidence = "high";  // confident it DIDN'T submit
  }

  return result;
}
```

#### File: `src/browser/routes/agent.snapshot.ts`

Add `/snapshot/submit-confirmation` route.

---

### Phase 2: open-agent — Confirmation Tool

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.check_submit_confirmation",
  label: "Check Application Submit Confirmation",
  description:
    "After clicking the submit button, call this to verify the application " +
    "was actually submitted. Checks for success messages, confirmation IDs, " +
    "redirect to thank-you page, and form validation errors. " +
    "Returns submitted (bool), confidence, confirmationId, and any errors. " +
    "ALWAYS call this after clicking submit — never assume success.",
  parameters: Type.Object({
    preSubmitUrl: Type.String({ description: "URL of the page before clicking submit" }),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.check_submit_confirmation", params as Record<string, unknown>),
},
```

---

### Phase 3: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Submit and confirmation protocol (CRITICAL)
1. **Before clicking submit**:
   - Note the current URL (for comparison after submit).
   - Take a final snapshot to verify all required fields are filled.
   - Look for any visible validation errors — fix them before submitting.
2. **Click submit**: Click the submit/apply button.
3. **Wait 3-5 seconds**: ATS may redirect, show spinner, or display a confirmation.
4. **Call `browser.check_submit_confirmation`** with the pre-submit URL:
   - `submitted: true` + `confidence: "high"` → Report success with confirmation details.
   - `submitted: true` + `confidence: "medium"` → Likely successful but verify manually.
   - `submitted: false` + `errors` present → Form validation failed. Fix errors and retry.
   - `submitted: false` + no errors → Submit may not have triggered. Try clicking submit again.
5. **Extract and report**:
   - `confirmationId` if available — save for tracking.
   - `confirmationMessage` — include in run result.
   - `nextSteps` — useful for user.
6. **Retry logic**:
   - If validation errors: fix the errored fields, then submit again (max 2 retries).
   - If no response at all: click submit again once.
   - After 2 failed retries, report failure with error details.

## NEVER report "application submitted" without calling check_submit_confirmation.
```

---

## Testing Strategy

1. **Greenhouse success**: Submit application, verify thank-you page detection with high confidence.
2. **Lever success**: Submit, verify same-page confirmation message extraction.
3. **Validation failure**: Submit with missing required field. Verify `submitted: false` + errors.
4. **Confirmation ID**: Submit on SmartRecruiters. Verify confirmation number extraction.
5. **No change**: Click submit but nothing happens (JS error). Verify `form_still_present_no_change` signal.
