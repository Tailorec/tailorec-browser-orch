# Skyvern-Inspired Improvement Plan — Overview

## Purpose

This folder contains detailed improvement plans for **open-agent** and **openclaw-browser** inspired by Skyvern's form-filling architecture. Each file covers one feature area and specifies exactly which codebase, file, and function each change applies to.

## Index

| # | File | Feature | Primary Target |
|---|------|---------|---------------|
| 01 | `01-custom-dropdown-engine.md` | Custom dropdown / autocomplete handling via DOM mutation observation | openclaw-browser + open-agent |
| 02 | `02-rich-snapshot-metadata.md` | Enrich snapshots with HTML attributes (required, type, placeholder, value, disabled, pattern) | openclaw-browser |
| 03 | `03-fill-verify-and-smart-input.md` | Fill-then-verify, sequential typing fallback, format-aware input (phone, date, masked) | openclaw-browser + open-agent |
| 04 | `04-incremental-snapshot-delta.md` | Incremental DOM change detection between actions | openclaw-browser + open-agent |
| 05 | `05-dynamic-element-state.md` | Real-time disabled/readonly/visibility checks at interaction time | openclaw-browser |
| 06 | `06-blocking-element-detection.md` | Detect and route around overlay/popup/modal blocking form elements | openclaw-browser + open-agent |
| 07 | `07-screenshot-vision-tool.md` | Optional screenshot tool for visual debugging and error detection | openclaw-browser + open-agent |
| 08 | `08-prompt-and-skill-upgrade.md` | System prompt and skill file improvements for structured form reasoning | open-agent |
| 09 | `09-select-option-improvements.md` | Native `<select>` and custom combobox/listbox robust selection | openclaw-browser + open-agent |
| 10 | `10-multi-step-form-navigation.md` | Multi-page/multi-step form wizard handling with checkpoint validation | open-agent |

## Architecture Reference

```
┌──────────────────────────────────┐
│         open-agent (TS)          │  Port 8081
│  src/orchestrator/pi-runner.ts   │  Agent brain (Pi session + LLM)
│  src/tools/browser-adapter.ts   │  HTTP client to openclaw-browser
│  src/tools/browser-executor.ts  │  Tool execution + event emission
│  src/context/prompt-builder.ts  │  System prompt construction
│  skills/job-application-*.md    │  Skill instructions for LLM
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

## Priority Order

1. **Custom dropdown engine** — #1 failure mode in ATS forms
2. **Rich snapshot metadata** — required/type/value awareness prevents blind fills
3. **Fill-verify + smart input** — catches silent fill failures
4. **Incremental snapshot delta** — efficient re-perception after actions
5. **Dynamic element state** — handles conditional fields
6. **Blocking element detection** — modals/overlays over form fields
7. **Screenshot vision tool** — visual error detection fallback
8. **Prompt/skill upgrade** — structured reasoning for complex forms
9. **Select option improvements** — robust native + custom select
10. **Multi-step form navigation** — wizard/pagination handling
