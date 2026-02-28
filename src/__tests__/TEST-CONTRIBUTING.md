# Test Contributing Guide

This guide helps you write effective tests for the Tailorec Browser Service.

---

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm installed
- Git for version control

### Setup

```bash
# Install dependencies
npm install

# Verify setup
npm run test
```

### Your First Test

1. **Find the right directory:**
   - Unit test → `src/__tests__/unit/`
   - Integration test → `src/__tests__/integration/`
   - Contract test → `src/__tests__/contract/`

2. **Create a test file:**
   ```bash
   # Example: unit test for a new utility
   touch src/__tests__/unit/my-feature.unit.test.ts
   ```

3. **Write your test:**
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { myFunction } from '../../browser/my-feature.js';

   describe('myFunction', () => {
     it('should return expected value', () => {
       expect(myFunction('input')).toBe('output');
     });
   });
   ```

4. **Run your test:**
   ```bash
   npx vitest run src/__tests__/unit/my-feature.unit.test.ts
   ```

---

## What to Test

### When to Write Unit Tests

✅ **Write unit tests for:**
- Pure functions (no side effects)
- Data transformation utilities
- Configuration parsing
- Factories and helpers
- Validation logic

❌ **Don't write unit tests for:**
- Simple getters/setters
- Type definitions
- Re-exported modules

### When to Write Integration Tests

✅ **Write integration tests for:**
- API endpoints
- Route handlers
- Database operations
- External service calls
- Multi-component workflows

### When to Write E2E Tests

✅ **Write E2E tests for:**
- Critical user journeys
- Browser automation flows
- Complete feature workflows
- Regression testing key paths

### Test Decision Tree

```
Is it a pure function?
├─ Yes → Unit Test
└─ No
   ├─ Does it call external services?
   │  ├─ Yes → Integration Test
   │  └─ No → Unit Test
   └─ Does it involve browser automation?
      ├─ Yes → E2E Test
      └─ No → Integration Test
```

---

## How to Write Tests

### Step-by-Step Guide

#### Step 1: Identify What You're Testing

```typescript
// What module/function are you testing?
import { targetFunction } from '../../path/to/module.js';
```

#### Step 2: Set Up Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('feature name', () => {
  beforeEach(() => {
    // Reset state before each test
  });

  describe('functionName', () => {
    // Tests go here
  });
});
```

#### Step 3: Write Test Cases

```typescript
it('should handle happy path', () => {
  // Arrange
  const input = 'valid-input';

  // Act
  const result = targetFunction(input);

  // Assert
  expect(result).toBe('expected-output');
});

it('should handle edge case', () => {
  // Test edge cases
});

it('should handle error case', () => {
  // Test error handling
});
```

### Naming Conventions

**File names:**
- `feature.action.unit.test.ts`
- `feature.action.integration.test.ts`
- `feature.action.contract.test.ts`

**Test names:**
```typescript
describe('loadConfig', () => {
  it('should load defaults when no env vars set');
  it('should use env vars when provided');
  it('should throw error for invalid config');
});
```

### Structure Guidelines

**DO:**
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data');
    it('should throw error for duplicate email');
  });

  describe('deleteUser', () => {
    it('should delete existing user');
    it('should throw error for non-existent user');
  });
});
```

**DON'T:**
```typescript
describe('tests', () => {
  it('test 1');
  it('test 2');
  it('test 3');
});
```

---

## Code Review Checklist

Before submitting tests for review, verify:

### Test Quality

- [ ] Test has a clear purpose
- [ ] Test name describes behavior being tested
- [ ] Test follows AAA pattern (Arrange, Act, Assert)
- [ ] Test is isolated (no shared state)
- [ ] Test is deterministic (no random flakiness)

### Coverage

- [ ] Happy path is covered
- [ ] Edge cases are covered
- [ ] Error cases are covered
- [ ] New code has corresponding tests

### Documentation

- [ ] Complex tests have comments explaining why
- [ ] Test data is clearly explained
- [ ] Mocks are documented

### Flakiness Prevention

- [ ] No arbitrary timeouts (`setTimeout`)
- [ ] No reliance on timing
- [ ] Proper cleanup in `afterEach`
- [ ] No shared global state

---

## Common Patterns

### Mocking Patterns

#### Mocking a Function

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchData } from '../../api.js';

vi.mock('../../api.js');

it('should call fetchData', async () => {
  vi.mocked(fetchData).mockResolvedValue({ data: 'test' });
  const result = await fetchData();
  expect(result.data).toBe('test');
});
```

#### Mocking Playwright

```typescript
import { createMockPage } from '@/__tests__/factories';

it('should click button', () => {
  const page = createMockPage();
  // Use mock page for testing
});
```

### Fixture Usage

```typescript
import { createSnapshotResponse } from '@/__tests__/factories';

it('should return snapshot', () => {
  const response = createSnapshotResponse({
    refs: [{ ref: 'd1', role: 'button' }]
  });
  expect(response.snapshot).toBeDefined();
});
```

### Factory Usage

```typescript
import { generateEmail, generateTargetId } from '@/__tests__/factories';

it('should handle unique users', () => {
  const email = generateEmail();  // user_1234567890@test.example.com
  const targetId = generateTargetId();  // target_abc123
  // Use unique values to avoid conflicts
});
```

### Assertion Patterns

```typescript
// Exact match
expect(value).toBe(42);

// Object structure
expect(response).toHaveProperty('data');
expect(response.data).toEqual({ id: 1 });

// Array contents
expect(items).toContain('expected-item');
expect(items).toHaveLength(3);

// Error throwing
expect(() => riskyFunction()).toThrow('error message');

// Async
await expect(promise).resolves.toBe('value');
await expect(promise).rejects.toThrow('error');
```

---

## Anti-Patterns

### What to Avoid

❌ **Testing implementation details:**
```typescript
// Don't test internal state
it('should set internal counter to 5', () => {
  expect(obj._counter).toBe(5);  // Bad!
});

// Test behavior instead
it('should increment counter', () => {
  obj.increment();
  expect(obj.getValue()).toBe(1);  // Good!
});
```

❌ **Multiple assertions without grouping:**
```typescript
it('should do everything', () => {
  expect(a).toBe(1);
  expect(b).toBe(2);
  expect(c).toBe(3);
  expect(d).toBe(4);
  expect(e).toBe(5);
  // Too many unrelated assertions!
});
```

❌ **Arbitrary timeouts:**
```typescript
it('should complete', async () => {
  doSomething();
  await new Promise(r => setTimeout(r, 1000));  // Flaky!
  expect(result).toBeDefined();
});
```

❌ **Shared state between tests:**
```typescript
let sharedData = {};  // Bad!

it('test 1', () => {
  sharedData.value = 1;
});

it('test 2', () => {
  // Depends on test 1!
  expect(sharedData.value).toBe(1);
});
```

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| Testing mocks | Test real behavior |
| Ignoring errors | Test error cases |
| Hard-coded values | Use factories |
| No cleanup | Use `afterEach` |
| Testing too much | Split into smaller tests |

### Flaky Test Causes

1. **Timing dependencies:** Avoid `setTimeout`, use proper waits
2. **Shared state:** Reset state in `beforeEach`
3. **Random values:** Seed random generators
4. **External dependencies:** Mock external services
5. **Race conditions:** Use proper async/await

---

## Submitting Tests

### PR Requirements

When submitting a PR with tests:

1. **All tests pass:**
   ```bash
   npm run test
   ```

2. **Coverage maintained or improved:**
   ```bash
   npm run test:coverage
   ```

3. **TypeScript check passes:**
   ```bash
   npm run check
   ```

4. **Code formatted:**
   ```bash
   npm run lint  # if available
   ```

### Test Run Verification

```bash
# Run all tests
npm run test

# Run specific category
npm run test:unit
npm run test:integration
npm run test:contract

# Run with coverage
npm run test:coverage
```

### Coverage Verification

```bash
# Check coverage meets thresholds
npm run test:coverage:phase2

# View detailed report
open coverage/index.html
```

---

## Test Templates

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('FeatureName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('functionName', () => {
    it('should handle happy path', () => {
      // Arrange
      const input = 'valid-input';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected-output');
    });

    it('should handle edge case', () => {
      // Edge case test
    });

    it('should throw error for invalid input', () => {
      expect(() => functionName('')).toThrow('error message');
    });
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { withTestServer, ApiClient } from '@/__tests__/helpers';
import { createRequestData } from '@/__tests__/factories';

describe('API: POST /endpoint', () => {
  it('should process valid request', async () => {
    await withTestServer(async (state) => {
      // Arrange
      const client = ApiClient.fromTestServer(state);
      const requestData = createRequestData();

      // Act
      const response = await client.post('/endpoint', requestData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
    });
  });

  it('should reject invalid request', async () => {
    await withTestServer(async (state) => {
      const client = ApiClient.fromTestServer(state);
      const response = await client.post('/endpoint', {});
      expect(response.status).toBe(400);
    });
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Flow', () => {
  test('should complete user journey', async ({ page }) => {
    // Arrange
    await page.goto('http://localhost:4000');

    // Act
    await page.click('[data-testid="action-button"]');
    await page.fill('[data-testid="input"]', 'test value');
    await page.click('[data-testid="submit-button"]');

    // Assert
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
    await expect(page).toHaveURL(/success/);
  });
});
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Test Suite README](./README.md)
- [Test Helpers](./HELPERS.md)
- [Testing Guide](../../docs/TESTING.md)
