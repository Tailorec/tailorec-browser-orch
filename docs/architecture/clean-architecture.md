# Clean Architecture Implementation

**Status:** In Progress (Worktree E Integration)  
**Date:** 2026-03-04

---

## Overview

This document describes the Clean Architecture implementation in Tailorec Browser Service.

---

## Architecture Layers

### Layer Diagram

```
                    ┌─────────────────┐
                    │     API Layer   │  (Outermost)
                    │  Controllers,   │
                    │   Routes, DTOs  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Adapters Layer │
                    │  Infrastructure │
                    │  Implementations│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Core Layer    │  (Innermost)
                    │  Entities, Use  │
                    │   Cases, Ports  │
                    └─────────────────┘
```

### Directory Structure

```
src/
├── core/                    # Domain layer (business logic)
│   ├── entities/            # Business entities
│   │   ├── browser-session.entity.ts
│   │   ├── tab.entity.ts
│   │   └── profile.entity.ts
│   ├── services/            # Domain services
│   │   ├── session.service.ts
│   │   ├── interaction.service.ts
│   │   ├── snapshot.service.ts
│   │   ├── discovery.service.ts
│   │   └── navigation.service.ts
│   ├── ports/               # Interface definitions
│   │   ├── browser-driver.port.ts
│   │   ├── session-store.port.ts
│   │   └── event-bus.port.ts
│   └── use-cases/           # Application use cases
│       ├── execute-action.use-case.ts
│       ├── take-snapshot.use-case.ts
│       └── start-session.use-case.ts
│
├── adapters/                # Infrastructure layer
│   ├── playwright/          # Playwright implementations
│   │   ├── playwright.browser-driver.adapter.ts
│   │   ├── playwright.snapshot.adapter.ts
│   │   ├── playwright.interactions.adapter.ts
│   │   ├── playwright.discovery.adapter.ts
│   │   └── playwright.navigation.adapter.ts
│   ├── chrome/              # Chrome browser implementations
│   │   ├── chrome-launcher.adapter.ts
│   │   ├── chrome-executables.adapter.ts
│   │   └── extension-relay.server.ts
│   ├── http/                # HTTP server adapters
│   │   ├── express.server.adapter.ts
│   │   └── express.middleware.adapter.ts
│   └── logging/             # Logging adapters
│       └── logger.adapter.ts
│
├── api/                     # Interface layer
│   ├── controllers/         # HTTP request handlers
│   │   ├── simple-action.controller.ts
│   │   ├── form-action.controller.ts
│   │   ├── advanced-action.controller.ts
│   │   ├── snapshot.controller.ts
│   │   ├── hooks.controller.ts
│   │   ├── basic.controller.ts
│   │   └── control.controller.ts
│   ├── routes/              # Route definitions
│   │   ├── action.routes.ts
│   │   ├── snapshot.routes.ts
│   │   ├── hooks.routes.ts
│   │   ├── basic.routes.ts
│   │   └── control.routes.ts
│   ├── validators/          # Request validators
│   │   └── action.validator.ts
│   └── middlewares/         # Express middlewares
│       ├── correlation.middleware.ts
│       ├── logging.middleware.ts
│       └── error.middleware.ts
│
├── config/                  # Configuration
│   ├── config.ts
│   ├── config.types.ts
│   ├── config.validators.ts
│   └── index.ts
│
├── container/               # Dependency injection
│   ├── container.ts
│   ├── container.types.ts
│   └── index.ts
│
├── shared/                  # Cross-cutting utilities
│   ├── errors/              # Error classes
│   │   ├── browser.error.ts
│   │   ├── domain.error.ts
│   │   └── validation.error.ts
│   ├── types/               # Type utilities
│   │   ├── optional.type.ts
│   │   └── result.type.ts
│   └── utils/               # Helper functions
│       ├── number.utils.ts
│       ├── string.utils.ts
│       ├── object.utils.ts
│       └── timeout.utils.ts
│
└── server.ts                # Entry point
```

---

## Dependency Rule

Dependencies always point **inward**:

```
API → Adapters → Core
     Config → Core
     Container → All layers
```

**Core layer has NO dependencies on outer layers.**

---

## Layer Responsibilities

### Core Layer (Domain)

**Purpose:** Business logic, domain rules

**Components:**
- **Entities:** Business objects (BrowserSession, Tab, Profile)
- **Services:** Domain operations (SessionService, InteractionService)
- **Ports:** Interface contracts (IBrowserDriver, ISessionStore)
- **Use Cases:** Application operations (ExecuteActionUseCase)

**Dependencies:** None (innermost layer)

**Testing:** Pure unit tests, no mocks needed for domain logic

### Adapters Layer (Infrastructure)

**Purpose:** External system implementations

**Components:**
- **Playwright Adapters:** Browser automation via Playwright
- **Chrome Adapters:** Chrome browser launcher
- **HTTP Adapters:** Express server implementation
- **Logging Adapters:** Pino logger implementation

**Dependencies:** Core ports (implements IBrowserDriver, etc.)

**Testing:** Integration tests, mock external systems

### API Layer (Interface)

**Purpose:** HTTP API, request/response handling

**Components:**
- **Controllers:** Request handlers
- **Routes:** Endpoint definitions
- **Validators:** Request validation (Zod schemas)
- **Middlewares:** Cross-cutting HTTP concerns

**Dependencies:** Core use cases, adapters

**Testing:** Contract tests, integration tests

### Config Layer

**Purpose:** Configuration management

**Components:**
- Config loader
- Type definitions
- Validators

**Dependencies:** None (shared utility)

### Container Layer

**Purpose:** Dependency injection

**Components:**
- DI container factory
- Service registration

**Dependencies:** All layers (wires everything together)

### Shared Layer

**Purpose:** Cross-cutting utilities

**Components:**
- Error classes
- Type utilities
- Helper functions

**Dependencies:** None (shared utility)

---

## Key Design Patterns

### Dependency Injection

```typescript
import { createContainer } from './container/container.js';

const container = createContainer(config);

// Access services
const sessionService = container.sessionService;
const snapshotService = container.snapshotService;
```

### Port-Adapter Pattern

```typescript
// Port (Core)
export interface IBrowserDriver {
  connect(cdpUrl: string): Promise<Browser>;
  disconnect(browser: Browser): Promise<void>;
}

// Adapter (Infrastructure)
export class PlaywrightBrowserDriverAdapter implements IBrowserDriver {
  async connect(cdpUrl: string): Promise<Browser> {
    // Playwright implementation
  }

  async disconnect(browser: Browser): Promise<void> {
    // Playwright implementation
  }
}
```

### Use Case Pattern

```typescript
export class ExecuteActionUseCase {
  constructor(
    private sessionService: SessionService,
    private interactionService: InteractionService,
    private discoveryService: DiscoveryService,
  ) {}

  async execute(request: ExecuteActionRequest): Promise<ExecuteActionResponse> {
    // Orchestrate services to perform action
  }
}
```

---

## Migration Status

| Layer | Status | Notes |
|-------|--------|-------|
| Core | ✅ Complete | Worktree A |
| Adapters | ✅ Complete | Worktree B |
| API | ⚠️ Partial | Worktree C - type mismatches |
| Config | ✅ Complete | Worktree D |
| Container | ⚠️ Partial | Worktree D - needs wiring |
| Shared | ✅ Complete | Worktree D |

---

## Benefits

### Testability

- Core logic isolated from infrastructure
- Easy to mock external dependencies
- Fast unit tests

### Maintainability

- Clear separation of concerns
- Changes localized to layers
- Reduced coupling

### Flexibility

- Swap adapters without changing business logic
- Multiple implementations of same port
- Easy to add new features

---

## Challenges

### Integration Complexity

Merging separately developed worktrees creates type mismatches that need resolution.

### Runtime Composition

The runtime now starts from `src/main.ts` and composes only the clean-architecture layers:
`api`, `adapters`, `core`, `config`, `container`, and `shared`.

### Test Migration

Tests still reference legacy code - gradual migration required.

---

## Next Steps

1. **Fix Type Mismatches:** Align API controllers with Core types
2. **Complete DI Wiring:** Wire all services in container
3. **Migrate Tests:** Update test imports to new structure
4. **Remove Legacy:** Delete old directories after full migration

---

**Version:** 1.0  
**Last Updated:** 2026-03-04
