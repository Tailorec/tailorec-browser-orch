# Changelog

## [February 26, 2026] - Incremental Snapshot Delta Support

### Features Added
- **Incremental DOM Observation**: Introduced a MutationObserver-based tracking system that allows the agent to see exactly what changed on a page after an action (click, fill, etc.) without requiring a full expensive snapshot.
- **Validation Error Detection**: The observer specifically identifies elements that appear to be error messages (via classes like `error`, `invalid`, `danger` or ARIA roles like `alert`). This allows the agent to immediately know if a field input caused a validation failure.
- **Attribute Change Tracking**: Tracks changes to critical UI states such as `aria-invalid`, `disabled`, `readonly`, and `value`. This is vital for detecting when fields become enabled or marked as invalid in real-time.
- **Delta Snapshot Endpoint**: Added `POST /snapshot/delta` to the browser service API, allowing external agents to start and stop observation sessions.

### Files Changed/Created
- `src/browser/pw-tools-core.dom-observer.ts` (New): The core engine for JS injection and mutation tracking.
- `src/browser/pw-tools-core.snapshot.ts`: Added bridge function to expose delta snapshots through the snapshot system.
- `src/browser/pw-ai.ts`: Exported the new delta snapshot capability to the AI module.
- `src/browser/routes/agent.snapshot.ts`: Implemented the REST API endpoint for delta snapshots.
- `src/browser/pw-tools-core.dom-observer.test.ts` (New): Automated tests verifying addition, removal, and modification tracking.

### Why This Matters (Benefits)
1.  **Performance**: Full snapshots of complex ATS (Applicant Tracking System) pages can be 30-70KB and take seconds to process. A delta snapshot is usually <2KB and processes in milliseconds.
2.  **LLM Context Efficiency**: Instead of sending the entire page to the LLM to find out what changed, we can send a compact "diff". This saves thousands of tokens per step.
3.  **Enhanced Reliability**: It solves the "blindness" issue where an agent might click a button and not realize a small red error message appeared elsewhere on the page. By specifically flagging `isError` in the delta, the agent can react to validation failures instantly.
4.  **Conditional Logic Handling**: Perfect for "cascading" forms (e.g., selecting a Country causes a State dropdown to appear). The delta snapshot tells the agent exactly which new fields appeared so it can fill them immediately without re-scanning the whole form.
