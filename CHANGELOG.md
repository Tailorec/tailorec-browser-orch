# Changelog

All notable changes to `openclaw-browser` are documented here.

> This is a consolidated changelog created from the worktree plan branches and merged implementation commits.

## [2026-02-26] Skyvern-Inspired Plan Implementations

### ✅ Plan 01 — Custom Dropdown Engine
**Implemented in:** `src/browser/pw-tools-core.dom-observer.ts`, `src/browser/pw-tools-core.interactions.ts`, `src/browser/routes/agent.act.ts`, `src/browser/pw-session.ts`

**What was added**
- MutationObserver-based incremental discovery of dynamically rendered dropdown options.
- New actions:
  - `discover_dropdown`
  - `close_dropdown`
- Dynamic temporary refs (`d1`, `d2`, ...) injected for newly discovered options.

**How it helps**
- Improves reliability on modern custom UI dropdowns (React/Vue/Select2/listbox patterns).
- Lets the agent interact with options that are not present in the initial snapshot.
- Reduces failed selections on ATS forms where native `<select>` assumptions break.

---

### ✅ Plan 03 — Fill-Verify and Smart Input
**Implemented in:** `src/browser/pw-tools-core.interactions.ts`, `src/browser/routes/agent.act.ts`

**What was added**
- Fill-then-verify pattern for each form field.
- Fallback strategies when `fill()` does not stick:
  - sequential typing (`pressSequentially`)
  - keyboard typing fallback
- Format-aware handling for:
  - phone inputs (digits-only retry)
  - date fields (placeholder/type-aware formatting)
- Per-field fill result reporting (`matched`, `strategy`, `actualValue`, `warning`).

**How it helps**
- Prevents silent form-fill failures.
- Increases success rate on controlled inputs and masked widgets.
- Improves data quality by adapting to field-specific formats.

---

### ✅ Plan 04 — Incremental Snapshot Delta
**Implemented in:** `src/browser/pw-tools-core.dom-observer.ts`, `src/browser/pw-tools-core.snapshot.ts`, `src/browser/routes/agent.snapshot.ts`

**What was added**
- DOM delta observer (added/removed/modified tracking).
- Attribute change tracking for relevant form states (`aria-invalid`, `disabled`, `readonly`, `value`, etc.).
- New endpoint: `POST /snapshot/delta` (start/stop observation).

**How it helps**
- Provides lightweight page diffs instead of full resnapshots.
- Improves performance and token efficiency for agent reasoning.
- Detects validation/error UI changes quickly after each action.

---

### ✅ Plan 05 — Dynamic Element State
**Implemented in:** `src/browser/pw-tools-core.interactions.ts`, `src/browser/routes/agent.act.ts`, `src/browser/routes/agent.act.shared.ts`

**What was added**
- Live element state queries:
  - `queryElementStateViaPlaywright`
  - `queryElementStatesViaPlaywright`
- New action: `query_state`
- Runtime checks for interactability signals (exists, visible, enabled, editable, obscured, etc.).

**How it helps**
- Avoids acting on stale/hidden/blocked elements.
- Improves decision quality before fill/click/type actions.
- Reduces flaky failures in dynamic forms.

---

### ✅ Plan 06 — Blocking Element Detection
**Implemented in:** `src/browser/pw-tools-core.interactions.ts`, `src/browser/routes/agent.act.ts`, `src/browser/routes/agent.act.shared.ts`

**What was added**
- Blocking overlay detection via top-element/center-point analysis.
- Dismissal support with strategy escalation:
  - click close
  - press Escape
  - click outside
- New actions:
  - `detect_blocker`
  - `dismiss_blocker`

**How it helps**
- Detects and recovers from cookie banners/modals/chat popups that block fields.
- Improves robustness of automation flows on real job application pages.
- Adds explainability with blocker metadata and suggested strategy.

---

### 🛠 Post-merge stabilization fixes
**Implemented in:**
- `src/browser/pw-ai.ts`
- `src/browser/pw-tools-core.dom-observer.ts`
- `src/browser/pw-tools-core.interactions.test.ts`

**Changes**
- Exported blocker APIs through `pw-ai` surface.
- Fixed strict typing issue for optional incremental refs.
- Cleaned duplicate test imports and optional-ref handling.

**Validation**
- `npm run check` ✅
- `npm test` ✅
