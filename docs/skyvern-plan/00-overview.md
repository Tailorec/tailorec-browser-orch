# Skyvern-Inspired Improvement Plan — Overview

## Purpose

This folder contains detailed improvement plans for **open-agent** and **openclaw-browser** inspired by Skyvern's form-filling architecture, **focused on automating job applications** on simpler ATS platforms: Greenhouse, Lever, Ashby, SmartRecruiters, and BambooHR.

Complex ATS platforms (Workday, Taleo, SuccessFactors) are **explicitly out of scope**.

Each file covers one feature area and specifies exactly which codebase, file, and function each change applies to.

## Index

### Infrastructure Plans (01–10) — Browser Engine Robustness

| # | File | Feature | Primary Target | Job-App Specific? |
|---|------|---------|---------------|-------------------|
| 01 | `01-custom-dropdown-engine.md` | Custom dropdown / autocomplete handling via DOM mutation observation | openclaw-browser + open-agent | ✅ Updated with Greenhouse Select2, Lever, Ashby, EEO dropdown patterns |
| 02 | `02-rich-snapshot-metadata.md` | Enrich snapshots with HTML attributes (required, type, placeholder, value, disabled, pattern) | openclaw-browser | ✅ Updated with field→profile mapping, `autocomplete`/`name` semantic hints, resume upload detection |
| 03 | `03-fill-verify-and-smart-input.md` | Fill-then-verify, sequential typing fallback, format-aware input (phone, date, masked) | openclaw-browser + open-agent | ✅ Updated with ATS-specific phone/date formats, resume parse pre-fill awareness |
| 04 | `04-incremental-snapshot-delta.md` | Incremental DOM change detection between actions | openclaw-browser + open-agent | Generic |
| 05 | `05-dynamic-element-state.md` | Real-time disabled/readonly/visibility checks at interaction time | openclaw-browser | Generic |
| 06 | `06-blocking-element-detection.md` | Detect and route around overlay/popup/modal blocking form elements | openclaw-browser + open-agent | Generic |
| 07 | `07-screenshot-vision-tool.md` | Optional screenshot tool for visual debugging and error detection | openclaw-browser + open-agent | Generic |
| 08 | `08-prompt-and-skill-upgrade.md` | System prompt and skill file improvements for structured form reasoning | open-agent | ✅ Updated with 9-phase execution protocol, field→profile mapping table, ATS-specific skill structure |
| 09 | `09-select-option-improvements.md` | Native `<select>` and custom combobox/listbox robust selection | openclaw-browser + open-agent | Generic |
| 10 | `10-multi-step-form-navigation.md` | Multi-page/multi-step form wizard handling with checkpoint validation | open-agent | ✅ Updated with per-ATS step structures, step detection heuristics, ATS URL detection |

### Job Application Plans (11–18) — Application-Specific Intelligence

| # | File | Feature | Primary Target |
|---|------|---------|---------------|
| 11 | `11-resume-upload-intelligence.md` | Upload widget detection (native/hidden/dropzone/button), upload verification, resume parse pre-fill | openclaw-browser + open-agent |
| 12 | `12-screening-question-intelligence.md` | Question classifier (work auth, visa, EEO, experience, salary), knockout question safety, answer guidance | open-agent |
| 13 | `13-ats-platform-detection.md` | ATS detection (URL/HTML/CSS), platform-specific skill files (Greenhouse, Lever, Ashby), dynamic skill loading | openclaw-browser + open-agent |
| 14 | `14-repeating-sections.md` | Work history / education "Add another" section detection, resume→entry mapping, fill coordination | openclaw-browser + open-agent |
| 15 | `15-already-applied-detection.md` | Application state detection (already applied, draft, closed, login required), early exit / resume draft | openclaw-browser + open-agent |
| 16 | `16-location-autocomplete.md` | Google Places / custom autocomplete handling, type→wait→select, split field detection, keyboard fallback | openclaw-browser + open-agent |
| 17 | `17-confirmation-extraction.md` | Post-submit page analysis, success/error signal detection, confirmation ID extraction, validation error detection | openclaw-browser + open-agent |
| 18 | `18-free-text-answer-quality.md` | Answer context builder (question categorization, resume excerpt extraction, job req matching), quality guidelines | open-agent |

## Architecture Reference

```
┌──────────────────────────────────┐
│         open-agent (TS)          │  Port 8081
│  src/orchestrator/pi-runner.ts   │  Agent brain (Pi session + LLM)
│  src/tools/browser-adapter.ts   │  HTTP client to openclaw-browser
│  src/tools/browser-executor.ts  │  Tool execution + event emission
│  src/context/prompt-builder.ts  │  System prompt construction
│  skills/job-application-*.md    │  Skill instructions for LLM
│  skills/ats-greenhouse.md       │  NEW: Greenhouse-specific strategies
│  skills/ats-lever.md            │  NEW: Lever-specific strategies
│  skills/ats-ashby.md            │  NEW: Ashby-specific strategies
│  skills/ats-generic.md          │  NEW: Generic ATS fallback
│  src/orchestrator/              │
│    screening-questions.ts       │  NEW: Screening question classifier
│    answer-generator.ts          │  NEW: Free-text answer context builder
└──────────┬───────────────────────┘
           │ HTTP JSON (REST)
           ▼
┌──────────────────────────────────────────┐
│       openclaw-browser (TS)              │  Port 4000
│  src/browser/pw-tools-core.snapshot.ts   │  Snapshot generation
│  src/browser/pw-role-snapshot.ts         │  Role/ref building
│  src/browser/pw-tools-core.interactions.ts│ Click/fill/type/select
│  src/browser/routes/agent.act.ts         │  Action routing
│  src/browser/routes/agent.snapshot.ts    │  Snapshot routing
│  src/browser/pw-session.ts               │  Session + ref storage
└──────────────────────────────────────────┘
           │ CDP / Playwright
           ▼
       [ Chromium ]
```

## Priority Order — Implementation Roadmap

### Phase A: Core Infrastructure (Week 1-2)
1. **Plan 13: ATS Detection** — Detect which platform we're on first
2. **Plan 15: Already-Applied Detection** — Avoid wasted runs on non-actionable pages
3. **Plan 01: Custom Dropdown Engine** — #1 failure mode in ATS forms
4. **Plan 02: Rich Snapshot Metadata** — required/type/value awareness

### Phase B: Input Reliability (Week 2-3)
5. **Plan 03: Fill-Verify + Smart Input** — catches silent fill failures
6. **Plan 16: Location Autocomplete** — #2 failure mode after dropdowns
7. **Plan 09: Select Option Improvements** — robust native + custom select
8. **Plan 11: Resume Upload Intelligence** — upload detection and verification

### Phase C: Application Intelligence (Week 3-4)
9. **Plan 12: Screening Question Intelligence** — knockout question safety
10. **Plan 18: Free-Text Answer Quality** — quality answers for "Why us?" etc.
11. **Plan 14: Repeating Sections** — work history / education filling
12. **Plan 08: Prompt/Skill Upgrade** — structured 9-phase execution protocol

### Phase D: Completion Confidence (Week 4-5)
13. **Plan 17: Confirmation Extraction** — verify submission actually worked
14. **Plan 10: Multi-Step Navigation** — wizard handling with step tracking
15. **Plan 05: Dynamic Element State** — conditional field handling

### Phase E: Polish (Week 5+)
16. **Plan 04: Incremental Snapshot Delta** — efficient re-perception
17. **Plan 06: Blocking Element Detection** — modal/overlay handling
18. **Plan 07: Screenshot Vision Tool** — visual fallback

## Target ATS Coverage

| ATS | Market Share (Tech) | Difficulty | Key Challenges |
|---|---|---|---|
| **Greenhouse** | ~35% | Medium | Multi-step wizard, Select2 dropdowns, resume parsing pre-fill |
| **Lever** | ~20% | Easy | Single page, hidden file input, simple form |
| **Ashby** | ~10% | Medium-Hard | All custom React, no native elements |
| **SmartRecruiters** | ~8% | Medium | Multi-step, LinkedIn import prompt |
| **BambooHR** | ~5% | Easy | Simple single page, split address fields |
| **iCIMS** | ~10% | Hard (borderline) | Login walls, complex navigation |

**Total addressable coverage: ~78% of tech job applications** (excluding Workday/Taleo/SuccessFactors).

## New Files Created by These Plans

### In `open-agent`:
- `src/orchestrator/screening-questions.ts` — screening question classifier
- `src/orchestrator/answer-generator.ts` — free-text answer context builder
- `skills/ats-greenhouse.md` — Greenhouse-specific strategies
- `skills/ats-lever.md` — Lever-specific strategies
- `skills/ats-ashby.md` — Ashby-specific strategies
- `skills/ats-generic.md` — generic ATS fallback

### In `openclaw-browser`:
- New functions in existing files (no new files — extends `interactions.ts`, `snapshot.ts`, `agent.act.ts`)

### New Action Kinds (in `agent.act.ts`):
- `detect_upload_widget` — analyze upload element type
- `verify_upload` — confirm file upload succeeded
- `fill_location` — handle location autocomplete fields
- `detect_repeating_sections` — find "Add another" sections

### New Snapshot Routes (in `agent.snapshot.ts`):
- `/snapshot/submit-confirmation` — post-submit page analysis
- `/snapshot/repeating-sections` — repeating section detection

### New Agent Tools (in `pi-runner.ts`):
- `browser.detect_upload_widget`
- `browser.verify_upload`
- `browser.fill_location`
- `browser.detect_repeating_sections`
- `browser.check_submit_confirmation`
- `runtime.classify_screening_questions`
- `runtime.build_answer_context`
- `runtime.plan_repeating_entries`
- `runtime.validate_before_submit` (from plan 08)
