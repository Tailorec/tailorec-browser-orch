# 🚀 Refactoring Quick Start Guide

**TL;DR:** We're refactoring to Clean Architecture using 5 parallel worktrees. This guide gets you started in 5 minutes.

---

## ⚡ 30-Second Overview

### What Are We Doing?

Refactoring the codebase from:
```
src/browser/ (36 files, some >1000 lines)
```

To:
```
src/core/        # Domain logic
src/adapters/    # Infrastructure
src/api/         # HTTP layer
src/shared/      # Utilities
src/config/      # Configuration
src/container/   # DI
```

### Why?

- ✅ No more god files (>1000 lines)
- ✅ Clear separation of concerns
- ✅ Easier to test and maintain
- ✅ Parallel development possible

### How?

5 worktrees (branches) developed in parallel, then merged:

| Worktree | Focus | Files | Time | Owner |
|----------|-------|-------|------|-------|
| **A** | Core Domain | 16 | 2-3 days | Senior Dev 1 |
| **B** | Adapters | 14 | 3-4 days | Senior Dev 2 |
| **C** | API Layer | 15 | 2-3 days | Mid Dev |
| **D** | Shared/Config | 14 | 1-2 days | Mid Dev |
| **E** | Integration | ~10 tasks | 2-3 days | Senior Dev |

---

## 🎯 Getting Started (5 Minutes)

### Step 1: Read the Main Plan (2 min)

```bash
cd /home/faishal/tailorec/tailorec-source/agents/openclaw-browser
cat docs/refactor/REFACTORING_PLAN.md
```

**Focus on:**
- Worktree Summary table
- Target Architecture diagram
- PR Merge Order

### Step 2: Identify Your Worktree (1 min)

| If You Are | Your Worktree | Document |
|------------|---------------|----------|
| Senior Dev 1 | Worktree A (Core) | `task-worktree-a-core.md` |
| Senior Dev 2 | Worktree B (Adapters) | `task-worktree-b-adapters.md` |
| Mid Dev | Worktree C (API) or D (Shared) | `task-worktree-c-api.md` or `task-worktree-d-shared.md` |
| Senior Dev (either) | Worktree E (Integration) | `task-worktree-e-integration.md` |

### Step 3: Create Your Worktree (2 min)

```bash
# Example for Worktree A
git worktree add -b refactor/worktree-a-core ../refactor/worktree-a-core

# Navigate to it
cd ../refactor/worktree-a-core

# Install dependencies
npm install

# Read your task document
cat ../../docs/refactor/task-worktree-a-core.md
```

---

## 📚 Essential Documents

### Must Read (In Order)

1. **[REFACTORING_PLAN.md](./REFACTORING_PLAN.md)** — Overall strategy
2. **[task-worktree-[x].md](./)** — Your specific task document
3. **[README.md](./README.md)** — Document index

### Document Quick Links

```
docs/refactor/
├── README.md                      # Start here for document index
├── REFACTORING_PLAN.md            # Overall strategy
├── task-worktree-a-core.md        # Core domain implementation
├── task-worktree-b-adapters.md    # Adapters implementation
├── task-worktree-c-api.md         # API layer implementation
├── task-worktree-d-shared.md      # Shared & config implementation
└── task-worktree-e-integration.md # Integration & cleanup
```

---

## 🛠️ Daily Workflow

### Morning

```bash
# 1. Sync with main
git fetch origin main
git rebase origin/main

# 2. Check your task document for today's goals
cat docs/refactor/task-worktree-[x].md

# 3. Start implementing
```

### During Day

```bash
# Work on assigned files
# Follow step-by-step guide in task document

# Run tests frequently
npm run test:unit -- src/__tests__/unit/[relevant-test].test.ts

# Commit often
git add .
git commit -m "refactor(core): create [component]"
```

### End of Day

```bash
# Push progress
git push origin refactor/worktree-[x]

# Update team in Slack
# Format: "Worktree [X]: Completed [tasks], blocked on [issue]"
```

---

## 🎯 Success Criteria

### For Each Worktree

- [ ] All files created per task document
- [ ] No file exceeds 700 lines
- [ ] All assigned tests pass
- [ ] TypeScript compilation succeeds
- [ ] No circular dependencies
- [ ] Code reviewed

### For Entire Refactoring

- [ ] All 5 worktrees merged
- [ ] 100% of tests pass
- [ ] Coverage ≥ Phase 2 thresholds
- [ ] Build succeeds
- [ ] Documentation updated

---

## 🆘 Getting Help

### Common Questions

**Q: Which file do I start with?**  
A: Your task document lists files in recommended order. Start with the first one.

**Q: How do I know if my refactoring is correct?**  
A: Run the tests listed in your task document. If they pass, you're good.

**Q: What if I find a bug in the original code?**  
A: Document it, but don't fix it during refactoring. Fix in a separate PR.

**Q: Can I change the architecture?**  
A: No. Follow the task document exactly. Discuss improvements for Phase 2.

### Escalation Path

1. **Check task document** — Most answers are there
2. **Ask in Slack** — `#refactoring-effort` channel
3. **Daily standup** — 10 AM local time
4. **Tech lead** — For architectural decisions

---

## 📊 Progress Tracking

### Worktree Status

| Worktree | Branch | Status | PR | Merge |
|----------|--------|--------|----|-------|
| A | `refactor/worktree-a-core` | ⏳ Not started | - | - |
| B | `refactor/worktree-b-adapters` | ⏳ Not started | - | - |
| C | `refactor/worktree-c-api` | ⏳ Not started | - | - |
| D | `refactor/worktree-d-shared` | ⏳ Not started | - | - |
| E | `refactor/worktree-e-integration` | ⏳ Not started | - | - |

Update status as:
- ⏳ Not started
- 🔄 In progress
- ✅ Complete
- 🚧 Blocked

---

## 🎉 After Completion

### When Your Worktree Is Done

1. ✅ Verify all definition of done items
2. ✅ Run full test suite
3. ✅ Submit PR
4. ✅ Code review
5. ✅ Merge (per merge order)
6. 🎉 Celebrate!

### When All Worktrees Are Done

1. All PRs merged to main
2. Delete worktree branches
3. Delete worktree directories
4. Team celebration 🎊

---

## 📞 Quick Reference

### Commands

```bash
# Create worktree
git worktree add -b refactor/worktree-[x] ../refactor/worktree-[x]

# Run tests
npm run test:unit
npm run test:integration
npm run test:contract

# TypeScript check
npm run check

# Build
npm run build

# Check circular dependencies
npm run deps:circular
```

### Important Files

```
src/core/ports/browser-driver.port.ts    # Browser interface
src/core/services/session.service.ts     # Session management
src/adapters/playwright/*                # Playwright implementations
src/api/controllers/*                    # HTTP controllers
src/config/config.ts                     # Configuration
src/container/container.ts               # DI container
```

---

## 📖 Further Reading

- **[REFACTORING_PLAN.md](./REFACTORING_PLAN.md)** — Detailed strategy
- **[task-worktree-[x].md](./)** — Your implementation guide
- **[README.md](./README.md)** — Document index

---

**Remember:** Small, incremental changes. Run tests frequently. Ask for help early.

**Good luck! 🚀**

---

**Created:** 2026-03-04  
**Version:** 1.0
