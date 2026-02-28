# Test Suite Documentation

## Overview

This test suite provides comprehensive coverage for the Tailorec Browser Service using **Vitest** for unit/integration/contract tests and **Playwright Test** for E2E tests.

### Testing Philosophy

- **Fast feedback**: Unit tests run in milliseconds
- **Isolation**: Each test is independent and doesn't rely on external state
- **Realistic coverage**: Integration tests verify real HTTP contracts
- **Contract-first**: Contract tests ensure API consistency

### Test Pyramid

```
        /\
       /  \      E2E (few, slow, high confidence)
      /----\
     /      \    Integration (some, medium speed)
    /--------\
   /          \  Unit (many, fast, isolated)
  /------------\
```

---

## Quick Start

### Running All Tests

```bash
npm run test
```

### Running by Category

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Contract tests only
npm run test:contract

# E2E tests only
npm run test:e2e
```

### Running Single File

```bash
# Run specific test file
npx vitest run src/__tests__/unit/config.unit.test.ts

# Run with watch mode
npx vitest src/__tests__/unit/config.unit.test.ts
```

### Running with Coverage

```bash
# Phase 1: 35% lines, 60% functions
npm run test:coverage:phase1

# Phase 2: 50% lines, 65% functions
npm run test:coverage:phase2

# Phase 3: 70% all thresholds
npm run test:coverage:phase3
```

---

## Test Categories

### Unit Tests

**Location:** `src/__tests__/unit/`

**Purpose:** Test individual functions, classes, and modules in isolation.

**When to write:**
- Testing pure functions (e.g., config parsing, data transformation)
- Testing utility functions
- Testing factories and helpers

**How to write:**
```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../browser/config.js';

describe('config loading', () => {
  it('loads defaults', () => {
    const cfg = loadConfig();
    expect(cfg.browser.headless).toBe(true);
  });
});
```

### Integration Tests

**Location:** `src/__tests__/integration/`

**Purpose:** Test interactions between components (HTTP routes, database, external services).

**When to write:**
- Testing API endpoints
- Testing route handlers
- Testing multi-component workflows

**How to write:**
```typescript
import { describe, it, expect } from 'vitest';
import { withTestServer } from '@/__tests__/helpers';
import { ApiClient } from '@/__tests__/helpers';

describe('POST /snapshot', () => {
  it('returns snapshot', async () => {
    await withTestServer(async (state) => {
      const client = ApiClient.fromTestServer(state);
      const response = await client.post('/snapshot', {});
      expect(response.ok).toBe(true);
    });
  });
});
```

### Contract Tests

**Location:** `src/__tests__/contract/`

**Purpose:** Verify API response structures, header contracts, and error formats.

**When to write:**
- Verifying HTTP response schemas
- Testing header propagation
- Ensuring error response consistency

**How to write:**
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestServer } from '@/__tests__/helpers';

describe('contract: Response headers', () => {
  it('includes correlation ID', async () => {
    const server = await createTestServer();
    const response = await request(server).get('/status');
    expect(response.headers['x-correlation-id']).toBeDefined();
  });
});
```

### E2E Tests

**Location:** `src/__tests__/e2e/`

**Purpose:** Test complete user workflows with real browser interactions.

**When to write:**
- Testing critical user journeys
- Verifying browser automation
- Testing end-to-end flows

**How to write:**
```typescript
import { test, expect } from '@playwright/test';

test('snapshot and act workflow', async ({ page }) => {
  await page.goto('http://localhost:4000');
  // Test browser automation
});
```

---

## Test Structure

### Directory Layout

```
src/__tests__/
├── unit/                          # Unit tests
├── integration/                   # Integration tests
├── contract/                      # Contract tests
├── e2e/                          # E2E tests (Playwright)
├── helpers/                      # Test utilities
├── factories/                    # Test data factories
├── fixtures/                     # Test fixtures
└── __mocks__/                   # Mock implementations
```

### Naming Conventions

- **Unit tests:** `*.unit.test.ts`
- **Integration tests:** `*.integration.test.ts`
- **Contract tests:** `*.contract.test.ts`
- **E2E tests:** `*.e2e.test.ts` or `*.spec.ts`

### File Organization

Each test file should:
1. Focus on a single module or feature
2. Use descriptive `describe` blocks
3. Follow the pattern: `feature.action.unit.test.ts`

---

## Writing Tests

### Test Templates

#### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('feature name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    // Arrange
    // Act
    // Assert
    expect(actual).toBe(expected);
  });
});
```

#### Integration Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { withTestServer, ApiClient } from '@/__tests__/helpers';

describe('API endpoint', () => {
  it('should handle request', async () => {
    await withTestServer(async (state) => {
      const client = ApiClient.fromTestServer(state);
      const response = await client.post('/endpoint', { data: 'value' });
      expect(response.status).toBe(200);
    });
  });
});
```

### Best Practices

1. **Use AAA pattern:** Arrange, Act, Assert
2. **One assertion per concept:** Group related assertions
3. **Descriptive test names:** `it('should return error when input is invalid')`
4. **Isolation:** No shared state between tests
5. **Deterministic:** No random values without seeding

### Common Patterns

#### Testing Async Code

```typescript
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

#### Testing Errors

```typescript
it('should throw on invalid input', () => {
  expect(() => parseInput('')).toThrow('Invalid input');
});
```

#### Using Factories

```typescript
import { createMockPage } from '@/__tests__/factories';

it('should click element', () => {
  const page = createMockPage({ url: 'https://example.com' });
  // Test with factory-created mock
});
```

### Anti-Patterns to Avoid

❌ **Don't:** Test multiple things in one test
```typescript
it('should validate and save and send email', () => {
  // Too many responsibilities
});
```

✅ **Do:** Split into separate tests
```typescript
it('should validate input', () => {});
it('should save to database', () => {});
it('should send email', () => {});
```

❌ **Don't:** Use `any` type
```typescript
const data: any = getData();
```

✅ **Do:** Use proper types
```typescript
const data: TestData = getData();
```

---

## Test Utilities

### Helpers

Located in `src/__tests__/helpers/`:

| Helper | Description |
|--------|-------------|
| `createTestServer` | Create test HTTP server |
| `withTestServer` | Server with automatic cleanup |
| `ApiClient` | HTTP client for integration tests |
| `assert*` | Assertion helper functions |

### Factories

Located in `src/__tests__/factories/`:

| Factory | Description |
|---------|-------------|
| `test-data.factory` | Generate unique test data |
| `request.factory` | Create API request payloads |
| `response.factory` | Create API response objects |
| `page-state.factory` | Create mock Playwright objects |
| `error.factory` | Create error objects |

### Fixtures

Located in `src/__tests__/fixtures/`:

- **API responses:** Pre-built JSON responses
- **HTML pages:** Test HTML for integration tests
- **Test files:** Files for upload/download tests

### Mocks

Located in `src/__tests__/__mocks__/`:

- **Playwright:** Mock browser objects
- **Express:** Mock HTTP server
- **fs:** In-memory file system
- **ws:** Mock WebSocket

---

## Coverage

### Coverage Goals

| Phase | Lines | Statements | Functions | Branches |
|-------|-------|------------|-----------|----------|
| 1 | 35% | 35% | 60% | 65% |
| 2 | 50% | 50% | 65% | 70% |
| 3 | 70% | 70% | 70% | 70% |

### Running Coverage

```bash
# Run with coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Interpreting Reports

1. **Green:** Above threshold
2. **Yellow:** Below threshold but improving
3. **Red:** Critical gap

### Minimum Thresholds

Coverage enforcement is configured in `vitest.config.ts`. CI will fail if thresholds are not met.

---

## Debugging

### Debug Mode

```bash
# Run with verbose output
npx vitest --reporter=verbose

# Run single file in watch mode
npx vitest src/__tests__/unit/config.unit.test.ts --watch
```

### Logging

```typescript
import { it, expect } from 'vitest';

it('logs correctly', () => {
  console.log('Debug info');
  expect(result).toBe(expected);
});
```

### E2E Debugging

For Playwright tests:

```bash
# Run with UI mode
npx playwright test --ui

# Run with headed browser
npx playwright test --headed

# Run specific test with debug
npx playwright test -g "test name" --debug
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Test hangs | Check for unclosed resources |
| Flaky test | Add proper waits, avoid timing |
| Port conflicts | Use unique ports per test |
| Memory leaks | Clean up in `afterEach` |

---

## CI/CD Integration

### GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR, push to main | Run unit + integration tests |
| `coverage.yml` | Push to main | Enforce coverage thresholds |
| `e2e.yml` | Nightly (2 AM) | Run E2E tests |

### Local vs CI Differences

| Aspect | Local | CI |
|--------|-------|-----|
| Browser | Headed possible | Headless only |
| Parallelism | Limited | Full |
| Timeout | Manual | 15-60 min |

### Troubleshooting CI Failures

1. **Check logs:** Look for error messages
2. **Reproduce locally:** Run same command
3. **Check artifacts:** Download coverage reports
4. **Verify timeouts:** Increase if needed

---

## Migration Guide

### From node:test to Vitest

```typescript
// Before (node:test)
import { test } from 'node:test';
import assert from 'node:assert';

test('should work', () => {
  assert.strictEqual(actual, expected);
});

// After (Vitest)
import { it, expect } from 'vitest';

it('should work', () => {
  expect(actual).toBe(expected);
});
```

### From Jest to Vitest

```typescript
// Before (Jest)
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('module');

// After (Vitest)
import { describe, it, expect, vi } from 'vitest';

vi.mock('module');
```

### Key Differences

| Jest | Vitest |
|------|--------|
| `jest.fn()` | `vi.fn()` |
| `jest.mock()` | `vi.mock()` |
| `@jest/globals` | `vitest` |
| Slow | Fast (parallel by default) |

---

## Related Documentation

- [Test Helpers](./HELPERS.md) - Detailed helper documentation
- [Test Contributing Guide](./TEST-CONTRIBUTING.md) - How to contribute tests
- [Testing Guide](../../docs/TESTING.md) - Comprehensive testing strategy
- [Test Plan Status](../../docs/TEST-PLAN-STATUS.md) - Implementation progress
