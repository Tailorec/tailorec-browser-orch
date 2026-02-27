# Skyvern Plan Implementation Tracker

Tracker focused on what is needed for `openclaw-browser` and `open-agent` for job-application automation.

Status legend:
- `full` = implemented as planned
- `partial` = implemented but missing major parts/integration
- `none` = not implemented

| Name of plan | Alignment | Impl in openclaw-browser | Impl in open-agent | Improvements suggested | How it helps |
|---|---|---|---|---|---|
| 01 — Custom Dropdown Engine | `direct_port` | full | none | Integrate open-agent tool flow (`discover_dropdown` -> option selection -> close) | Fixes custom ATS dropdown failures (Greenhouse/Ashby/etc.) |
| 02 — Rich Snapshot Metadata | `inspired` | none | none | Add Skyvern-like reserved attribute extraction and pass metadata into prompt context | Better field understanding (required/type/pattern/value), fewer wrong fills |
| 03 — Fill-Verify and Smart Input | `direct_port` | full | none | Add open-agent retry policy based on `matched/strategy/warning` results | Prevents silent fill failures; improves masked/date/phone reliability |
| 04 — Incremental Snapshot Delta | `direct_port` | full | none | Add delta-aware reasoning loop in open-agent after each action | Faster, cheaper perception; catches new errors/conditional fields quickly |
| 05 — Dynamic Element State | `direct_port` | full | none | Add pre-action `query_state` checks in open-agent for risky fields | Avoids stale/hidden/disabled element actions |
| 06 — Blocking Element Detection | `direct_port` | full | none | Add automatic blocker detection/dismiss orchestration in open-agent | Recovers from modals/cookie/chat overlays blocking form fields |
| 07 — Screenshot Vision Tool | `direct_port` | partial | none | Wire screenshot/labeled screenshot usage in open-agent with model gating | Captures visual-only errors/signals not in DOM/a11y snapshot |
| 08 — Prompt and Skill Upgrade | `inspired` | none | none | Adopt structured Skyvern-style action planning + confidence + action-history usage | Improves consistency and reduces repeated/unsafe actions |
| 09 — Select Option Improvements | `direct_port` | none | none | Implement layered native/custom smart-select and integrate into open-agent tools | More reliable select handling across native/custom widgets |
| 10 — Multi-Step Form Navigation | `inspired` | none | none | Add page-identity + step-progress tracking + resume checkpoints in open-agent | Reliable wizard progression (next/back/review/submit detection) |
| 11 — Resume Upload Intelligence | `inspired` | none | none | Implement upload widget detection + upload verification + post-upload checks | Reduces #1 job-app failure: resume not actually uploaded |
| 12 — Screening Question Intelligence | `inspired` | none | none | Add classifier + safe answer policy with user-escalation on uncertainty | Lowers knockout-risk answers and improves compliance |
| 13 — ATS Platform Detection | `inspired` | none | none | Detect ATS and load platform-specific strategy/skills dynamically | Adapts behavior per ATS quirks (Greenhouse/Lever/Ashby) |
| 14 — Repeating Sections | `inspired` | none | none | Detect repeating groups and map resume entries with stable per-entry refs | Handles work-history/education multi-entry forms correctly |
| 15 — Already-Applied Detection | `inspired` | none | none | Add early-state detection (already_applied/draft/closed/login_required) | Avoids wasted runs and duplicate submissions |
| 16 — Location Autocomplete | `direct_port` | none | none | Add type-wait-select flow with fallback for split location fields | Fixes common autocomplete clears/invalid location submissions |
| 17 — Confirmation Extraction | `inspired` | none | none | Add post-submit confirmation parser with retry/error signals | Prevents false-success; captures confirmation proof/IDs |
| 18 — Free-Text Answer Quality | `inspired` | none | none | Add answer-context builder (resume + JD + company) and quality constraints | Produces stronger, role-specific answers for text prompts |

## Notes
- Tracker intentionally excludes non-Skyvern-aligned custom additions.
- For mixed plans, browser implementation alone is not enough; open-agent orchestration is required for end-to-end impact.
