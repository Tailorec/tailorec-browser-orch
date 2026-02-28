# Testing Guide

Comprehensive testing guide for the Tailorec Browser Service.

---

## Introduction

### Why Testing Matters

Testing ensures:
- **Reliability:** Code works as expected
- **Confidence:** Changes don't break existing functionality
- **Documentation:** Tests describe intended behavior
- **Regression prevention:** Bugs stay fixed

### Testing Strategy Overview

```
┌─────────────────────────────────────────┐
│              E2E Tests                   │  ← Full user flows
│           (Playwright Test)              │
├─────────────────────────────────────────┤
│          Integration Tests               │  ← Component interactions
│              (Vitest)                    │
├─────────────────────────────────────────┤
│           Contract Tests                 │  ← API contracts
│              (Vitest)                    │
├─────────────────────────────────────────┤
│             Unit Tests                   │  ← Individual functions
│              (Vitest)                    │
└─────────────────────────────────────────┘
```

---

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Verify installation
npm run test
```

### First Test

Create a simple unit test:

```typescript
// src/__tests__/unit/example.unit.test.ts
import { describe, it, expect } from 'vitest';

describe('Example', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run it:

```bash
npx vitest run src/__tests__/unit/example.unit.test.ts
```

### Running Tests

```bash
# All tests
npm run test

# By category
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e

# With coverage
npm run test:coverage
```

---

## Test Types

### Unit Testing

**Purpose:** Test individual functions and modules in isolation.

**Framework:** Vitest

**Example:**

```typescript
import { describe, it, expect } from 'vitest';
import { add } from '../../utils/math.js';

describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });

  it('should handle negative numbers', () => {
    expect(add(-1, -2)).toBe(-3);
  });
});
```

**Best practices:**
- Keep tests fast (< 100ms)
- No external dependencies
- Mock all I/O operations
- Test edge cases

### Integration Testing

**Purpose:** Test component interactions.

**Framework:** Vitest + supertest

**Example:**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestServer } from '@/__tests__/helpers';

describe('POST /api/users', () => {
  it('should create user', async () => {
    const server = await createTestServer();
    const response = await request(server)
      .post('/api/users')
      .send({ name: 'John' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});
```

**Best practices:**
- Use test database
- Clean up after tests
- Test real HTTP contracts
- Verify error responses

### Contract Testing

**Purpose:** Verify API response structures and headers.

**Framework:** Vitest + supertest

**Example:**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestServer } from '@/__tests__/helpers';

describe('contract: Response headers', () => {
  it('should include correlation ID', async () => {
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

### E2E Testing

**Purpose:** Test complete user workflows.

**Framework:** Playwright Test

**Example:**

```typescript
import { test, expect } from '@playwright/test';

test('user can complete workflow', async ({ page }) => {
  await page.goto('http://localhost:4000');
  await page.click('[data-testid="start"]');
  await page.fill('[data-testid="input"]', 'test');
  await page.click('[data-testid="submit"]');
  await expect(page.locator('[data-testid="result"]')).toBeVisible();
});
```

**Best practices:**
- Test critical paths only
- Use data-testid attributes
- Handle loading states
- Record videos on failure

---

## Test Framework

### Vitest Overview

Vitest is a fast Vite-native test framework.

**Key features:**
- Fast parallel execution
- Built-in coverage
- Watch mode
- Jest-compatible API

**Configuration:** `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
```

### Playwright Test Overview

Playwright Test for E2E browser testing.

**Key features:**
- Auto-wait
- Browser screenshots
- Video recording
- Trace viewer

**Configuration:** `playwright.config.ts`

```typescript
export default defineConfig({
  testDir: './src/__tests__/e2e',
  timeout: 60000,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

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

## Advanced Topics

### Parallel Testing

Vitest runs tests in parallel by default:

```bash
# Run with default parallelism
npm run test

# Run with specific worker count
npx vitest run --pool=threads --poolOptions.threads.maxThreads=4
```

### Test Optimization

**Tips:**
- Use `beforeAll` for expensive setup
- Use `beforeEach` for state reset
- Skip tests in CI when appropriate
- Use `describe.sequential` for dependent tests

```typescript
describe.sequential('dependent tests', () => {
  // Tests run in order
});
```

### Coverage Optimization

**Configure in `vitest.config.ts`:**

```typescript
coverage: {
  thresholds: {
    lines: 70,
    statements: 70,
    functions: 70,
    branches: 70,
  },
  exclude: [
    'src/**/*.test.ts',
    'src/**/__tests__/**',
  ],
}
```

**Run coverage:**
```bash
npm run test:coverage
```

### CI/CD Integration

**GitHub Actions workflow:**

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Test hangs | Unclosed resource | Add cleanup in `afterEach` |
| Flaky test | Timing dependency | Use proper waits, not timeouts |
| Port conflicts | Shared test server | Use unique ports per test |
| Memory leak | No cleanup | Close connections, clear mocks |

### Debug Techniques

**Verbose output:**
```bash
npx vitest run --reporter=verbose
```

**Debug single test:**
```bash
npx vitest run -t "test name"
```

**Watch mode:**
```bash
npx vitest --watch
```

**Debug E2E:**
```bash
npx playwright test --debug
npx playwright test --ui
```

### Performance Tips

**Slow tests:**
- Profile with `--reporter=verbose`
- Check for unnecessary waits
- Parallelize independent tests
- Mock expensive operations

**Slow coverage:**
- Use `--coverage=false` for local dev
- Run coverage only in CI
- Exclude test files from coverage

---

## Related Documentation

- [Test Suite README](../src/__tests__/README.md)
- [Test Contributing Guide](../src/__tests__/TEST-CONTRIBUTING.md)
- [Test Helpers](../src/__tests__/HELPERS.md)
- [Test Plan Status](./TEST-PLAN-STATUS.md)
