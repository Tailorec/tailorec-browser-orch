# 📚 Refactoring Documentation Index

**Project:** Tailorec Browser Service  
**Architecture:** Clean Architecture (Hybrid Approach)  
**Status:** Ready for Execution

---

## 📖 Document Overview

This folder contains comprehensive documentation for refactoring the Tailorec Browser Service from a layered architecture to Clean Architecture.

---

## 📄 Documents

### 1. [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) ⭐ START HERE

**Purpose:** Overall refactoring strategy and roadmap

**Contents:**
- Executive summary
- Current vs target state comparison
- Worktree strategy overview
- Target architecture diagram
- Detailed worktree descriptions (A, B, C, D, E)
- PR merge order and dependencies
- Success metrics
- Timeline (2 weeks)
- Risk mitigation

**Audience:** All team members, tech leads, project managers

**When to read:** Before starting any worktree implementation

---

### 2. [task-worktree-a-core.md](./task-worktree-a-core.md)

**Purpose:** Detailed implementation guide for Worktree A (Core Domain Layer)

**Contents:**
- Objective and dependencies
- Directory structure to create
- Step-by-step implementation:
  - Entities (BrowserSession, Tab, Profile)
  - Ports (IBrowserDriver, ISessionStore, IEventBus)
  - Services (Session, Snapshot, Interaction, Discovery, Navigation)
  - Use Cases (ExecuteAction, TakeSnapshot, StartSession)
- Source → target file mapping
- Tests that must pass
- AI agent prompt for assistance
- Definition of done

**Audience:** Senior Developer 1 (Worktree A owner)

**When to read:** When implementing Worktree A

**Priority:** 🔴 P0 (Must complete first)

**Estimated time:** 2-3 days

---

### 3. [task-worktree-b-adapters.md](./task-worktree-b-adapters.md)

**Purpose:** Detailed implementation guide for Worktree B (Infrastructure Adapters)

**Contents:**
- Objective and dependencies
- Directory structure to create
- Step-by-step implementation:
  - Playwright adapters (BrowserDriver, Snapshot, Interactions, Discovery, Navigation)
  - Chrome adapters (Launcher, Executables, Profile, Extension Relay)
  - HTTP adapters (Express server, middleware)
  - Logging adapter (Pino)
- Source → target file mapping
- Tests that must pass
- AI agent prompt for assistance
- Definition of done

**Audience:** Senior Developer 2 (Worktree B owner)

**When to read:** When implementing Worktree B

**Priority:** 🔴 P0 (Can parallelize with A after day 1)

**Estimated time:** 3-4 days

---

### 4. [task-worktree-c-api.md](./task-worktree-c-api.md)

**Purpose:** Detailed implementation guide for Worktree C (API Layer)

**Contents:**
- Objective and dependencies
- Directory structure to create
- Step-by-step implementation:
  - Validators (Snapshot, Action)
  - Controllers (Snapshot, Action, Control, Hooks, Basic)
  - Routes (Snapshot, Action, Control, Hooks, Basic)
  - Middlewares (Correlation, Error, Logging)
- Source → target file mapping
- Tests that must pass
- AI agent prompt for assistance
- Definition of done

**Audience:** Mid-Level Developer (Worktree C owner)

**When to read:** When implementing Worktree C

**Priority:** 🟡 P1 (Depends on A & B)

**Estimated time:** 2-3 days

---

### 5. [task-worktree-d-shared.md](./task-worktree-d-shared.md)

**Purpose:** Detailed implementation guide for Worktree D (Shared & Config)

**Contents:**
- Objective and dependencies
- Directory structure to create
- Step-by-step implementation:
  - Error hierarchy (DomainError, ValidationError, BrowserError)
  - Utility types (Result, Optional)
  - Utility functions (String, Number, Object, Timeout)
  - Configuration (Types, Validators, Loading)
  - DI Container
- Source → target file mapping
- Tests that must pass
- AI agent prompt for assistance
- Definition of done

**Audience:** Mid-Level Developer (Worktree D owner)

**When to read:** When implementing Worktree D

**Priority:** 🟡 P1 (Can parallelize with C)

**Estimated time:** 1-2 days

---

### 6. [task-worktree-e-integration.md](./task-worktree-e-integration.md)

**Purpose:** Detailed implementation guide for Worktree E (Integration & Cleanup)

**Contents:**
- Objective and dependencies
- Merge strategy for all worktrees
- Test import update guide
- Old file removal checklist
- main.ts update instructions
- Test execution order
- Documentation update guide (README, TESTING.md, Migration Guide)
- Tests that must pass
- AI agent prompt for assistance
- Definition of done
- Post-merge checklist

**Audience:** Senior Developer 1 or 2 (Worktree E owner)

**When to read:** When implementing Worktree E

**Priority:** 🟢 P2 (Must complete last)

**Estimated time:** 2-3 days

---

## 🗺️ Reading Order by Role

### For Tech Leads / Architects

1. [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) — Understand overall strategy
2. [task-worktree-a-core.md](./task-worktree-a-core.md) — Review core architecture
3. [task-worktree-e-integration.md](./task-worktree-e-integration.md) — Plan integration

### For Worktree A Developer

1. [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) — Understand context
2. [task-worktree-a-core.md](./task-worktree-a-core.md) — Implementation guide

### For Worktree B Developer

1. [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) — Understand context
2. [task-worktree-a-core.md](./task-worktree-a-core.md) — Review ports (dependencies)
3. [task-worktree-b-adapters.md](./task-worktree-b-adapters.md) — Implementation guide

### For Worktree C Developer

1. [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) — Understand context
2. [task-worktree-c-api.md](./task-worktree-c-api.md) — Implementation guide

### For Worktree D Developer

1. [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) — Understand context
2. [task-worktree-d-shared.md](./task-worktree-d-shared.md) — Implementation guide

### For Worktree E Developer

1. [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) — Understand context
2. [task-worktree-e-integration.md](./task-worktree-e-integration.md) — Implementation guide

---

## 📊 Quick Reference

### Worktree Summary

| Worktree | Branch | Focus | Files | Time | Priority |
|----------|--------|-------|-------|------|----------|
| A | `refactor/worktree-a-core` | Core Domain | ~16 files | 2-3 days | 🔴 P0 |
| B | `refactor/worktree-b-adapters` | Adapters | ~14 files | 3-4 days | 🔴 P0 |
| C | `refactor/worktree-c-api` | API Layer | ~15 files | 2-3 days | 🟡 P1 |
| D | `refactor/worktree-d-shared` | Shared/Config | ~14 files | 1-2 days | 🟡 P1 |
| E | `refactor/worktree-e-integration` | Integration | ~10 tasks | 2-3 days | 🟢 P2 |

### Target Architecture

```
src/
├── core/           # Entities, Services, Ports, Use Cases
├── adapters/       # Playwright, Chrome, HTTP, Logging
├── api/            # Controllers, Routes, Validators, Middlewares
├── shared/         # Errors, Types, Utils
├── config/         # Configuration
├── container/      # DI Container
└── main.ts         # Entry Point
```

### PR Merge Order

```
1. PR #1: Worktree A (Core)
   ↓
2. PR #2: Worktree B (Adapters)
   ↓
3. PR #3: Worktree C (API)
   ↓
4. PR #4: Worktree D (Shared)
   ↓
5. PR #5: Worktree E (Integration) → Main
```

---

## 🛠️ How to Use These Documents

### Before Starting

1. Read [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) for context
2. Identify your worktree assignment
3. Read your task document thoroughly
4. Set up worktree environment
5. Review AI agent prompt

### During Implementation

1. Follow step-by-step instructions in task document
2. Use AI agent prompt for assistance with specific files
3. Run tests frequently
4. Check definition of done before considering task complete

### After Completion

1. Verify all definition of done items are checked
2. Run full test suite
3. Submit PR for review
4. Update this index if documentation needs improvement

---

## 📞 Support

### Questions About

- **Overall Strategy:** See [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)
- **Worktree A Implementation:** See [task-worktree-a-core.md](./task-worktree-a-core.md)
- **Worktree B Implementation:** See [task-worktree-b-adapters.md](./task-worktree-b-adapters.md)
- **Worktree C Implementation:** See [task-worktree-c-api.md](./task-worktree-c-api.md)
- **Worktree D Implementation:** See [task-worktree-d-shared.md](./task-worktree-d-shared.md)
- **Worktree E Implementation:** See [task-worktree-e-integration.md](./task-worktree-e-integration.md)

### Escalation

- **Blockers:** Tag tech lead in Slack
- **Architecture Questions:** Refer to REFACTORING_PLAN.md
- **Daily Sync:** 10 AM local time

---

## 📈 Progress Tracking

Track progress in the main [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) document.

---

**Created:** 2026-03-04  
**Version:** 1.0  
**Last Updated:** 2026-03-04
