# 10 — Multi-Step Form Navigation

Alignment: inspired

## Problem

Most ATS job applications (Greenhouse, Lever, Workday, Taleo, iCIMS, SuccessFactors) use **multi-step form wizards**:

- Step 1: Personal Information
- Step 2: Work Experience
- Step 3: Education
- Step 4: Additional Questions / Screening
- Step 5: Resume / Cover Letter Upload
- Step 6: Review & Submit

Your current agent handles this implicitly (the LLM figures out to click "Next"), but lacks:

1. **Step tracking** — no structured awareness of current position in the wizard
2. **Back-navigation** — no strategy for going back to fix errors on previous steps
3. **Per-step validation** — no check that all required fields on current step are filled before navigating forward
4. **Step regression detection** — clicking "Next" might loop back to the same step if validation fails
5. **Review page handling** — the final review page often shows a summary; agent doesn't verify it
6. **Progress persistence** — if the agent crashes/timeouts mid-wizard, no checkpoint to resume from

### How Skyvern Handles Multi-Step

Skyvern's `ForgeAgent.execute_step()` loop (agent.py) runs multiple steps with:
- Full page re-scrape at each step
- Action history accumulated across steps
- The prompt includes: *"Consider the action history from the last step"*
- Step count limits (`max_steps_per_run`)
- Each step produces a detailed output with screenshots

However, Skyvern doesn't have explicit wizard-tracking either — it relies on the LLM's contextual understanding. Your skill file already mentions multi-step checkpointing, but the **tooling** doesn't support it.

---

## Implementation Plan

### Phase 1: openclaw-browser — Page Identity Detection

#### File: `src/browser/pw-tools-core.snapshot.ts`

**Add `detectPageIdentityViaPlaywright` function:**

```typescript
export type PageIdentity = {
  url: string;
  title: string;
  // Step detection heuristics
  stepIndicator: {
    detected: boolean;
    currentStep: number | null;
    totalSteps: number | null;
    stepLabel: string | null;     // e.g., "Personal Information"
    rawText: string | null;       // e.g., "Step 2 of 5"
  };
  // Navigation controls
  navigation: {
    hasNext: boolean;
    nextRef: string | null;
    nextText: string | null;
    hasPrevious: boolean;
    previousRef: string | null;
    previousText: string | null;
    hasSubmit: boolean;
    submitRef: string | null;
    submitText: string | null;
    hasSave: boolean;
    saveRef: string | null;
  };
  // Page type detection
  pageType: "form" | "review" | "confirmation" | "error" | "login" | "unknown";
  // Required field count
  requiredFieldCount: number;
  filledFieldCount: number;
  emptyRequiredCount: number;
};

export async function detectPageIdentityViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
}): Promise<PageIdentity> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);

  const identity = await page.evaluate(() => {
    const body = document.body;
    const text = body.innerText || "";

    // Step indicator detection
    const stepPatterns = [
      /step\s+(\d+)\s+(?:of|\/)\s+(\d+)/i,
      /(\d+)\s+(?:of|\/)\s+(\d+)\s+(?:step|page)/i,
      /progress.*?(\d+).*?(\d+)/i,
    ];
    let currentStep: number | null = null;
    let totalSteps: number | null = null;
    let stepRawText: string | null = null;

    for (const pattern of stepPatterns) {
      const match = text.match(pattern);
      if (match) {
        currentStep = parseInt(match[1]);
        totalSteps = parseInt(match[2]);
        stepRawText = match[0];
        break;
      }
    }

    // Also check progress bar elements
    if (!currentStep) {
      const progressBars = document.querySelectorAll(
        '[role="progressbar"], .progress-bar, .step-indicator, .wizard-step'
      );
      for (const bar of progressBars) {
        const ariaValue = bar.getAttribute("aria-valuenow");
        const ariaMax = bar.getAttribute("aria-valuemax");
        if (ariaValue && ariaMax) {
          currentStep = parseInt(ariaValue);
          totalSteps = parseInt(ariaMax);
          break;
        }
      }
    }

    // Active step in step list (li.active, .step.active, etc.)
    let stepLabel: string | null = null;
    const activeSteps = document.querySelectorAll(
      '.active[class*="step"], [aria-current="step"], .step.current, .wizard-step.active'
    );
    if (activeSteps.length > 0) {
      stepLabel = (activeSteps[0].textContent || "").trim().slice(0, 100);
    }

    // Navigation control detection
    const findButton = (patterns: RegExp[]): { ref: string | null; text: string | null } => {
      const buttons = document.querySelectorAll(
        'button, input[type="submit"], a[role="button"], [role="button"]'
      );
      for (const btn of buttons) {
        const btnText = (btn.textContent || "").trim().toLowerCase();
        const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
        const haystack = `${btnText} ${ariaLabel}`;
        for (const pattern of patterns) {
          if (pattern.test(haystack)) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return {
                ref: btn.getAttribute("aria-ref") || null,
                text: (btn.textContent || "").trim().slice(0, 50),
              };
            }
          }
        }
      }
      return { ref: null, text: null };
    };

    const next = findButton([/\bnext\b/, /\bcontinue\b/, /\bproceed\b/, /\bforward\b/]);
    const prev = findButton([/\bprevious\b/, /\bback\b/, /\bgo back\b/]);
    const submit = findButton([/\bsubmit\b/, /\bapply\b/, /\bcomplete\b/, /\bfinish\b/]);
    const save = findButton([/\bsave\b/, /\bsave draft\b/, /\bsave progress\b/]);

    // Page type detection
    const successPatterns = /thank you|application submitted|successfully|confirmation/i;
    const errorPatterns = /error|something went wrong|please try again/i;
    const loginPatterns = /sign in|log in|create account|password/i;
    const reviewPatterns = /review|summary|confirm your|verify your/i;

    let pageType: string = "unknown";
    if (successPatterns.test(text.slice(0, 500))) pageType = "confirmation";
    else if (errorPatterns.test(text.slice(0, 500))) pageType = "error";
    else if (loginPatterns.test(text.slice(0, 500))) pageType = "login";
    else if (reviewPatterns.test(text.slice(0, 500))) pageType = "review";
    else {
      // Check if page has form elements
      const inputs = document.querySelectorAll(
        'input:not([type="hidden"]), select, textarea, [contenteditable]'
      );
      const visibleInputs = Array.from(inputs).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (visibleInputs.length > 0) pageType = "form";
    }

    // Required field counts
    const allInputs = document.querySelectorAll(
      'input:not([type="hidden"]), select, textarea'
    );
    let requiredCount = 0;
    let filledCount = 0;
    let emptyRequiredCount = 0;
    for (const input of allInputs) {
      const rect = input.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const el = input as HTMLInputElement;
      const isRequired =
        el.required ||
        input.hasAttribute("required") ||
        input.getAttribute("aria-required") === "true";
      const hasValue = (el.value || "").trim().length > 0;
      if (isRequired) {
        requiredCount++;
        if (hasValue) filledCount++;
        else emptyRequiredCount++;
      }
    }

    return {
      url: window.location.href,
      title: document.title,
      stepIndicator: {
        detected: currentStep !== null,
        currentStep,
        totalSteps,
        stepLabel,
        rawText: stepRawText,
      },
      navigation: {
        hasNext: next.ref !== null || next.text !== null,
        nextRef: next.ref,
        nextText: next.text,
        hasPrevious: prev.ref !== null || prev.text !== null,
        previousRef: prev.ref,
        previousText: prev.text,
        hasSubmit: submit.ref !== null || submit.text !== null,
        submitRef: submit.ref,
        submitText: submit.text,
        hasSave: save.ref !== null || save.text !== null,
        saveRef: save.ref,
      },
      pageType,
      requiredFieldCount: requiredCount,
      filledFieldCount: filledCount,
      emptyRequiredCount,
    };
  });

  return identity as PageIdentity;
}
```

#### File: `src/browser/routes/agent.snapshot.ts`

**Add `/snapshot/page-identity` route:**

```typescript
router.post("/snapshot/page-identity", async (req, res) => {
  const result = await pw.detectPageIdentityViaPlaywright({
    cdpUrl,
    targetId: tab.targetId,
  });
  return res.json({ ok: true, ...result });
});
```

---

### Phase 2: open-agent — Page Identity Tool

#### File: `../open-agent/src/tools/browser-adapter.ts`

```typescript
async detectPageIdentity(): Promise<JsonRecord> {
  return this.post("/snapshot/page-identity", {
    timeoutMs: this.config.browserTimeoutMs,
  });
}
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.page_identity",
  label: "Detect Page Identity",
  description:
    "Analyze current page to detect: form wizard step position (Step 2 of 5), " +
    "navigation controls (Next/Back/Submit buttons with their refs), " +
    "page type (form/review/confirmation/error/login), and required field " +
    "completion status. Use after navigation to understand where you are " +
    "in a multi-step application.",
  parameters: Type.Object({}),
  execute: async (_toolCallId, params) =>
    execute("browser.page_identity", params as Record<string, unknown>),
},
```

#### File: `../open-agent/src/tools/browser-executor.ts`

```typescript
case "browser.page_identity":
  result = await this.adapter.detectPageIdentity();
  await this.emitBrowserEvent("page_identity", {
    page_type: (result as any).pageType ?? "unknown",
    step: (result as any).stepIndicator?.currentStep ?? null,
    total_steps: (result as any).stepIndicator?.totalSteps ?? null,
    empty_required: (result as any).emptyRequiredCount ?? 0,
  });
  break;
```

---

### Phase 3: open-agent — Step Progress Tracking

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

**Add step checkpoint runtime tool:**

```typescript
{
  name: "runtime.checkpoint_step",
  label: "Save Step Checkpoint",
  description:
    "Record progress on the current wizard step. Call after completing each step " +
    "in a multi-step application. Helps track progress and enables resumption.",
  parameters: Type.Object({
    stepNumber: Type.Number(),
    stepName: Type.Optional(Type.String()),
    totalSteps: Type.Optional(Type.Number()),
    fieldsCompleted: Type.Array(Type.String()),
    requiredFieldsRemaining: Type.Array(Type.String()),
    validationErrors: Type.Array(Type.String()),
    pageUrl: Type.String(),
  }),
  execute: async (_toolCallId, params) => {
    const p = params as Record<string, unknown>;

    // Persist checkpoint
    await repo.appendTranscriptMessage({
      runId: ctx.runId,
      tenantId: req.run.tenant_id,
      sessionId: req.run.session_id,
      role: "system",
      content: {
        text: `Step ${p.stepNumber} checkpoint: ${p.stepName ?? "unnamed"}`,
        checkpoint: {
          step: p.stepNumber,
          name: p.stepName,
          totalSteps: p.totalSteps,
          fieldsCompleted: p.fieldsCompleted,
          requiredRemaining: p.requiredFieldsRemaining,
          errors: p.validationErrors,
          url: p.pageUrl,
          timestamp: new Date().toISOString(),
        },
      },
    });

    await events.emit(ctx, "run_progress", {
      code: "step_checkpoint",
      level: "info",
      step: p.stepNumber,
      total_steps: p.totalSteps ?? null,
      step_name: p.stepName ?? null,
      fields_completed: Array.isArray(p.fieldsCompleted) ? (p.fieldsCompleted as string[]).length : 0,
      required_remaining: Array.isArray(p.requiredFieldsRemaining)
        ? (p.requiredFieldsRemaining as string[]).length
        : 0,
      has_errors: Array.isArray(p.validationErrors) && (p.validationErrors as string[]).length > 0,
    });

    const remaining = Array.isArray(p.requiredFieldsRemaining) ? p.requiredFieldsRemaining as string[] : [];
    const errors = Array.isArray(p.validationErrors) ? p.validationErrors as string[] : [];

    return toToolResult({
      ok: true,
      checkpoint_saved: true,
      ready_to_proceed: remaining.length === 0 && errors.length === 0,
      blockers: [
        ...remaining.map((f: string) => `Required field not filled: ${f}`),
        ...errors.map((e: string) => `Validation error: ${e}`),
      ],
    });
  },
},
```

---

### Phase 4: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

Add detailed multi-step section:

```markdown
## Multi-step wizard execution

### Step loop protocol
For each step in the wizard:
1. Call `browser.page_identity` to detect step position and navigation controls.
2. Call `browser.snapshot` to discover fields on current step.
3. Fill all required and known-value fields.
4. Call `runtime.checkpoint_step` to record progress.
5. Verify checkpoint shows `ready_to_proceed: true`.
6. If not ready: fix remaining fields or errors.
7. Click the Next/Continue button using its ref from page_identity.
8. After navigation, call `browser.page_identity` again to confirm step advanced.

### Step regression detection
- If `page_identity.stepIndicator.currentStep` is the same after clicking Next:
  - The form validation blocked navigation.
  - Take a snapshot to find error messages.
  - Fix errors, then retry Next.
- If step went BACKWARD (e.g., from step 3 to step 2):
  - A validation check on a previous step failed.
  - Fix the error on the current (earlier) step, then proceed forward again.

### Review page handling
- If `page_identity.pageType === "review"`:
  - This is the final review before submission.
  - Take a snapshot to verify all sections are complete.
  - Look for edit/change buttons to fix any incorrect values.
  - Proceed to `runtime.request_approval`.

### Confirmation page handling
- If `page_identity.pageType === "confirmation"`:
  - The application was submitted (possibly by the user during review).
  - Report success and complete the run.

### Error page handling
- If `page_identity.pageType === "error"`:
  - Something went wrong (session timeout, server error).
  - Take a screenshot for debugging.
  - Report failure.

### Login wall handling
- If `page_identity.pageType === "login"`:
  - The application requires authentication.
  - Escalate to user — cannot proceed without credentials.
```

---

## Testing Strategy

1. **Step detection**: Test on Greenhouse, Lever, and SmartRecruiters test applications. Verify step numbers detected.
2. **Navigation refs**: Verify Next/Back/Submit button refs are correctly identified.
3. **Step regression**: Simulate clicking Next with empty required fields. Verify same step detected.
4. **Review page**: Navigate to a review page. Verify `pageType === "review"`.
5. **Confirmation page**: Submit a test application. Verify `pageType === "confirmation"`.
6. **Checkpoint persistence**: Verify checkpoints are stored in run transcript.

## Skyvern Reference

- `skyvern/forge/agent.py` → `execute_step()` loop with step counting and max_steps
- `skyvern/forge/prompts/skyvern/extract-action.j2` → `user_goal_stage` and `user_goal_achieved` reasoning
- `skyvern/webeye/actions/actions.py` → `CompleteVerifyResult` — goal completion verification
- `skyvern/forge/agent.py` → action history accumulation across steps
