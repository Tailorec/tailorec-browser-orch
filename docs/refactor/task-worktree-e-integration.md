# 📋 Task Document: Worktree E — Integration & Cleanup

**Branch:** `refactor/worktree-e-integration`  
**Priority:** 🟢 P2 (Must complete last)  
**Estimated Time:** 2-3 days  
**Owner:** Senior Developer 1 or 2

---

## 🎯 Objective

**Merge all worktrees**, update test imports, remove old files, fix remaining imports, update documentation, and ensure everything works together.

### Dependencies

- **Blocks:** Nothing (final integration)
- **Blocked by:** Worktrees A, B, C, D (all must be complete)
- **Can start:** Only after all other worktrees are merged

---

## 📁 Deliverables

### Tasks to Complete

```
1. Merge all worktrees into single branch
2. Update all test imports to new structure
3. Remove old files from src/browser/, src/infra/, src/logging/
4. Fix remaining import paths
5. Update main.ts to use DI container
6. Run full test suite and fix failures
7. Update documentation (README, TESTING.md, etc.)
8. Create migration guide
```

---

## 🔨 Implementation Details

### Step 1: Merge All Worktrees (Day 1, Morning)

#### Merge Strategy

```bash
# Start from main branch
cd /home/faishal/tailorec/tailorec-source/agents/openclaw-browser
git checkout main

# Create integration branch
git checkout -b refactor/integration

# Merge Worktree A (Core) - MUST BE FIRST
git merge refactor/worktree-a-core -m "chore: merge worktree A - core domain layer"

# Merge Worktree B (Adapters)
git merge refactor/worktree-b-adapters -m "chore: merge worktree B - infrastructure adapters"

# Merge Worktree C (API)
git merge refactor/worktree-c-api -m "chore: merge worktree C - API layer"

# Merge Worktree D (Shared)
git merge refactor/worktree-d-shared -m "chore: merge worktree D - shared & config"

# Resolve any conflicts
# ... edit conflicting files ...
git add .
git commit -m "fix: resolve merge conflicts"
```

#### Expected Conflicts

| File | Likely Conflict | Resolution |
|------|----------------|------------|
| `package.json` | New dependencies (logging, zod) | Accept all changes |
| `tsconfig.json` | Path aliases | Merge path configurations |
| `src/browser/pw-session.ts` | Moved to core/adapters | Delete, use new files |
| `src/browser/pw-tools-core.*.ts` | Moved to adapters | Delete, use new files |
| `src/browser/routes/*.ts` | Moved to API | Delete, use new files |
| `src/logging/subsystem.ts` | Replaced with logger adapter | Delete, use new adapter |

---

### Step 2: Update Test Imports (Day 1, Afternoon)

#### Update Unit Tests

**Example:** `src/__tests__/unit/config.unit.test.ts`

```typescript
// BEFORE
import { loadConfig } from '../../browser/config.js';

// AFTER
import { loadConfig } from '../../config/config.js';
```

**Example:** `src/__tests__/unit/pw-session.unit.test.ts`

```typescript
// BEFORE
import { getPageForTargetId } from '../../browser/pw-session.js';

// AFTER
import { SessionService } from '../../core/services/session.service.js';
// OR update test to use new API
```

#### Script to Update Imports

Create a script to help with bulk updates:

```bash
#!/bin/bash
# scripts/update-test-imports.sh

# Update config imports
find src/__tests__ -name "*.test.ts" -exec sed -i 's|../../browser/config|../../config/config|g' {} \;

# Update logging imports
find src/__tests__ -name "*.test.ts" -exec sed -i 's|../../logging/subsystem|../../adapters/logging/logger|g' {} \;

# Update session imports
find src/__tests__ -name "*.test.ts" -exec sed -i 's|../../browser/pw-session|../../core/services/session|g' {} \;

# Update snapshot imports
find src/__tests__ -name "*.test.ts" -exec sed -i 's|../../browser/pw-tools-core.snapshot|../../adapters/playwright/playwright.snapshot|g' {} \;

# Update interaction imports
find src/__tests__ -name "*.test.ts" -exec sed -i 's|../../browser/pw-tools-core.interactions|../../adapters/playwright/playwright.interactions|g' {} \;

echo "Import updates complete. Please verify manually."
```

---

### Step 3: Remove Old Files (Day 2, Morning)

#### Files to Delete

```bash
# Remove old browser directory (after verifying all code moved)
rm -rf src/browser/

# Remove old infra directory
rm -rf src/infra/

# Remove old logging directory
rm -rf src/logging/

# Verify new structure exists
ls -la src/core/
ls -la src/adapters/
ls -la src/api/
ls -la src/shared/
ls -la src/config/
ls -la src/container/
```

#### Update package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "dev": "tsx src/main.ts",
    "check": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:contract": "vitest run --project contract",
    "test:coverage": "COVERAGE_PHASE=1 vitest run --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/",
    "deps:circular": "madge --circular src/",
    "unused:exports": "ts-prune",
    "refactor:verify": "npm run check && npm run test && npm run deps:circular"
  }
}
```

---

### Step 4: Update main.ts (Day 2, Afternoon)

#### New main.ts

```typescript
// src/main.ts
import { createContainer } from './container/container.js';
import { loadConfig } from './config/config.js';
import { createSubsystemLogger } from './adapters/logging/logger.adapter.js';
import { ExpressServerAdapter } from './adapters/http/express.server.adapter.js';
import { registerAllRoutes } from './api/routes/index.js';
import { errorMiddleware } from './api/middlewares/error.middleware.js';
import { correlationMiddleware } from './api/middlewares/correlation.middleware.js';
import { loggingMiddleware } from './api/middlewares/logging.middleware.js';

const log = createSubsystemLogger('main');

process.on('uncaughtException', (err) => {
  log.exception('Uncaught exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.exception('Unhandled promise rejection', reason);
  process.exit(1);
});

async function main() {
  try {
    log.info('Starting Tailorec Browser Service...');
    
    // Load configuration
    const config = loadConfig();
    
    // Create DI container
    const container = createContainer(config);
    
    // Create HTTP server
    const server = new ExpressServerAdapter();
    
    // Register middlewares
    server.use(correlationMiddleware);
    server.use(loggingMiddleware);
    
    // Register routes
    registerAllRoutes(server, container);
    
    // Register error handler (must be last)
    server.use(errorMiddleware);
    
    // Start server
    const { port } = await server.start({
      port: config.port,
      host: config.host,
    });
    
    log.info(`Service ready on port ${port}`);
    
  } catch (err) {
    log.exception('Fatal error during service startup', err);
    process.exit(1);
  }
}

main();
```

---

### Step 5: Run All Tests (Day 2, Late Afternoon)

#### Test Execution Order

```bash
# 1. TypeScript check
npm run check

# 2. Run unit tests
npm run test:unit

# 3. Run integration tests
npm run test:integration

# 4. Run contract tests
npm run test:contract

# 5. Run E2E tests (optional, may need browser)
npm run test:e2e

# 6. Run with coverage
npm run test:coverage:phase2

# 7. Check for circular dependencies
npm run deps:circular

# 8. Check for unused exports
npm run unused:exports
```

#### Expected Test Failures & Fixes

| Test | Likely Issue | Fix |
|------|-------------|-----|
| Config tests | Import path changed | Update import to `../../config/config.js` |
| Session tests | API changed | Update to use `SessionService` |
| Snapshot tests | API changed | Update to use `SnapshotService` |
| Interaction tests | API changed | Update to use `InteractionService` |
| Route tests | Import paths changed | Update all imports |

---

### Step 6: Update Documentation (Day 3)

#### Update README.md

Add new architecture section:

```markdown
## Architecture

This project follows **Clean Architecture** principles with the following layers:

```
src/
├── core/           # Domain entities, services, ports, use cases
├── adapters/       # Infrastructure implementations (Playwright, Chrome, HTTP)
├── api/            # Interface layer (controllers, routes, validators)
├── shared/         # Cross-cutting utilities (errors, types, utils)
├── config/         # Configuration management
└── container/      # Dependency injection
```

### Key Design Decisions

- **Max file size:** 700 lines (enforced by linting)
- **Dependency rule:** Outer layers depend on inner layers
- **Test pyramid:** Unit > Integration > Contract > E2E
```

#### Update TESTING.md

Add new structure section:

```markdown
## Test Structure

```
src/__tests__/
├── unit/              # Test individual functions/classes
├── integration/       # Test component interactions
├── contract/          # Test API contracts
├── e2e/              # Test full user flows
├── support/          # Test utilities (renamed from helpers/)
├── factories/        # Test data factories
└── mocks/            # Mock implementations
```
```

#### Create MIGRATION_GUIDE.md

```markdown
# Migration Guide: Old → New Architecture

## Import Path Changes

| Old Path | New Path |
|----------|----------|
| `src/browser/config` | `src/config/config` |
| `src/browser/pw-session` | `src/core/services/session.service` |
| `src/browser/pw-tools-core.snapshot` | `src/adapters/playwright/playwright.snapshot.adapter` |
| `src/browser/pw-tools-core.interactions` | `src/adapters/playwright/playwright.interactions.adapter` |
| `src/browser/routes/agent` | `src/api/routes/agent.routes` |
| `src/logging/subsystem` | `src/adapters/logging/logger.adapter` |

## API Changes

### Session Service

```typescript
// OLD
import { getPageForTargetId } from './browser/pw-session';
const page = await getPageForTargetId({ cdpUrl, targetId });

// NEW
import { SessionService } from './core/services/session.service';
const session = await sessionService.getSession(targetId);
const page = session.page;
```

### Snapshot Service

```typescript
// OLD
import { snapshotAiViaPlaywright } from './browser/pw-tools-core.snapshot';
const result = await snapshotAiViaPlaywright({ cdpUrl, targetId });

// NEW
import { SnapshotService } from './adapters/playwright/playwright.snapshot.adapter';
const result = await snapshotService.captureSnapshot(page, options);
```
```

---

## ✅ Tests That Must Pass

### ALL Tests

```bash
# Complete test suite
npm run test

# By category
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e

# Coverage must meet Phase 2 thresholds
npm run test:coverage:phase2

# TypeScript check
npm run check

# Build
npm run build

# Circular dependencies check
npm run deps:circular

# Unused exports check
npm run unused:exports
```

---

## 🤖 AI Agent Prompt

```
You are helping refactor the Tailorec Browser Service to Clean Architecture.

CONTEXT:
- We are implementing Worktree E: Integration & Cleanup
- Branch: refactor/worktree-e-integration
- Goal: Merge all worktrees, fix imports, remove old files, update docs
- All other worktrees (A, B, C, D) are complete

TASK:
Help me with the following:

1. Merge all worktree branches into refactor/integration
2. Resolve merge conflicts
3. Update test imports to new structure
4. Remove old files from src/browser/, src/infra/, src/logging/
5. Update src/main.ts to use DI container
6. Fix any broken imports
7. Run all tests and fix failures
8. Update README.md, TESTING.md
9. Create MIGRATION_GUIDE.md

CONSTRAINTS:
- Maintain backward compatibility in API contracts
- All tests must pass
- No circular dependencies
- Coverage must meet Phase 2 thresholds

Please help me with [SPECIFIC_TASK].
```

---

## 📝 Definition of Done

- [ ] All worktrees merged successfully
- [ ] All merge conflicts resolved
- [ ] Old directory structure removed (src/browser/, src/infra/, src/logging/)
- [ ] All test imports updated
- [ ] main.ts updated to use DI container
- [ ] 100% of tests pass
- [ ] Coverage meets Phase 2 thresholds (50% lines, 65% functions)
- [ ] TypeScript compilation succeeds
- [ ] Build succeeds
- [ ] No circular dependencies
- [ ] Documentation updated (README, TESTING.md)
- [ ] Migration guide created
- [ ] Code reviewed by team
- [ ] PR ready for merge to main

---

## 🎉 Post-Merge Checklist

After merging to main:

- [ ] Delete all worktree branches
- [ ] Delete worktree directories
- [ ] Announce completion to team
- [ ] Update project documentation
- [ ] Celebrate! 🎉

---

**Created:** 2026-03-04  
**Version:** 1.0  
**Status:** Ready for Implementation
