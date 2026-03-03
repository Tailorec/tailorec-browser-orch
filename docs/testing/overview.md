# Testing Overview

Comprehensive testing guide for Tailorec Browser Service.

---

## Testing Philosophy

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

### Why Testing Matters

- **Reliability:** Code works as expected
- **Confidence:** Changes don't break existing functionality
- **Documentation:** Tests describe intended behavior
- **Regression prevention:** Bugs stay fixed

---

## Test Framework

### Vitest (Unit/Integration/Contract)

**Features:**
- Fast parallel execution
- Built-in coverage
- Watch mode
- Jest-compatible API

**Configuration:** `vitest.config.ts`

### Playwright Test (E2E)

**Features:**
- Auto-wait
- Browser screenshots
- Video recording
- Trace viewer

**Configuration:** `playwright.config.ts`

---

## Test Categories

### Unit Tests

**Location:** `src/__tests__/unit/`

**Purpose:** Test individual functions and modules in isolation.

**When to write:**
- Testing pure functions (config parsing, data transformation)
- Testing utility functions
- Testing factories and helpers

**Example:**

```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../browser/config.js';

describe('loadConfig', () => {
  it('loads defaults', () => {
    const cfg = loadConfig();
    expect(cfg.browser.headless).toBe(true);
  });

  it('respects environment variables', () => {
    process.env.BROWSER_HEADLESS = 'true';
    const cfg = loadConfig();
    expect(cfg.browser.headless).toBe(true);
  });
});
```

**Best practices:**
- Keep tests fast (< 100ms)
- No external dependencies
- Mock all I/O operations
- Test edge cases

---

### Integration Tests

**Location:** `src/__tests__/integration/`

**Purpose:** Test component interactions (HTTP routes, database, external services).

**When to write:**
- Testing API endpoints
- Testing route handlers
- Testing multi-component workflows

**Example:**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestServer } from '@/__tests__/helpers';

describe('POST /snapshot', () => {
  it('returns snapshot', async () => {
    const server = await createTestServer();
    const response = await request(server)
      .post('/snapshot')
      .send({ interactiveOnly: true });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('snapshot');
    expect(response.body).toHaveProperty('refs');
  });
});
```

**Best practices:**
- Use test database
- Clean up after tests
- Test real HTTP contracts
- Verify error responses

---

### Contract Tests

**Location:** `src/__tests__/contract/`

**Purpose:** Verify API response structures and headers.

**When to write:**
- Verifying HTTP response schemas
- Testing header propagation
- Ensuring error response consistency

**Example:**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestServer } from '@/__tests__/helpers';

describe('contract: Response headers', () => {
  it('includes correlation ID', async () => {
    const server = await createTestServer();
    const response = await request(server).get('/status');

    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(response.headers['content-type']).toContain('application/json');
  });
});
```

**Best practices:**
- Test response schemas
- Verify header contracts
- Check error formats
- Test correlation ID propagation

---

### E2E Tests

**Location:** `src/__tests__/e2e/`

**Purpose:** Test complete user workflows with real browser.

**When to write:**
- Testing critical user journeys
- Verifying browser automation
- Testing end-to-end flows

**Example:**

```typescript
import { test, expect } from '@playwright/test';

test('snapshot and act workflow', async ({ page }) => {
  await page.goto('http://localhost:4000');
  
  // Navigate
  await page.evaluate(() => {
    fetch('/act', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'navigate',
        url: 'https://example.com'
      })
    });
  });
  
  // Take snapshot
  const snapshot = await page.evaluate(() => {
    return fetch('/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interactiveOnly: true })
    }).then(r => r.json());
  });
  
  expect(snapshot.ok).toBe(true);
  expect(snapshot.snapshot).toBeDefined();
});
```

**Best practices:**
- Test critical paths only
- Use data-testid attributes
- Handle loading states
- Record videos on failure

---

## Running Tests

### All Tests

```bash
npm run test
```

### By Category

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

### Single File

```bash
npx vitest run src/__tests__/unit/config.unit.test.ts
```

### Watch Mode

```bash
npx vitest --watch
```

### With Coverage

```bash
npm run test:coverage
```

---

## Coverage

### Coverage Goals

| Phase | Lines | Statements | Functions | Branches |
|-------|-------|------------|-----------|----------|
| Phase 1 | 35% | 35% | 60% | 65% |
| Phase 2 | 50% | 50% | 65% | 70% |
| Phase 3 | 70% | 70% | 70% | 70% |

### Run Coverage

```bash
npm run test:coverage:phase1
npm run test:coverage:phase2
npm run test:coverage:phase3
```

### View Report

```bash
open coverage/index.html
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

## Best Practices

### Test Isolation

**DO:**
```typescript
describe('feature', () => {
  beforeEach(() => {
    // Reset state
    process.env = { ...originalEnv };
  });

  it('test 1', () => {
    // Isolated test
  });

  it('test 2', () => {
    // Another isolated test
  });
});
```

**DON'T:**
```typescript
let sharedState = {};

it('test 1', () => {
  sharedState.value = 1;  // Shared state!
});

it('test 2', () => {
  expect(sharedState.value).toBe(1);  // Depends on test 1!
});
```

### Mocking Strategies

**Mock external services:**
```typescript
import { vi } from 'vitest';
import { fetch } from '../../api.js';

vi.mock('../../api.js');

it('should call API', () => {
  vi.mocked(fetch).mockResolvedValue({ data: 'test' });
  // Test logic
});
```

**Mock time:**
```typescript
it('should handle timeout', () => {
  vi.useFakeTimers();
  doSomething();
  vi.advanceTimersByTime(5000);
  expect(callback).toHaveBeenCalled();
  vi.useRealTimers();
});
```

### Test Data Management

**Use factories:**
```typescript
import { createTestUser } from '@/__tests__/factories';

it('should create user', () => {
  const user = createTestUser({ name: 'Custom Name' });
  // Use factory-created data
});
```

**Generate unique values:**
```typescript
import { generateEmail } from '@/__tests__/factories';

it('should handle unique users', () => {
  const email = generateEmail();  // user_<timestamp>@test.com
});
```

### Error Handling

**Test error cases:**
```typescript
it('should throw on invalid input', () => {
  expect(() => parseInput('')).toThrow('Invalid input');
});

it('should handle API errors', async () => {
  vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
  await expect(doFetch()).rejects.toThrow('Network error');
});
```

---

## Debugging

### Verbose Output

```bash
npx vitest run --reporter=verbose
```

### Debug Single Test

```bash
npx vitest run -t "test name"
```

### Watch Mode

```bash
npx vitest --watch
```

### E2E Debugging

```bash
# Run with UI mode
npx playwright test --ui

# Run with headed browser
npx playwright test --headed

# Debug specific test
npx playwright test -g "test name" --debug
```

---

## CI/CD Integration

### GitHub Actions

Workflows:
- `.github/workflows/test.yml` - Run tests on PR/push
- `.github/workflows/coverage.yml` - Enforce coverage thresholds
- `.github/workflows/e2e.yml` - Run E2E tests nightly

### Local vs CI

| Aspect | Local | CI |
|--------|-------|-----|
| Browser | Headed possible | Headless only |
| Parallelism | Limited | Full |
| Timeout | Manual | 15-60 min |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Test hangs | Unclosed resource | Add cleanup in `afterEach` |
| Flaky test | Timing dependency | Use proper waits, not timeouts |
| Port conflicts | Shared test server | Use unique ports per test |
| Memory leak | No cleanup | Close connections, clear mocks |

### Fix Flaky Tests

**Problem:** Test passes sometimes, fails other times

**Solutions:**
1. Use proper waits instead of fixed delays
2. Ensure test isolation
3. Mock external dependencies
4. Increase timeout only if necessary

---

## Related Documentation

- **[Unit Tests](./unit-tests.md)** - Detailed unit testing guide
- **[Integration Tests](./integration-tests.md)** - Integration testing guide
- **[Coverage](./coverage.md)** - Coverage thresholds and reports

---

**Last Updated:** 2026-03-03
