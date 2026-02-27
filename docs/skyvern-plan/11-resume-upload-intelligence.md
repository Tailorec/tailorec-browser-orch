# 11 — Resume Upload Intelligence

Alignment: inspired

## Problem

Resume upload is the **#1 failure point** in automated job applications. It fails differently on every ATS.

### Failure Modes

1. **Hidden file input**: Lever/Ashby use a custom drag-and-drop zone; the `<input type="file">` is `display:none`. `browser.upload` targeting the visible button doesn't trigger the file chooser.
2. **Upload verification gap**: After uploading, no way to confirm it worked. Agent moves on, but resume wasn't actually attached.
3. **Resume parse pre-fill conflict**: Greenhouse parses the resume and fills fields. Agent then overwrites parsed values with profile values, creating mismatches.
4. **File format rejection**: ATS silently rejects non-PDF or files >5MB. No error in a11y tree — only a visual red border or toast notification.
5. **Multiple upload slots**: Resume vs Cover Letter vs Portfolio — agent fills the wrong slot.
6. **Custom upload widgets**: Some use "Import from LinkedIn", "Paste Dropbox link", or "Google Drive" options.

---

## Implementation Plan

### Phase 1: openclaw-browser — Upload Widget Detection

#### File: `src/browser/pw-tools-core.interactions.ts`

**Add `detectUploadWidgetViaPlaywright`:**

```typescript
export type UploadWidgetInfo = {
  ref: string;
  widgetType:
    | "native_file_input"      // standard <input type="file">
    | "hidden_file_input"      // <input type="file" hidden> behind a button/div
    | "dropzone"               // drag-and-drop zone (Lever-style)
    | "button_trigger"         // button that opens file chooser
    | "link_paste"             // text input for pasting URL
    | "unknown";
  hiddenInputRef: string | null;       // ref of hidden <input type="file"> if detected
  triggerRef: string | null;           // ref of the clickable trigger element
  accept: string | null;              // accepted file types
  maxSizeHint: string | null;         // "5MB" if detected from nearby text
  currentFileName: string | null;     // if a file is already uploaded
  fieldRole: "resume" | "cover_letter" | "portfolio" | "other";
  instructions: string;               // human-readable "click this ref, then use browser.upload"
};

export async function detectUploadWidgetViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
}): Promise<UploadWidgetInfo> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });

  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);

  return await locator.evaluate((el: Element) => {
    const result: any = {
      ref: el.getAttribute("aria-ref") || "",
      widgetType: "unknown",
      hiddenInputRef: null,
      triggerRef: null,
      accept: null,
      maxSizeHint: null,
      currentFileName: null,
      fieldRole: "other",
      instructions: "",
    };

    // Check if this IS a file input
    if (el.tagName === "INPUT" && (el as HTMLInputElement).type === "file") {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || (el as HTMLElement).offsetWidth === 0) {
        result.widgetType = "hidden_file_input";
        result.hiddenInputRef = el.getAttribute("aria-ref");
        // Look for the clickable trigger
        const parent = el.parentElement;
        if (parent) {
          const trigger = parent.querySelector("button, a, [role='button'], label, div[class*='upload'], div[class*='drop']");
          if (trigger) {
            result.triggerRef = trigger.getAttribute("aria-ref");
            result.instructions = `Click the trigger element (ref=${result.triggerRef}), then use browser.upload`;
          }
        }
      } else {
        result.widgetType = "native_file_input";
        result.instructions = "Use browser.upload directly with this ref";
      }
      result.accept = (el as HTMLInputElement).accept || null;
    }
    // Check if this is a drop zone
    else if (
      el.className?.toString?.().match(/drop[-_]?zone|file[-_]?upload|upload[-_]?area|drag[-_]?drop/i) ||
      el.getAttribute("role") === "button" && (el.textContent || "").match(/upload|attach|drag|drop/i)
    ) {
      result.widgetType = "dropzone";
      // Find hidden file input in or near the drop zone
      const hidden = el.querySelector('input[type="file"]') ||
                     el.parentElement?.querySelector('input[type="file"]');
      if (hidden) {
        result.hiddenInputRef = hidden.getAttribute("aria-ref");
      }
      result.triggerRef = el.getAttribute("aria-ref");
      result.instructions = hidden
        ? `Click this element to trigger file chooser, then use browser.upload`
        : `Click this element. If file chooser doesn't open, look for a hidden file input nearby.`;
    }
    // Check if this is a button that triggers upload
    else if (
      (el.tagName === "BUTTON" || el.getAttribute("role") === "button") &&
      (el.textContent || "").match(/upload|attach|browse|choose file/i)
    ) {
      result.widgetType = "button_trigger";
      result.triggerRef = el.getAttribute("aria-ref");
      const hidden = el.parentElement?.querySelector('input[type="file"]') ||
                     document.querySelector('input[type="file"][style*="display: none"], input[type="file"][hidden]');
      if (hidden) {
        result.hiddenInputRef = hidden.getAttribute("aria-ref");
      }
      result.instructions = "Click this button to open file chooser, then use browser.upload";
    }

    // Detect field role from labels and nearby text
    const context = (el.textContent || "") + " " +
                    (el.getAttribute("aria-label") || "") + " " +
                    (el.parentElement?.textContent || "").slice(0, 200);
    const ctxLower = context.toLowerCase();
    if (ctxLower.match(/resume|cv\b/)) result.fieldRole = "resume";
    else if (ctxLower.match(/cover\s*letter/)) result.fieldRole = "cover_letter";
    else if (ctxLower.match(/portfolio|work\s*sample/)) result.fieldRole = "portfolio";

    // Detect max file size hints
    const sizeMatch = context.match(/(\d+)\s*(?:MB|mb|megabyte)/);
    if (sizeMatch) result.maxSizeHint = sizeMatch[0];

    // Detect already-uploaded filename
    const fileNameEl = el.parentElement?.querySelector(".file-name, .filename, [class*='file-name'], [class*='uploaded']");
    if (fileNameEl) {
      result.currentFileName = (fileNameEl.textContent || "").trim().slice(0, 100);
    }

    return result;
  }) as UploadWidgetInfo;
}
```

#### File: `src/browser/routes/agent.act.ts`

Add `detect_upload_widget` action kind.

---

### Phase 2: openclaw-browser — Upload Verification

#### File: `src/browser/pw-tools-core.interactions.ts`

**Add `verifyUploadViaPlaywright`:**

```typescript
export type UploadVerification = {
  uploaded: boolean;
  fileName: string | null;
  fileSize: string | null;
  indicators: string[];        // what signals were found
  errorMessage: string | null;  // validation error if any
};

export async function verifyUploadViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;                 // ref of the upload widget area
  expectedFileName?: string;   // optional: expected file name to match
}): Promise<UploadVerification> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);

  // Search the area around the upload widget for indicators
  const result = await page.evaluate((args: { expectedFileName?: string }) => {
    const indicators: string[] = [];
    let fileName: string | null = null;
    let fileSize: string | null = null;
    let errorMessage: string | null = null;

    // Look for file name display elements
    const fileNameSelectors = [
      ".file-name", ".filename", "[class*='file-name']", "[class*='uploaded-file']",
      "[class*='attachment']", ".resume-name", "[class*='resume']",
    ];
    for (const sel of fileNameSelectors) {
      const el = document.querySelector(sel);
      if (el && (el.textContent || "").trim()) {
        fileName = (el.textContent || "").trim().slice(0, 100);
        indicators.push(`found_filename_element: ${sel}`);
        break;
      }
    }

    // Look for success indicators
    const bodyText = document.body.innerText.toLowerCase();
    const successPatterns = [
      "file uploaded", "resume uploaded", "upload successful",
      "attached", "uploaded successfully", ".pdf", ".docx",
    ];
    for (const pattern of successPatterns) {
      if (bodyText.includes(pattern)) {
        indicators.push(`success_text: "${pattern}"`);
      }
    }

    // Look for error indicators
    const errorPatterns = [
      "upload failed", "file too large", "invalid file", "unsupported format",
      "please upload", "resume is required", "file required",
    ];
    for (const pattern of errorPatterns) {
      if (bodyText.includes(pattern)) {
        errorMessage = pattern;
        indicators.push(`error_text: "${pattern}"`);
      }
    }

    // Look for remove/delete button (indicates file IS attached)
    const removeBtn = document.querySelector(
      'button[aria-label*="remove" i], button[aria-label*="delete" i], ' +
      '[class*="remove-file"], [class*="delete-file"], button[class*="remove"]'
    );
    if (removeBtn) {
      indicators.push("remove_button_present");
    }

    // Check for file size display
    const sizeMatch = document.body.innerText.match(/(\d+\.?\d*)\s*(KB|MB|bytes)/i);
    if (sizeMatch) {
      fileSize = sizeMatch[0];
      indicators.push(`file_size_displayed: ${fileSize}`);
    }

    const uploaded = (
      indicators.some(i => i.startsWith("found_filename") || i.startsWith("success_text") || i === "remove_button_present")
      && !errorMessage
    );

    return { uploaded, fileName, fileSize, indicators, errorMessage };
  }, { expectedFileName: opts.expectedFileName });

  return result as UploadVerification;
}
```

#### File: `src/browser/routes/agent.act.ts`

Add `verify_upload` action kind.

---

### Phase 3: open-agent — Upload Intelligence Tools

#### File: `../open-agent/src/tools/browser-adapter.ts`

```typescript
async detectUploadWidget(ref: string): Promise<JsonRecord> {
  return this.post("/act", { kind: "detect_upload_widget", ref, timeoutMs: this.config.browserTimeoutMs });
}

async verifyUpload(ref: string, expectedFileName?: string): Promise<JsonRecord> {
  return this.post("/act", { kind: "verify_upload", ref, expectedFileName, timeoutMs: this.config.browserTimeoutMs });
}
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.detect_upload_widget",
  label: "Detect Upload Widget Type",
  description:
    "Analyze an upload element to determine its type (native file input, hidden input, " +
    "dropzone, button trigger) and get instructions for how to upload. Also detects " +
    "whether it's for resume, cover letter, or portfolio. Use before browser.upload " +
    "to understand the upload mechanism.",
  parameters: Type.Object({
    ref: Type.String({ description: "Ref of the upload element or area" }),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.detect_upload_widget", params as Record<string, unknown>),
},
{
  name: "browser.verify_upload",
  label: "Verify File Upload Success",
  description:
    "Check if a file was successfully uploaded by looking for filename display, " +
    "success messages, remove buttons, and error messages. Call after browser.upload " +
    "to confirm the upload worked.",
  parameters: Type.Object({
    ref: Type.String({ description: "Ref of the upload widget area" }),
    expectedFileName: Type.Optional(Type.String({ description: "Expected filename to match" })),
  }),
  execute: async (_toolCallId, params) =>
    execute("browser.verify_upload", params as Record<string, unknown>),
},
```

---

### Phase 4: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Resume upload protocol
1. **Detect widget type**: Call `browser.detect_upload_widget` on the upload element.
2. **Follow instructions**: The response tells you exactly how to upload:
   - `native_file_input` → `browser.upload` directly with the ref
   - `hidden_file_input` → Click the `triggerRef`, then `browser.upload` with `hiddenInputRef`
   - `dropzone` → Click the dropzone ref, then `browser.upload`
   - `button_trigger` → Click the button, then `browser.upload`
3. **Verify upload**: Call `browser.verify_upload` with the upload area ref.
   - If `uploaded: true` → proceed
   - If `uploaded: false` → retry once, then escalate
4. **Wait for resume parsing**: After upload, wait 3-5 seconds, then snapshot.
5. **Check pre-filled fields**: Compare parsed values with profile data. Only overwrite incorrect values.

## Upload order strategy
- Upload resume BEFORE filling text fields (so resume parse pre-fill works)
- Upload cover letter AFTER resume
- Use `fieldRole` from detect_upload_widget to distinguish resume vs cover letter slots

## File format rules
- Default: PDF (universally accepted)
- If `accept` attribute shows specific types, match them
- If upload fails, check `maxSizeHint` — file may be too large
```

---

## Testing Strategy

1. **Greenhouse**: Upload resume via standard file input. Verify parsing pre-fills name/email.
2. **Lever**: Upload via hidden file input behind drag-drop zone. Verify filename appears.
3. **Ashby**: Upload via custom React button. Verify remove button appears.
4. **Large file**: Upload 10MB PDF. Verify error detection.
5. **Wrong format**: Upload .txt file to .pdf-only field. Verify rejection detection.
