# 📋 Task Document: Worktree C — API Layer

**Branch:** `refactor/worktree-c-api`  
**Priority:** 🟡 P1 (Depends on A & B)  
**Estimated Time:** 2-3 days  
**Owner:** Mid-Level Developer

---

## 🎯 Objective

Create the **API Layer** containing controllers, routes, validators, and middlewares. This layer handles HTTP requests, validates input, and delegates to use cases from Worktree A.

### Dependencies

- **Blocks:** Worktree E (Integration)
- **Blocked by:** Worktree A (Core), Worktree B (Adapters)
- **Can start:** After both A and B are complete

---

## 📁 Deliverables

### Directory Structure to Create

```
src/api/
├── controllers/
│   ├── snapshot.controller.ts           # ~180 lines
│   ├── action.controller.ts             # ~250 lines
│   ├── control.controller.ts            # ~150 lines
│   ├── hooks.controller.ts              # ~200 lines
│   └── basic.controller.ts              # ~120 lines
│
├── routes/
│   ├── snapshot.routes.ts               # ~100 lines
│   ├── action.routes.ts                 # ~120 lines
│   ├── control.routes.ts                # ~80 lines
│   ├── hooks.routes.ts                  # ~100 lines
│   └── basic.routes.ts                  # ~60 lines
│
├── validators/
│   ├── snapshot.validator.ts            # ~150 lines
│   ├── action.validator.ts              # ~200 lines
│   └── index.ts                         # ~20 lines
│
└── middlewares/
    ├── correlation.middleware.ts        # ~80 lines
    ├── error.middleware.ts              # ~120 lines
    ├── logging.middleware.ts            # ~100 lines
    └── index.ts                         # ~20 lines
```

---

## 🔨 Implementation Details

### Step 1: Validators (Day 1, Morning)

#### `src/api/validators/snapshot.validator.ts`

**Source:** Extract validation logic from `src/browser/routes/agent.snapshot.ts`

```typescript
// Expected content (~150 lines)
import { z } from 'zod';

export const SnapshotRequestSchema = z.object({
  targetId: z.string().optional(),
  timeoutMs: z.number().min(500).max(60000).optional(),
  maxChars: z.number().min(100).max(100000).optional(),
  interactiveOnly: z.boolean().optional().default(false),
  compact: z.boolean().optional().default(false),
  maxDepth: z.number().min(1).max(20).optional().default(10),
});

export type SnapshotRequestDTO = z.infer<typeof SnapshotRequestSchema>;

export class SnapshotValidator {
  validate(payload: unknown): SnapshotRequestDTO {
    const result = SnapshotRequestSchema.safeParse(payload);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new SnapshotValidationError(errors);
    }
    
    return result.data;
  }
}

export class SnapshotValidationError extends Error {
  constructor(
    public errors: Array<{ field: string; message: string }>,
  ) {
    super(`Snapshot validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'SnapshotValidationError';
  }
}
```

#### `src/api/validators/action.validator.ts`

**Source:** Extract validation logic from `src/browser/routes/agent.act.ts`

```typescript
// Expected content (~200 lines)
import { z } from 'zod';

const BaseActionSchema = z.object({
  targetId: z.string().optional(),
  timeoutMs: z.number().min(500).max(60000).optional(),
});

const ClickActionSchema = BaseActionSchema.extend({
  kind: z.literal('click'),
  ref: z.string(),
  doubleClick: z.boolean().optional(),
  button: z.enum(['left', 'right', 'middle']).optional(),
  modifiers: z.array(z.enum(['Alt', 'Control', 'Meta', 'Shift'])).optional(),
});

const TypeActionSchema = BaseActionSchema.extend({
  kind: z.literal('type'),
  ref: z.string(),
  text: z.string(),
  clear: z.boolean().optional(),
});

const FillActionSchema = BaseActionSchema.extend({
  kind: z.literal('fill'),
  fields: z.array(z.object({
    ref: z.string(),
    value: z.string(),
    type: z.enum(['text', 'email', 'phone', 'date', 'password']).optional(),
  })),
});

const NavigateActionSchema = BaseActionSchema.extend({
  kind: z.literal('navigate'),
  url: z.string().url(),
});

export const ActionRequestSchema = z.discriminatedUnion('kind', [
  ClickActionSchema,
  TypeActionSchema,
  FillActionSchema,
  NavigateActionSchema,
  // ... other action types
]);

export type ActionRequestDTO = z.infer<typeof ActionRequestSchema>;
export type ClickActionDTO = z.infer<typeof ClickActionSchema>;
export type TypeActionDTO = z.infer<typeof TypeActionSchema>;

export class ActionValidator {
  validateClick(payload: unknown): ClickActionDTO {
    return this.validate(payload, ClickActionSchema);
  }

  validateType(payload: unknown): TypeActionDTO {
    return this.validate(payload, TypeActionSchema);
  }

  validate(payload: unknown, schema: z.ZodSchema): any {
    const result = schema.safeParse(payload);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new ActionValidationError(errors);
    }
    
    return result.data;
  }
}

export class ActionValidationError extends Error {
  constructor(
    public errors: Array<{ field: string; message: string }>,
  ) {
    super(`Action validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'ActionValidationError';
  }
}
```

---

### Step 2: Controllers (Day 1, Afternoon - Day 2)

#### `src/api/controllers/snapshot.controller.ts`

**Source:** Extract from `src/browser/routes/agent.snapshot.ts`

```typescript
// Expected content (~180 lines)
import type { Request, Response } from 'express';
import type { TakeSnapshotUseCase } from '../../core/use-cases/take-snapshot.use-case.js';
import type { SnapshotRequestDTO } from '../validators/snapshot.validator.js';
import { SnapshotValidator } from '../validators/snapshot.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('snapshot-controller');

export class SnapshotController {
  constructor(
    private takeSnapshotUseCase: TakeSnapshotUseCase,
    private validator: SnapshotValidator,
  ) {}

  async handleSnapshot(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    log.info('snapshot request started', { 
      targetId: req.body.targetId,
      interactiveOnly: req.body.interactiveOnly,
    });

    try {
      // Validate request
      const dto = this.validator.validate(req.body);

      // Execute use case
      const result = await this.takeSnapshotUseCase.execute({
        targetId: dto.targetId,
        options: {
          timeoutMs: dto.timeoutMs,
          maxChars: dto.maxChars,
          interactiveOnly: dto.interactiveOnly,
          compact: dto.compact,
          maxDepth: dto.maxDepth,
        },
      });

      // Send response
      res.json({
        ok: true,
        targetId: result.targetId,
        url: result.url,
        snapshot: result.snapshot,
        refs: result.refs,
        truncated: result.truncated,
        stats: result.stats,
      });

      log.info('snapshot request completed', {
        duration_ms: Date.now() - started,
        chars: result.snapshot.length,
        refs: Object.keys(result.refs).length,
      });
    } catch (error) {
      log.exception('snapshot request failed', error);
      throw error; // Let error middleware handle it
    }
  }

  async handleSnapshotDelta(req: Request, res: Response): Promise<void> {
    // Implementation for delta snapshots
  }

  async handleSnapshotAria(req: Request, res: Response): Promise<void> {
    // Implementation for aria snapshots
  }
}
```

#### `src/api/controllers/action.controller.ts`

**Source:** Extract from `src/browser/routes/agent.act.ts`

```typescript
// Expected content (~250 lines)
import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('action-controller');

export class ActionController {
  constructor(
    private executeActionUseCase: ExecuteActionUseCase,
    private validator: ActionValidator,
  ) {}

  async handleClick(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    log.info('click request started', { ref: req.body.ref });

    try {
      const dto = this.validator.validateClick(req.body);

      const result = await this.executeActionUseCase.execute({
        action: {
          kind: 'click',
          ref: dto.ref,
          doubleClick: dto.doubleClick,
          button: dto.button,
          modifiers: dto.modifiers,
        },
        targetId: dto.targetId,
      });

      res.json({
        ok: true,
        targetId: result.targetId,
        url: result.url,
      });

      log.info('click request completed', {
        duration_ms: Date.now() - started,
        ref: dto.ref,
      });
    } catch (error) {
      log.exception('click request failed', error);
      throw error;
    }
  }

  async handleType(req: Request, res: Response): Promise<void> {
    // Similar pattern for type action
  }

  async handleFill(req: Request, res: Response): Promise<void> {
    // Similar pattern for fill action
  }

  async handleNavigate(req: Request, res: Response): Promise<void> {
    // Similar pattern for navigate action
  }
}
```

---

### Step 3: Routes (Day 2, Afternoon)

#### `src/api/routes/snapshot.routes.ts`

**Source:** Extract from `src/browser/routes/agent.snapshot.ts`

```typescript
// Expected content (~100 lines)
import type { Router } from 'express';
import type { SnapshotController } from '../controllers/snapshot.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

export function registerSnapshotRoutes(
  router: Router,
  controller: SnapshotController,
  middleware: MiddlewareRegistry,
): void {
  /**
   * POST /snapshot
   * Take a snapshot of the current page
   */
  router.post(
    '/snapshot',
    middleware.correlation,
    middleware.logging,
    controller.handleSnapshot.bind(controller),
  );

  /**
   * POST /snapshot/delta
   * Start/stop incremental snapshot observation
   */
  router.post(
    '/snapshot/delta',
    middleware.correlation,
    middleware.logging,
    controller.handleSnapshotDelta.bind(controller),
  );

  /**
   * POST /snapshot/aria
   * Take accessibility tree snapshot
   */
  router.post(
    '/snapshot/aria',
    middleware.correlation,
    middleware.logging,
    controller.handleSnapshotAria.bind(controller),
  );
}
```

#### `src/api/routes/action.routes.ts`

```typescript
// Expected content (~120 lines)
import type { Router } from 'express';
import type { ActionController } from '../controllers/action.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

export function registerActionRoutes(
  router: Router,
  controller: ActionController,
  middleware: MiddlewareRegistry,
): void {
  /**
   * POST /act/click
   * Click an element
   */
  router.post(
    '/act/click',
    middleware.correlation,
    middleware.logging,
    controller.handleClick.bind(controller),
  );

  /**
   * POST /act/type
   * Type text into input
   */
  router.post(
    '/act/type',
    middleware.correlation,
    middleware.logging,
    controller.handleType.bind(controller),
  );

  /**
   * POST /act/fill
   * Fill form fields
   */
  router.post(
    '/act/fill',
    middleware.correlation,
    middleware.logging,
    controller.handleFill.bind(controller),
  );

  /**
   * POST /act/navigate
   * Navigate to URL
   */
  router.post(
    '/act/navigate',
    middleware.correlation,
    middleware.logging,
    controller.handleNavigate.bind(controller),
  );
}
```

---

### Step 4: Middlewares (Day 3)

#### `src/api/middlewares/correlation.middleware.ts`

**Source:** Extract from `src/browser/server.ts`

```typescript
// Expected content (~80 lines)
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

const CORRELATION_HEADER = process.env.CORRELATION_ID_HEADER ?? 'x-correlation-id';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get or create correlation ID
  let correlationId = req.headers[CORRELATION_HEADER] as string | undefined;
  
  if (!correlationId) {
    correlationId = randomUUID();
  }

  // Set on response
  res.setHeader(CORRELATION_HEADER, correlationId);

  // Store in async context for logging
  // (Implementation depends on correlation ID context management)

  next();
}

export function getCorrelationId(req: Request): string {
  return req.headers[CORRELATION_HEADER] as string ?? 'unknown';
}
```

#### `src/api/middlewares/error.middleware.ts`

```typescript
// Expected content (~120 lines)
import type { Request, Response, NextFunction } from 'express';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('error-middleware');

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = res.getHeader('x-correlation-id') as string ?? 'unknown';

  log.exception('request failed', err, {
    correlation_id: correlationId,
    path: req.path,
    method: req.method,
  });

  // Map error to HTTP status
  const status = mapErrorToStatus(err);
  const message = mapErrorToMessage(err);

  res.status(status).json({
    ok: false,
    error: {
      type: err.name,
      message,
      correlation_id: correlationId,
    },
  });
}

function mapErrorToStatus(err: Error): number {
  if (err.name === 'ValidationError') return 400;
  if (err.name === 'NotFoundError') return 404;
  if (err.name === 'TimeoutError') return 408;
  if (err.name === 'ConflictError') return 409;
  if (err.name === 'ServiceUnavailableError') return 503;
  return 500;
}

function mapErrorToMessage(err: Error): string {
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    if (err.name === 'InternalError') return 'An internal error occurred';
  }
  return err.message;
}
```

#### `src/api/middlewares/logging.middleware.ts`

```typescript
// Expected content (~100 lines)
import type { Request, Response, NextFunction } from 'express';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('request-logging');

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  const correlationId = res.getHeader('x-correlation-id') as string ?? 'unknown';

  log.info('request started', {
    correlation_id: correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: sanitizeBody(req.body),
  });

  res.on('finish', () => {
    const duration = Date.now() - started;
    log.info('request completed', {
      correlation_id: correlationId,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: duration,
    });
  });

  next();
}

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'secret', 'token', 'authorization'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}
```

---

## ✅ Tests That Must Pass

### Integration Tests

```bash
# Snapshot integration
npm run test:integration -- src/__tests__/integration/agent-snapshot.integration.test.ts

# Act integration
npm run test:integration -- src/__tests__/integration/agent-act-validation.integration.test.ts
npm run test:integration -- src/__tests__/integration/routes/agent-act.integration.test.ts

# Control route integration
npm run test:integration -- src/__tests__/integration/control-route.integration.test.ts

# Status integration
npm run test:integration -- src/__tests__/integration/status.integration.test.ts
```

### Contract Tests

```bash
# All contract tests
npm run test:contract -- src/__tests__/contract/act.contract.test.ts
npm run test:contract -- src/__tests__/contract/control.contract.test.ts
npm run test:contract -- src/__tests__/contract/error-contracts.contract.test.ts
npm run test:contract -- src/__tests__/contract/header-contracts.contract.test.ts
npm run test:contract -- src/__tests__/contract/status.contract.test.ts
```

---

## 🤖 AI Agent Prompt

```
You are helping refactor the Tailorec Browser Service to Clean Architecture.

CONTEXT:
- We are implementing Worktree C: API Layer
- Branch: refactor/worktree-c-api
- Goal: Create controllers, routes, validators, and middlewares
- Max file size: 500 lines (controllers max 400)
- Worktree A provides use cases, Worktree B provides adapters

TASK:
Help me create the following files in src/api/:

1. src/api/validators/snapshot.validator.ts
2. src/api/validators/action.validator.ts
3. src/api/controllers/snapshot.controller.ts
4. src/api/controllers/action.controller.ts
5. src/api/controllers/control.controller.ts
6. src/api/controllers/hooks.controller.ts
7. src/api/controllers/basic.controller.ts
8. src/api/routes/snapshot.routes.ts
9. src/api/routes/action.routes.ts
10. src/api/routes/control.routes.ts
11. src/api/routes/hooks.routes.ts
12. src/api/routes/basic.routes.ts
13. src/api/middlewares/correlation.middleware.ts
14. src/api/middlewares/error.middleware.ts
15. src/api/middlewares/logging.middleware.ts

CONSTRAINTS:
- Controllers delegate to use cases from Worktree A
- Validators use Zod schemas
- Routes use Express Router
- Middlewares maintain current functionality
- Keep files under 500 lines (controllers max 400)
- Preserve API contracts (request/response formats)

SOURCE FILES:
- src/browser/routes/agent.act.ts (887 lines)
- src/browser/routes/agent.snapshot.ts (86 lines)
- src/browser/routes/control.ts (38 lines)
- src/browser/routes/control-live.ts (356 lines)
- src/browser/routes/basic.ts

Please help me create [SPECIFIC_FILE] by extracting logic from [SOURCE_FILE].
```

---

## 📝 Definition of Done

- [ ] All 15 files created
- [ ] All controllers delegate to use cases
- [ ] All validators use Zod schemas
- [ ] All routes use Express Router
- [ ] All middlewares maintain functionality
- [ ] No file exceeds 500 lines (controllers max 400)
- [ ] All integration tests pass
- [ ] All contract tests pass
- [ ] Request/response contracts unchanged
- [ ] TypeScript compilation succeeds
- [ ] No circular dependencies
- [ ] Code reviewed by team member

---

**Created:** 2026-03-04  
**Version:** 1.0  
**Status:** Ready for Implementation
