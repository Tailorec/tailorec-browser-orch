# 07 — Screenshot Vision Tool

## Problem

Your agent perceives the page **only via accessibility tree text**. This misses visual cues:

1. **Red error borders** on invalid fields (CSS-only, no aria-invalid)
2. **Highlighted required fields** (asterisks or colored labels with no `required` attr)
3. **CAPTCHA images** — entirely visual, no a11y tree representation
4. **Progress indicators** — "Step 2 of 4" banners that are visual-only
5. **Form layout context** — which fields are grouped together, section headers
6. **Popup/modal positioning** — where overlays are relative to form fields
7. **File upload previews** — visual confirmation that upload succeeded
8. **Custom styled checkboxes** — visually checked but CSS-only (no `checked` attr)

### How Skyvern Solves This

Skyvern sends **both** the DOM element tree AND screenshots to the LLM in every step:

```python
# scraper.py:scrape_web_unsafe():
screenshots = await SkyvernFrame.take_split_screenshots(
    page=page, url=url,
    draw_boxes=draw_boxes,          # Draws bounding boxes with element IDs
    max_number=max_screenshot_number,
    scroll=scroll,                   # Takes screenshots at each scroll position
)
```

The prompt tells the LLM:
> *"If you see any information in red in the page screenshot, this means a condition wasn't satisfied. Prioritize actions with the red information."*

Your stack already has `POST /screenshot` and `POST /screenshot/labeled` endpoints — they just aren't wired into the agent tools.

---

## Implementation Plan

### Phase 1: openclaw-browser — Existing Endpoints Audit

Your endpoints already exist and are functional:

#### File: `src/browser/routes/agent.ts` (existing)

- `POST /screenshot` — returns base64 PNG/JPEG
- `POST /screenshot/labeled` — returns screenshot with ref labels overlaid

These are adequate. No changes needed to openclaw-browser.

---

### Phase 2: open-agent — Wire Screenshot as Agent Tool

#### File: `../open-agent/src/tools/browser-adapter.ts`

**Add screenshot methods:**

```typescript
async screenshot(opts?: { fullPage?: boolean; ref?: string }): Promise<JsonRecord> {
  return this.post("/screenshot", {
    type: "jpeg",          // JPEG is smaller for LLM consumption
    quality: 60,           // Reduce quality to save tokens
    fullPage: opts?.fullPage ?? false,
    ref: opts?.ref,
    timeoutMs: this.config.browserTimeoutMs,
  });
}

async screenshotLabeled(opts?: { maxLabels?: number }): Promise<JsonRecord> {
  return this.post("/screenshot/labeled", {
    type: "jpeg",
    quality: 60,
    maxLabels: opts?.maxLabels ?? 80,
    timeoutMs: this.config.browserTimeoutMs,
  });
}
```

#### File: `../open-agent/src/tools/browser-executor.ts`

```typescript
case "browser.screenshot":
  result = await this.adapter.screenshot({
    fullPage: args.fullPage as boolean | undefined,
    ref: args.ref as string | undefined,
  });
  await this.emitBrowserEvent("screenshot", {
    has_image: Boolean((result as any).imageBase64),
  });
  break;

case "browser.screenshot.labeled":
  result = await this.adapter.screenshotLabeled({
    maxLabels: args.maxLabels as number | undefined,
  });
  await this.emitBrowserEvent("screenshot_labeled", {
    labels: (result as any).labels ?? 0,
  });
  break;
```

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createBrowserTools`:

```typescript
{
  name: "browser.screenshot",
  label: "Take Screenshot",
  description:
    "Capture a screenshot of the current page or a specific element. " +
    "Use when you need to visually verify form state, check for visual " +
    "error indicators (red borders, highlighted fields), confirm file " +
    "upload previews, or debug unexpected behavior. " +
    "Returns a JPEG image. Use sparingly — costs tokens.",
  parameters: Type.Object({
    fullPage: Type.Optional(Type.Boolean({ description: "Capture full page (scroll)" })),
    ref: Type.Optional(Type.String({ description: "Capture only this element" })),
  }),
  execute: async (_toolCallId, params) => {
    const raw = await executeWithRecovery("browser.screenshot", params as Record<string, unknown>);
    const record = raw as Record<string, unknown>;
    const base64 = typeof record.imageBase64 === "string" ? record.imageBase64 : "";
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : "image/jpeg";

    if (!base64) {
      return toToolResult({ ok: false, error: "Screenshot capture failed" });
    }

    // Return as image content for vision-capable models
    return {
      content: [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType,
            data: base64,
          },
        },
        {
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            url: record.url ?? null,
            note: "Screenshot of current page state. Look for: red error borders, visual validation errors, required field indicators, form completion progress.",
          }),
        },
      ],
      details: {},
    };
  },
},
{
  name: "browser.screenshot.labeled",
  label: "Take Labeled Screenshot",
  description:
    "Capture a screenshot with ref labels overlaid on interactive elements. " +
    "Useful for debugging which ref corresponds to which visual element. " +
    "Use when the text snapshot is ambiguous about element identity.",
  parameters: Type.Object({
    maxLabels: Type.Optional(Type.Number({ description: "Max labels to render (default 80)" })),
  }),
  execute: async (_toolCallId, params) => {
    const raw = await executeWithRecovery("browser.screenshot.labeled", params as Record<string, unknown>);
    const record = raw as Record<string, unknown>;
    const base64 = typeof record.imageBase64 === "string" ? record.imageBase64 : "";
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : "image/jpeg";

    if (!base64) {
      return toToolResult({ ok: false, error: "Labeled screenshot capture failed" });
    }

    return {
      content: [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType,
            data: base64,
          },
        },
        {
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            url: record.url ?? null,
            labels: record.labels ?? 0,
            note: "Screenshot with ref labels. Each label shows the ref ID (e.g., e12) next to its element.",
          }),
        },
      ],
      details: {},
    };
  },
},
```

#### File: `../open-agent/src/tools/browser-tools.ts`

Add `"browser.screenshot"` and `"browser.screenshot.labeled"` to tool names.

---

### Phase 3: open-agent — Model Compatibility Gate

Not all models support vision. Gate screenshot tools based on model capabilities.

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

In `createBrowserTools`, conditionally include screenshot tools:

```typescript
function createBrowserTools(args: {
  executor: BrowserToolExecutor;
  events: RuntimeEventPublisher;
  ctx: RunExecutionContext;
  supportsVision?: boolean;       // NEW param
}): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    // ...existing tools (navigate, snapshot, click, fill, upload, submit)...
  ];

  // Only add screenshot tools for vision-capable models
  if (args.supportsVision !== false) {
    tools.push(screenshotTool);
    tools.push(labeledScreenshotTool);
  }

  return tools;
}
```

In `runWithPiAgent`, detect vision capability:

```typescript
const supportsVision =
  model.provider === "google" ||             // Gemini models support vision
  model.provider === "openai" ||             // GPT-4o/4.1 support vision
  model.provider === "anthropic" ||          // Claude supports vision
  requestedModel.includes("vision") ||
  requestedModel.includes("4o") ||
  requestedModel.includes("gemini");

// Pass to tool creation:
...createBrowserTools({
  executor: browser,
  events,
  ctx,
  supportsVision,
}),
```

---

### Phase 4: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Visual verification (screenshots)
- Use `browser.screenshot` sparingly for:
  - Confirming form state before requesting approval
  - Debugging when text snapshot is ambiguous
  - Checking for visual-only error indicators (red borders, icons)
  - Verifying file upload previews
  - Identifying CAPTCHAs (escalate to user)
- Do NOT use screenshots on every step — they cost significant tokens.
- Recommended: one screenshot before approval request, and one after any confusing failure.
- When reviewing a screenshot:
  - Look for red borders, asterisks, or error icons near form fields
  - Check if progress indicator shows which step you're on
  - Verify that selected dropdown values are actually displayed
  - Confirm file upload shows a filename/preview
```

---

## Token Cost Considerations

| Action | Approx token cost (Gemini/GPT-4o) |
|---|---|
| Full page screenshot (1280x720 JPEG q60) | ~800-1200 tokens |
| Element screenshot (200x40 JPEG q60) | ~100-200 tokens |
| Labeled screenshot (1280x720) | ~1200-1600 tokens |
| Full text snapshot | ~8000-20000 tokens |

Screenshots are **cheaper than full text snapshots** for visual confirmation, but more expensive for detailed form field discovery. Use text snapshots for discovery, screenshots for verification.

## Skyvern Reference

- `skyvern/webeye/scraper/scraper.py` → `SkyvernFrame.take_split_screenshots()` — multi-viewport screenshots with bounding boxes
- `skyvern/forge/prompts/skyvern/extract-action.j2` — prompt referencing red/error visual cues
- `skyvern/forge/agent.py` → screenshots stored as artifacts, sent alongside DOM tree to LLM
