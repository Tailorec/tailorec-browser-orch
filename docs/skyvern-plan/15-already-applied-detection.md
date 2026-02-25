# 15 — Already-Applied and Duplicate Detection

## Problem

When the agent navigates to a job application URL, it may encounter:

1. **"You have already applied"** — the user applied before (manually or via a previous agent run)
2. **"Application in progress"** — a draft exists, with a "Resume application" button
3. **"This position has been filled"** — job is no longer accepting applications
4. **"This posting has expired"** — listing removed
5. **"Application deadline has passed"**
6. **Login required before applying** — must create an account or sign in first

The agent currently has no detection for these states. It wastes time trying to fill a form that doesn't exist, or worse, submits a duplicate application.

---

## Implementation Plan

### Phase 1: openclaw-browser — Application State Detection

#### File: `src/browser/pw-tools-core.snapshot.ts`

Extend `detectPageIdentityViaPlaywright` to detect application-specific states:

```typescript
// Add to the page.evaluate block in detectPageIdentityViaPlaywright:

// Application state detection
let applicationState: string = "open";  // default: application is available
const bodyText = document.body.innerText.toLowerCase().slice(0, 3000);

const alreadyAppliedPatterns = [
  "you have already applied",
  "already submitted an application",
  "you've already applied",
  "application already submitted",
  "previously applied",
  "duplicate application",
];

const draftPatterns = [
  "application in progress",
  "resume your application",
  "continue your application",
  "saved application",
  "draft application",
  "incomplete application",
];

const closedPatterns = [
  "this position has been filled",
  "this posting has expired",
  "no longer accepting applications",
  "this job is no longer available",
  "position has been closed",
  "application deadline has passed",
  "this role has been filled",
  "job is closed",
  "applications are closed",
];

const loginRequiredPatterns = [
  "sign in to apply",
  "log in to apply",
  "create an account",
  "register to apply",
  "login required",
  "please sign in",
  "sign in or create",
];

let stateReason: string | null = null;

for (const pattern of alreadyAppliedPatterns) {
  if (bodyText.includes(pattern)) {
    applicationState = "already_applied";
    stateReason = pattern;
    break;
  }
}
if (applicationState === "open") {
  for (const pattern of draftPatterns) {
    if (bodyText.includes(pattern)) {
      applicationState = "draft_exists";
      stateReason = pattern;
      break;
    }
  }
}
if (applicationState === "open") {
  for (const pattern of closedPatterns) {
    if (bodyText.includes(pattern)) {
      applicationState = "closed";
      stateReason = pattern;
      break;
    }
  }
}
if (applicationState === "open") {
  for (const pattern of loginRequiredPatterns) {
    if (bodyText.includes(pattern)) {
      applicationState = "login_required";
      stateReason = pattern;
      break;
    }
  }
}

// Detect "Resume application" / "Continue" button for drafts
let resumeButtonRef: string | null = null;
if (applicationState === "draft_exists") {
  const resumeBtn = Array.from(document.querySelectorAll("button, a")).find(el => {
    const t = (el.textContent || "").toLowerCase();
    return /resume|continue|complete/i.test(t) && /application/i.test(t);
  });
  if (resumeBtn) {
    resumeButtonRef = resumeBtn.getAttribute("aria-ref") || null;
  }
}

// Add to return object:
// applicationState, stateReason, resumeButtonRef
```

Add to `PageIdentity` type:

```typescript
application: {
  state: "open" | "already_applied" | "draft_exists" | "closed" | "login_required";
  reason: string | null;
  resumeButtonRef: string | null;  // for draft_exists state
};
```

---

### Phase 2: open-agent — Early Exit on Non-Actionable States

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

In the `browser.page_identity` tool handler, add automatic event emission for non-actionable states:

```typescript
execute: async (_toolCallId, params) => {
  const raw = await executeWithRecovery("browser.page_identity", params as Record<string, unknown>);
  const appState = (raw as any).application?.state;

  if (appState === "already_applied") {
    await args.events.emit(args.ctx, "run_progress", {
      code: "application_already_submitted",
      level: "warning",
      reason: (raw as any).application?.reason,
      message: "This application has already been submitted. No action needed.",
    });
  } else if (appState === "closed") {
    await args.events.emit(args.ctx, "run_progress", {
      code: "job_posting_closed",
      level: "error",
      reason: (raw as any).application?.reason,
      message: "This job posting is closed or expired. Cannot apply.",
    });
  } else if (appState === "login_required") {
    await args.events.emit(args.ctx, "run_progress", {
      code: "login_required",
      level: "warning",
      reason: (raw as any).application?.reason,
      message: "Login/account creation required before applying. Escalating to user.",
    });
  } else if (appState === "draft_exists") {
    await args.events.emit(args.ctx, "run_progress", {
      code: "draft_application_found",
      level: "info",
      reason: (raw as any).application?.reason,
      resume_button_ref: (raw as any).application?.resumeButtonRef,
      message: "Found an existing draft application. Will resume it.",
    });
  }

  // ... rest of handler (ATS guidance, etc.)
  return toToolResult(raw);
},
```

---

### Phase 3: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Application state detection (first step)
ALWAYS call `browser.page_identity` first when landing on any job page. Check `application.state`:

| State | Action |
|---|---|
| `open` | Proceed with normal application flow |
| `already_applied` | Report "already applied" status. Do NOT re-apply. Complete the run as successful. |
| `draft_exists` | Click the "Resume application" button (ref provided), then continue from where the draft left off |
| `closed` | Report "job closed/expired" status. Complete the run as failed with reason. |
| `login_required` | Report "login required" status. Escalate to user. Cannot proceed without credentials. |

## Handling draft applications
- If `draft_exists`, click the resume button to continue.
- After resuming, take a snapshot to see which fields are already filled.
- Only fill empty fields — don't overwrite draft values unless they're clearly wrong.
- Some ATS preserve drafts for 30 days; the draft may have stale data.

## Handling "already applied"
- Report to the run as a successful completion with status "already_applied".
- Do NOT try to find another way to apply or re-submit.
- Extract confirmation if visible (confirmation number, date applied).

## Handling "login required"
- This is a hard blocker for automated flow.
- Report the login URL and method (email/password, SSO, LinkedIn).
- Some ATS (iCIMS, some Greenhouse employers) require account creation.
- Cannot be automated without stored credentials — escalate.
```

---

## Testing Strategy

1. **Already applied**: Navigate to a Greenhouse job where the user already applied. Verify detection.
2. **Expired job**: Navigate to a closed job listing. Verify `closed` state detected.
3. **Draft resume**: Start an application, fill some fields, navigate away. Return. Verify `draft_exists` with resume button ref.
4. **Login required**: Navigate to an iCIMS or gated application. Verify `login_required` detected.
5. **Open job**: Navigate to an active job listing. Verify `open` state.
