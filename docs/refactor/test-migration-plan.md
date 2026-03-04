# Test Migration Plan

**Status:** In Progress  
**Date:** 2026-03-04

---

## Overview

This document tracks the migration of tests from legacy architecture to Clean Architecture.

---

## Legacy Dependencies Found

### In Tests (41 files with legacy imports)

| Import Path | Files Using | Replacement |
|-------------|-------------|-------------|
| `../../browser/config.js` | 1 | `../../config/config.js` |
| `../../browser/pw-session.js` | 4 | `../../core/services/session.service.js` |
| `../../browser/pw-tools-core.*.ts` | 6 | `../../adapters/playwright/*.ts` |
| `../../browser/routes/*.ts` | 8 | `../../api/routes/*.ts` |
| `../../browser/server-context.js` | 2 | TBD |
| `../../browser/server.js` | 3 | TBD |
| `../../browser/cdp.js` | 2 | `../../adapters/utils/cdp.utils.js` ✅ |
| `../../browser/cdp.helpers.js` | 1 | `../../adapters/utils/cdp.utils.js` ✅ |
| `../../browser/chrome` | 1 | `../../adapters/chrome/*.ts` |
| `../../browser/constants` | 1 | TBD |
| `../../browser/pw-role-snapshot.js` | 1 | `../../adapters/playwright/*.ts` |
| `../../logging/subsystem.js` | 1 | Keep (still in use) |
| `../../infra/ports.js` | 3 | TBD - create shared/utils |
| `../../infra/errors.js` | 1 | `../../shared/errors/*.ts` |
| `../../infra/ws.js` | 1 | TBD - create shared/utils |

### In Adapters (1 file - NOW FIXED ✅)

| File | Was | Now |
|------|-----|-----|
| `playwright.browser-driver.adapter.ts` | `../../../browser/cdp.js` | `../utils/cdp.utils.js` |

---

## Migration Priority

### Phase 1: Infrastructure (Completed ✅)

- [x] Create `src/adapters/utils/cdp.utils.ts`
- [x] Update `playwright.browser-driver.adapter.ts` to use new utils

### Phase 2: Shared Utilities (Next)

Create missing utility modules:

- [ ] `src/shared/utils/ports.ts` - Port utilities (`findFreePort`, `isPortAvailable`)
- [ ] `src/shared/utils/ws.ts` - WebSocket utilities (`rawDataToString`)
- [ ] `src/shared/errors/browser.error.ts` - Browser error classes

### Phase 3: Config Migration

- [ ] Merge `browser/config.ts` functionality into `config/`
- [ ] Add `resolveProfile` function
- [ ] Add `getConfiguredViewport` function
- [ ] Update test imports

### Phase 4: Test Helpers Migration

- [ ] Update `src/__tests__/helpers/test-server.ts`
- [ ] Update `src/__tests__/helpers/api-client.ts`
- [ ] Update `src/__tests__/helpers/core-browser.ts`

### Phase 5: Unit Tests

**Batch 1: Simple migrations**
- [ ] `config.unit.test.ts` - Update imports
- [ ] `cdp.unit.test.ts` - Use new cdp.utils
- [ ] `cdp-helpers.unit.test.ts` - Use new cdp.utils
- [ ] `infra-utilities.unit.test.ts` - Use new shared/utils

**Batch 2: Service migrations**
- [ ] `pw-session.unit.test.ts` - Migrate to SessionService
- [ ] `pw-session-advanced.unit.test.ts` - Migrate to SessionService
- [ ] `pw-tools-*.test.ts` - Migrate to InteractionService/SnapshotService

### Phase 6: Integration Tests

- [ ] `status.integration.test.ts`
- [ ] `control-route.integration.test.ts`
- [ ] `pw-tools-*.integration.test.ts`
- [ ] `agent-*.integration.test.ts`
- [ ] `routes/*.integration.test.ts`

### Phase 7: Contract Tests

- [ ] `act.contract.test.ts`
- [ ] `control.contract.test.ts`
- [ ] `status.contract.test.ts`
- [ ] `schemas/*.contract.test.ts`

### Phase 8: E2E Tests

- [ ] `smoke.e2e.spec.ts`
- [ ] `browser/*.e2e.spec.ts`
- [ ] `flows/*.e2e.spec.ts`
- [ ] `edge-cases/*.e2e.spec.ts`
- [ ] `error-recovery/*.e2e.spec.ts`
- [ ] `stress/*.e2e.spec.ts`

---

## Files That Cannot Be Migrated Yet

The following legacy files are still required by the new architecture:

### 1. `src/logging/subsystem.ts`

**Used by:**
- `src/container/container.ts`
- `src/config/config.ts`
- Most adapters and services

**Status:** New pino adapter exists but not fully integrated

### 2. `src/browser/routes/*.ts`

**Used by:**
- Test helpers
- Contract tests
- Integration tests

**Status:** New API routes exist but use different architecture

### 3. `src/browser/server-context.ts`

**Used by:**
- Test helpers
- Route registration

**Status:** No direct replacement yet

### 4. `src/browser/server.ts`

**Used by:**
- E2E tests
- Contract tests

**Status:** New server.ts not yet created

---

## Blockers

### 1. Logging Subsystem

The new `pino-logger.adapter.ts` cannot replace `logging/subsystem.ts` yet because:

- Container depends on `SubsystemLogger` interface from legacy
- Config depends on legacy logging
- Most files import from legacy

**Resolution:** Update container and config to use pino adapter first

### 2. API/Core Type Mismatch

The new API controllers (Worktree C) use different action types than the Core use cases (Worktree A):

- `ExecuteActionRequest` types don't match
- `ExecuteActionResponse` types don't match

**Resolution:** Align types between API and Core layers

### 3. Test Server Helper

`src/__tests__/helpers/test-server.ts` is deeply coupled to legacy routes and context.

**Resolution:** Create new test helpers for Clean Architecture

---

## Recommended Approach

### Iterative Migration (Recommended)

1. **Complete the new architecture** first
   - Finish adapter implementations
   - Wire DI container properly
   - Create new server entry point

2. **Create parallel test structure**
   - New tests for new architecture
   - Keep legacy tests working

3. **Gradually migrate tests**
   - Start with simple unit tests
   - Move to integration tests
   - Finally E2E tests

4. **Remove legacy code** when:
   - All functionality migrated
   - All tests passing with new structure
   - No dependencies on legacy code

### Timeline Estimate

| Phase | Duration | Files |
|-------|----------|-------|
| Infrastructure | 1 day | ✅ Done |
| Shared Utils | 1 day | 3 files |
| Config | 1 day | 2 files |
| Test Helpers | 2 days | 3 files |
| Unit Tests | 3 days | 20 files |
| Integration Tests | 3 days | 12 files |
| Contract Tests | 2 days | 7 files |
| E2E Tests | 2 days | 20 files |
| **Total** | **~15 days** | **84 test files** |

---

## Next Steps

1. Create shared utility modules (ports, ws, errors)
2. Update config to include browser profile resolution
3. Create new test helpers for Clean Architecture
4. Begin unit test migration (Batch 1)

---

**Last Updated:** 2026-03-04
