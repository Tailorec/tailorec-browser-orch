# 📋 Task Document: Worktree D — Shared & Config

**Branch:** `refactor/worktree-d-shared`  
**Priority:** 🟡 P1 (Can parallelize with C)  
**Estimated Time:** 1-2 days  
**Owner:** Mid-Level Developer

---

## 🎯 Objective

Create the **Shared & Config** layer containing cross-cutting utilities, error hierarchy, configuration management, and the DI container. This layer provides foundational utilities used by all other layers.

### Dependencies

- **Blocks:** Worktree E (Integration)
- **Blocked by:** Worktree A (Core) - needs to know what utilities are needed
- **Can start:** Anytime after Worktree A defines entities/services

---

## 📁 Deliverables

### Directory Structure to Create

```
src/shared/
├── errors/
│   ├── domain.error.ts                # ~50 lines
│   ├── validation.error.ts            # ~60 lines
│   ├── browser.error.ts               # ~100 lines
│   └── index.ts                       # ~20 lines
│
├── types/
│   ├── result.type.ts                 # ~80 lines
│   ├── optional.type.ts               # ~50 lines
│   └── index.ts                       # ~15 lines
│
└── utils/
    ├── string.utils.ts                # ~80 lines
    ├── number.utils.ts                # ~60 lines
    ├── object.utils.ts                # ~70 lines
    ├── timeout.utils.ts               # ~50 lines
    └── index.ts                       # ~20 lines

src/config/
├── config.ts                          # ~150 lines
├── config.types.ts                    # ~100 lines
└── config.validators.ts               # ~120 lines

src/container/
├── container.ts                       # ~200 lines
└── container.types.ts                 # ~80 lines
```

---

## 🔨 Implementation Details

### Step 1: Error Hierarchy (Day 1, Morning)

#### `src/shared/errors/domain.error.ts`

```typescript
// Expected content (~50 lines)
/**
 * Base class for all domain errors
 */
export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
    };
  }
}
```

#### `src/shared/errors/validation.error.ts`

```typescript
// Expected content (~60 lines)
import { DomainError } from './domain.error.js';

/**
 * Error thrown when validation fails
 */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly fieldErrors: Array<{ field: string; message: string }>,
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      { fieldErrors },
    );
  }

  static fromZodError(zodError: any): ValidationError {
    const fieldErrors = zodError.errors?.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
    })) ?? [];

    return new ValidationError(
      `Validation failed: ${fieldErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
      fieldErrors,
    );
  }
}

/**
 * Error thrown when input is invalid
 */
export class InvalidInputError extends DomainError {
  constructor(message: string, field?: string) {
    super(
      message,
      'INVALID_INPUT',
      400,
      field ? { field } : undefined,
    );
  }
}
```

#### `src/shared/errors/browser.error.ts`

```typescript
// Expected content (~100 lines)
import { DomainError } from './domain.error.js';

/**
 * Error thrown when browser action fails
 */
export class BrowserError extends DomainError {
  constructor(
    message: string,
    code: string = 'BROWSER_ERROR',
    status: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message, code, status, details);
  }
}

/**
 * Error thrown when element is not found
 */
export class ElementNotFoundError extends BrowserError {
  constructor(
    public readonly ref: string,
    public readonly url?: string,
  ) {
    super(
      `Element [ref=${ref}] not found`,
      'ELEMENT_NOT_FOUND',
      404,
      { ref, url },
    );
  }
}

/**
 * Error thrown when action times out
 */
export class TimeoutError extends BrowserError {
  constructor(
    public readonly action: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `Action "${action}" timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      408,
      { action, timeoutMs },
    );
  }
}

/**
 * Error thrown when element reference is stale
 */
export class StaleElementError extends BrowserError {
  constructor(public readonly ref: string) {
    super(
      `Element [ref=${ref}] is stale. Take a new snapshot.`,
      'STALE_ELEMENT',
      409,
      { ref },
    );
  }
}

/**
 * Error thrown when browser is not available
 */
export class BrowserNotAvailableError extends BrowserError {
  constructor() {
    super(
      'Browser is not available. Please start the browser first.',
      'BROWSER_NOT_AVAILABLE',
      503,
    );
  }
}
```

---

### Step 2: Utility Types (Day 1, Late Morning)

#### `src/shared/types/result.type.ts`

```typescript
// Expected content (~80 lines)
/**
 * Result type for operations that can fail
 * Inspired by Rust's Result<T, E>
 */
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a successful result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Map over the success value
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return { ok: true, value: fn(result.value) };
  }
  return result;
}

/**
 * Map over the error
 */
export function mapErrorResult<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (result.ok) {
    return result;
  }
  return { ok: false, error: fn(result.error) };
}

/**
 * Unwrap result or throw error
 */
export function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error instanceof Error ? result.error : new Error(String(result.error));
}
```

#### `src/shared/types/optional.type.ts`

```typescript
// Expected content (~50 lines)
/**
 * Optional type for values that may be absent
 */
export type Optional<T> = 
  | { present: true; value: T }
  | { present: false };

/**
 * Create a present optional
 */
export function some<T>(value: T): Optional<T> {
  return { present: true, value };
}

/**
 * Create an absent optional
 */
export function none<T>(): Optional<T> {
  return { present: false };
}

/**
 * Map over the value if present
 */
export function mapOptional<T, U>(
  optional: Optional<T>,
  fn: (value: T) => U,
): Optional<U> {
  if (optional.present) {
    return some(fn(optional.value));
  }
  return none();
}

/**
 * Get value or default
 */
export function getOrElse<T>(optional: Optional<T>, defaultValue: T): T {
  return optional.present ? optional.value : defaultValue;
}
```

---

### Step 3: Utility Functions (Day 1, Afternoon)

#### `src/shared/utils/string.utils.ts`

```typescript
// Expected content (~80 lines)
/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => char?.toUpperCase() ?? '')
    .replace(/^[A-Z]/, char => char.toLowerCase());
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Redact sensitive information
 */
export function redactSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitivePatterns = ['password', 'pwd', 'secret', 'token', 'authorization', 'api_key'];
  const redacted = { ...obj };

  for (const [key, value] of Object.entries(redacted)) {
    const keyLower = key.toLowerCase();
    if (sensitivePatterns.some(pattern => keyLower.includes(pattern))) {
      redacted[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>);
    }
  }

  return redacted;
}

/**
 * Generate random string
 */
export function randomString(length: number = 16): string {
  return Array.from({ length }, () => 
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      .charAt(Math.floor(Math.random() * 62))
  ).join('');
}
```

#### `src/shared/utils/number.utils.ts`

```typescript
// Expected content (~60 lines)
/**
 * Clamp number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Parse number with fallback
 */
export function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Calculate percentage
 */
export function percentage(part: number, whole: number): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}
```

#### `src/shared/utils/timeout.utils.ts`

```typescript
// Expected content (~50 lines)
/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage?: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage ?? `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    maxDelayMs?: number;
  } = {},
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, maxDelayMs = 10000 } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        const delay = Math.min(delayMs * Math.pow(2, attempt - 1), maxDelayMs);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}
```

#### `src/shared/utils/object.utils.ts`

```typescript
// Expected content (~70 lines)
/**
 * Deep clone an object
 */
export function deepClone<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick specific keys from object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Partial<T>>
): T {
  const result = { ...target };
  
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'object' && value !== null && key in result) {
        const targetValue = result[key as keyof T];
        if (typeof targetValue === 'object' && targetValue !== null) {
          result[key as keyof T] = deepMerge(
            targetValue as Record<string, unknown>,
            value as Record<string, unknown>,
          ) as T[keyof T];
        } else {
          result[key as keyof T] = value as T[keyof T];
        }
      } else {
        result[key as keyof T] = value as T[keyof T];
      }
    }
  }
  
  return result;
}
```

---

### Step 4: Configuration (Day 1, Late Afternoon)

#### `src/config/config.types.ts`

```typescript
// Expected content (~100 lines)
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'json' | 'pretty';

export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserProfileConfig {
  name: string;
  cdpPort?: number;
  cdpUrl?: string;
  driver?: 'chrome' | 'extension';
  color?: string;
}

export interface AppConfig {
  // Server
  port: number;
  host: string;
  
  // Browser
  browser: {
    enabled: boolean;
    headless: boolean;
    noSandbox?: boolean;
    profiles: Record<string, BrowserProfileConfig>;
    evaluateEnabled: boolean;
    viewport: BrowserViewport;
  };
  
  // Logging
  logging: {
    level: LogLevel;
    format: LogFormat;
    toFile: boolean;
    filePath: string;
    maxBytes: number;
    backupCount: number;
  };
  
  // Security
  security: {
    corsEnabled: boolean;
    rateLimitEnabled: boolean;
  };
  
  // Environment
  nodeEnv: 'development' | 'production' | 'test';
}
```

#### `src/config/config.validators.ts`

```typescript
// Expected content (~120 lines)
import { z } from 'zod';
import type { AppConfig } from './config.types.js';

const BrowserProfileSchema = z.object({
  name: z.string(),
  cdpPort: z.number().min(1024).max(65535).optional(),
  cdpUrl: z.string().url().optional(),
  driver: z.enum(['chrome', 'extension']).optional().default('chrome'),
  color: z.string().optional(),
});

const AppConfigSchema = z.object({
  // Server
  port: z.number().min(1).max(65535),
  host: z.string().default('127.0.0.1'),
  
  // Browser
  browser: z.object({
    enabled: z.boolean().default(true),
    headless: z.boolean().default(false),
    noSandbox: z.boolean().optional(),
    profiles: z.record(BrowserProfileSchema),
    evaluateEnabled: z.boolean().default(true),
    viewport: z.object({
      width: z.number().min(100).max(7680),
      height: z.number().min(100).max(4320),
    }),
  }),
  
  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
    toFile: z.boolean().default(true),
    filePath: z.string().default('logs/app.log'),
    maxBytes: z.number().min(1024).default(10 * 1024 * 1024),
    backupCount: z.number().min(0).max(100).default(5),
  }),
  
  // Security
  security: z.object({
    corsEnabled: z.boolean().default(false),
    rateLimitEnabled: z.boolean().default(false),
  }),
  
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export function validateConfig(raw: unknown): AppConfig {
  const result = AppConfigSchema.safeParse(raw);
  
  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    throw new Error(`Config validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
  }
  
  return result.data;
}
```

#### `src/config/config.ts`

```typescript
// Expected content (~150 lines)
import type { AppConfig, BrowserViewport } from './config.types.js';
import { validateConfig } from './config.validators.js';
import { createSubsystemLogger } from '../adapters/logging/logger.adapter.js';

const log = createSubsystemLogger('config');

const DEFAULT_CONFIG: AppConfig = {
  port: 4000,
  host: '127.0.0.1',
  browser: {
    enabled: true,
    headless: false,
    profiles: {
      default: {
        name: 'default',
        cdpPort: 9222,
        driver: 'chrome',
        color: 'blue',
      },
    },
    evaluateEnabled: true,
    viewport: { width: 1280, height: 720 },
  },
  logging: {
    level: 'info',
    format: 'json',
    toFile: true,
    filePath: 'logs/app.log',
    maxBytes: 10 * 1024 * 1024,
    backupCount: 5,
  },
  security: {
    corsEnabled: false,
    rateLimitEnabled: false,
  },
  nodeEnv: 'development',
};

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseViewportEnv(value: string | undefined, fallback: BrowserViewport): BrowserViewport {
  if (!value) return fallback;
  
  const match = value.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return fallback;
  
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return fallback;
  }
  
  return { width: Math.floor(width), height: Math.floor(height) };
}

export function loadConfig(): AppConfig {
  const rawConfig = {
    ...DEFAULT_CONFIG,
    port: Number(process.env.PORT) || 4000,
    browser: {
      ...DEFAULT_CONFIG.browser,
      headless: parseBooleanEnv(
        process.env.BROWSER_HEADLESS ?? process.env.HEADLESS,
        DEFAULT_CONFIG.browser.headless,
      ),
      viewport: parseViewportEnv(
        process.env.BROWSER_VIEWPORT,
        DEFAULT_CONFIG.browser.viewport,
      ),
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      level: (process.env.LOG_LEVEL as any) ?? DEFAULT_CONFIG.logging.level,
      format: (process.env.LOG_FORMAT as any) ?? DEFAULT_CONFIG.logging.format,
      toFile: parseBooleanEnv(process.env.LOG_TO_FILE, DEFAULT_CONFIG.logging.toFile),
    },
    nodeEnv: (process.env.NODE_ENV as any) ?? 'development',
  };
  
  const config = validateConfig(rawConfig);
  
  log.info('config loaded', {
    port: config.port,
    headless: config.browser.headless,
    viewport: `${config.browser.viewport.width}x${config.browser.viewport.height}`,
    log_level: config.logging.level,
  });
  
  return config;
}
```

---

### Step 5: DI Container (Day 2)

#### `src/container/container.types.ts`

```typescript
// Expected content (~80 lines)
import type { Logger } from '../shared/utils/logger.js';
import type { IBrowserDriver } from '../core/ports/browser-driver.port.js';
import type { ISessionStore } from '../core/ports/session-store.port.js';
import type { IEventBus } from '../core/ports/event-bus.port.js';
import type { SessionService } from '../core/services/session.service.js';
import type { SnapshotService } from '../core/services/snapshot.service.js';
import type { InteractionService } from '../core/services/interaction.service.js';
import type { DiscoveryService } from '../core/services/discovery.service.js';
import type { ExecuteActionUseCase } from '../core/use-cases/execute-action.use-case.js';
import type { TakeSnapshotUseCase } from '../core/use-cases/take-snapshot.use-case.js';

export interface Container {
  // Infrastructure
  logger: Logger;
  browserDriver: IBrowserDriver;
  sessionStore: ISessionStore;
  eventBus: IEventBus;
  
  // Services
  sessionService: SessionService;
  snapshotService: SnapshotService;
  interactionService: InteractionService;
  discoveryService: DiscoveryService;
  
  // Use Cases
  executeActionUseCase: ExecuteActionUseCase;
  takeSnapshotUseCase: TakeSnapshotUseCase;
}

export type ContainerKey = keyof Container;
```

#### `src/container/container.ts`

```typescript
// Expected content (~200 lines)
import type { Container } from './container.types.js';
import type { AppConfig } from '../config/config.types.js';
import { createSubsystemLogger } from '../adapters/logging/logger.adapter.js';
import { PlaywrightBrowserDriverAdapter } from '../adapters/playwright/playwright.browser-driver.adapter.js';
import { PlaywrightSnapshotAdapter } from '../adapters/playwright/playwright.snapshot.adapter.js';
import { PlaywrightInteractionsAdapter } from '../adapters/playwright/playwright.interactions.adapter.js';
import { PlaywrightDiscoveryAdapter } from '../adapters/playwright/playwright.discovery.adapter.js';
import { SessionService } from '../core/services/session.service.js';
import { SnapshotService } from '../core/services/snapshot.service.js';
import { InteractionService } from '../core/services/interaction.service.js';
import { DiscoveryService } from '../core/services/discovery.service.js';
import { ExecuteActionUseCase } from '../core/use-cases/execute-action.use-case.js';
import { TakeSnapshotUseCase } from '../core/use-cases/take-snapshot.use-case.js';

/**
 * Create dependency injection container
 */
export function createContainer(config: AppConfig): Container {
  // Infrastructure
  const logger = createSubsystemLogger('app');
  const browserDriver = new PlaywrightBrowserDriverAdapter();
  const sessionStore = createInMemorySessionStore();
  const eventBus = createInMemoryEventBus();
  
  // Services
  const sessionService = new SessionService(browserDriver, sessionStore);
  const snapshotService = new SnapshotService();
  const interactionService = new InteractionService();
  const discoveryService = new DiscoveryService();
  
  // Use Cases
  const executeActionUseCase = new ExecuteActionUseCase(
    sessionService,
    interactionService,
  );
  const takeSnapshotUseCase = new TakeSnapshotUseCase(
    sessionService,
    snapshotService,
  );
  
  return {
    // Infrastructure
    logger,
    browserDriver,
    sessionStore,
    eventBus,
    
    // Services
    sessionService,
    snapshotService,
    interactionService,
    discoveryService,
    
    // Use Cases
    executeActionUseCase,
    takeSnapshotUseCase,
  };
}

function createInMemorySessionStore(): ISessionStore {
  // Implementation
  return {} as ISessionStore;
}

function createInMemoryEventBus(): IEventBus {
  // Implementation
  return {} as IEventBus;
}
```

---

## ✅ Tests That Must Pass

### Unit Tests

```bash
# Config tests
npm run test:unit -- src/__tests__/unit/config.unit.test.ts

# Utility tests
npm run test:unit -- src/__tests__/unit/infra-utilities.unit.test.ts
npm run test:unit -- src/__tests__/unit/pw-tools-core-shared.unit.test.ts

# Error tests (new)
npm run test:unit -- src/__tests__/unit/domain-error.unit.test.ts
```

### All Tests

```bash
# Verify nothing is broken
npm run test
```

---

## 🤖 AI Agent Prompt

```
You are helping refactor the Tailorec Browser Service to Clean Architecture.

CONTEXT:
- We are implementing Worktree D: Shared & Config
- Branch: refactor/worktree-d-shared
- Goal: Create shared utilities, error hierarchy, config, and DI container
- Max file size: 300 lines

TASK:
Help me create the following files:

SHARED:
1. src/shared/errors/domain.error.ts
2. src/shared/errors/validation.error.ts
3. src/shared/errors/browser.error.ts
4. src/shared/types/result.type.ts
5. src/shared/types/optional.type.ts
6. src/shared/utils/string.utils.ts
7. src/shared/utils/number.utils.ts
8. src/shared/utils/timeout.utils.ts
9. src/shared/utils/object.utils.ts

CONFIG:
10. src/config/config.types.ts
11. src/config/config.validators.ts
12. src/config/config.ts

CONTAINER:
13. src/container/container.types.ts
14. src/container/container.ts

CONSTRAINTS:
- Error hierarchy extends DomainError base class
- Utilities are pure functions
- Config uses Zod validation
- Container wires all dependencies
- Keep files under 300 lines

SOURCE FILES:
- src/browser/config.ts (154 lines)
- src/logging/subsystem.ts (263 lines)
- src/infra/errors.ts (7 lines)
- src/browser/pw-tools-core.shared.ts (70 lines)

Please help me create [SPECIFIC_FILE].
```

---

## 📝 Definition of Done

- [ ] All 14 files created
- [ ] Error hierarchy with base `DomainError` class
- [ ] Result/Optional types for functional patterns
- [ ] All utility functions pure and tested
- [ ] Config loading with Zod validation
- [ ] DI container wires all dependencies
- [ ] All unit tests pass
- [ ] No file exceeds 300 lines
- [ ] TypeScript compilation succeeds
- [ ] No circular dependencies
- [ ] Code reviewed by team member

---

**Created:** 2026-03-04  
**Version:** 1.0  
**Status:** Ready for Implementation
