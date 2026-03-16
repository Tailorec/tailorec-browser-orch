# Migration Guide: Old Architecture → Clean Architecture

**Project:** Tailorec Browser Service  
**Date:** 2026-03-04  
**Status:** In Progress (Worktree E Integration)

---

## Overview

This guide documents the migration from the legacy monolithic architecture to Clean Architecture. The refactoring was completed in phases across multiple worktrees:

- **Worktree A:** Core domain layer (entities, services, ports, use cases)
- **Worktree B:** Infrastructure adapters (Playwright, Chrome, HTTP, Logging)
- **Worktree C:** API layer (controllers, routes, validators)
- **Worktree D:** Shared utilities and configuration
- **Worktree E:** Integration & Cleanup (this phase)

---

## Architecture Comparison

### Before (Legacy)

```
src/
├── browser/           # Monolithic browser logic
│   ├── pw-session.ts
│   ├── pw-tools-core.*.ts
│   ├── chrome.ts
│   ├── config.ts
│   └── routes/
├── infra/             # Infrastructure utilities
├── logging/           # Logging subsystem
└── server.ts
```

### After (Clean Architecture)

```
src/
├── core/              # Domain layer (innermost)
│   ├── entities/      # Business entities
│   ├── services/      # Domain services
│   ├── ports/         # Interface definitions
│   └── use-cases/     # Application use cases
├── adapters/          # Infrastructure layer
│   ├── playwright/    # Playwright implementations
│   ├── chrome/        # Chrome browser implementations
│   ├── http/          # HTTP server adapters
│   └── logging/       # Logging adapters
├── api/               # Interface layer
│   ├── controllers/   # HTTP controllers
│   ├── routes/        # Route definitions
│   ├── validators/    # Request validators
│   └── middlewares/   # Express middlewares
├── config/            # Configuration management
├── container/         # Dependency injection
├── shared/            # Cross-cutting utilities
│   ├── errors/        # Error classes
│   ├── types/         # Type utilities
│   └── utils/         # Helper functions
└── server.ts          # Entry point
```

---

## Import Path Changes

| Old Path | New Path | Status |
|----------|----------|--------|
| `src/browser/config` | `src/config/config` | ✅ Migrated |
| `src/browser/pw-session` | `src/core/services/session.service` | ⚠️ Partial |
| `src/browser/pw-tools-core.snapshot` | `src/adapters/playwright/playwright.snapshot.adapter` | ⚠️ Partial |
| `src/browser/pw-tools-core.interactions` | `src/adapters/playwright/playwright.interactions.adapter` | ⚠️ Partial |
| `src/browser/routes/agent` | `src/api/routes/` | ⚠️ Partial |
| `src/logging/subsystem` | `src/adapters/logging/logger.adapter` | ⚠️ Partial |

### Notes

- **Legacy code remains** in `src/browser/`, `src/infra/`, `src/logging/` for backward compatibility
- New code should use the Clean Architecture structure
- Tests still reference legacy code - migration in progress

---

## API Changes

### Session Management

**Before:**
```typescript
import { getPageForTargetId } from './browser/pw-session';
const page = await getPageForTargetId({ cdpUrl, targetId });
```

**After (Planned):**
```typescript
import { SessionService } from './core/services/session.service';
const session = await sessionService.getSession(targetId, cdpUrl);
const page = session.page;
```

### Snapshot Capture

**Before:**
```typescript
import { snapshotAiViaPlaywright } from './browser/pw-tools-core.snapshot';
const result = await snapshotAiViaPlaywright({ cdpUrl, targetId, options });
```

**After (Planned):**
```typescript
import { SnapshotService } from './adapters/playwright/playwright.snapshot.adapter';
const result = await snapshotService.captureSnapshot(page, options);
```

### Action Execution

**Before:**
```typescript
import { clickViaPlaywright } from './browser/pw-tools-core.interactions';
await clickViaPlaywright(page, ref, refs);
```

**After (Planned):**
```typescript
import { InteractionService } from './core/services/interaction.service';
await interactionService.executeAction(page, { kind: 'click', ref }, refs);
```

---

## Dependency Injection

### Before

No formal DI - direct instantiation and imports.

### After

```typescript
import { createContainer } from './container/container.js';

const config = loadConfig();
const container = createContainer(config);

// Access services via container
const sessionService = container.sessionService;
const snapshotService = container.snapshotService;
```

---

## Configuration

### Before

```typescript
import { loadConfig } from './browser/config';
const config = loadConfig();
```

### After

```typescript
import { loadConfig } from './config/config';
const config = loadConfig();
```

**Location:** `src/config/config.ts`

---

## Logging

### Before

```typescript
import { createSubsystemLogger } from './logging/subsystem';
const log = createSubsystemLogger('my-subsystem');
```

### After (Planned)

```typescript
import { createSubsystemLogger } from './adapters/logging/logger.adapter';
const log = createSubsystemLogger('my-subsystem');
```

**Note:** Current implementation still uses `src/logging/subsystem.ts`

---

## Known Issues & Limitations

### Integration Issues (Worktree E)

The following issues exist after merging all worktrees:

1. **Type Mismatches:** API controllers (Worktree C) use different action types than Use Cases (Worktree A)
2. **Missing Wiring:** DI container doesn't fully wire all services/controllers
3. **Dual Code Paths:** Both old and new code exist simultaneously

### Resolution Plan

1. Update API controllers to use core domain types
2. Complete DI container wiring
3. Migrate tests to new structure
4. Remove legacy code after full migration

---

## Testing

### Test Structure

```
src/__tests__/
├── unit/              # Unit tests (legacy + new)
├── integration/       # Integration tests (legacy + new)
├── contract/          # API contract tests
├── e2e/              # End-to-end tests
├── support/          # Test utilities
├── factories/        # Test data factories
└── mocks/            # Mock implementations
```

### Running Tests

```bash
# All tests
npm test

# By category
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e

# With coverage
npm run test:coverage
```

---

## Migration Status

| Component | Status | Notes |
|-----------|--------|-------|
| Core Services | ✅ Complete | Worktree A |
| Adapters | ✅ Complete | Worktree B |
| API Layer | ⚠️ Partial | Worktree C - type mismatches |
| Config | ✅ Complete | Worktree D |
| DI Container | ⚠️ Partial | Worktree D - needs wiring |
| Shared Utils | ✅ Complete | Worktree D |
| Tests | ❌ Pending | Still use legacy imports |
| Documentation | ⚠️ In Progress | This document |

---

## Next Steps

1. **Fix Type Mismatches:** Align API controllers with Use Case types
2. **Complete DI Wiring:** Update container to instantiate all components
3. **Migrate Tests:** Update test imports to new structure
4. **Remove Legacy Code:** Delete old directories after full migration
5. **Update Documentation:** Complete README, API docs

---

## Support

For questions or issues:
- Check existing documentation in `docs/`
- Review worktree commit history
- Contact the refactoring team

---

**Version:** 1.0  
**Last Updated:** 2026-03-04
