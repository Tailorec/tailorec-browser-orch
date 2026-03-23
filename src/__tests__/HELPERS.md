# Test Helpers & Mocks Documentation

This directory contains test helpers, mocks, factories, and fixtures for the Tailorec Browser Service test suite.

## Directory Structure

```
src/__tests__/
├── helpers/                       # Test utility functions
│   ├── index.ts                   # Central export point
│   ├── core-browser.ts            # Core browser utilities
│   ├── test-server.ts             # Test HTTP server creation
│   ├── api-client.ts              # API client for integration tests
│   ├── assertion-helpers.ts       # Common assertion utilities
│   ├── pw-session-fixtures.ts     # Playwright session fixtures
│   ├── pw-fill-fixtures.ts        # Form filling fixtures
│   ├── upload-fixtures.ts         # File upload fixtures
│   └── remote-debug-browser.ts    # Remote debugging utilities
├── factories/                     # Test data factories
│   ├── index.ts                   # Central export point
│   ├── test-data.factory.ts       # Generic test data generators
│   ├── request.factory.ts         # API request payload factories
│   ├── response.factory.ts        # API response factories
│   ├── page-state.factory.ts      # Playwright page state mocks
│   └── error.factory.ts           # Error object factories
├── __mocks__/                     # Mock implementations
│   ├── index.ts                   # Central export point
│   ├── playwright.ts              # Playwright mocks
│   ├── express.ts                 # Express.js mocks
│   ├── fs.ts                      # File system mocks
│   ├── net.ts                     # Network module mocks
│   └── ws.ts                      # WebSocket mocks
└── fixtures/                      # Test fixtures
    ├── api-responses/             # Pre-built API responses
    ├── pages/                     # HTML test pages
    └── files/                     # Test files for upload/download
```

## Helpers

### Test Server (`test-server.ts`)

Creates a test HTTP server with browser control routes registered.

```typescript
import { createTestServer, stopTestServer, withTestServer } from '@/__tests__/helpers';

// Option 1: Manual start/stop
const server = await createTestServer({ port: 3001, headless: true });
try {
  // Run tests
} finally {
  await stopTestServer(server);
}

// Option 2: Automatic cleanup
await withTestServer(async (state) => {
  // Run tests with automatic cleanup
});
```

### API Client (`api-client.ts`)

HTTP client for making API requests in integration tests.

```typescript
import { ApiClient, createApiClient } from '@/__tests__/helpers';

const client = createApiClient({ baseUrl: 'http://127.0.0.1:4000' });

// GET request
const response = await client.get('/status');

// POST request with body
const response = await client.post('/snapshot', { targetId: 'tab-1' });

// Check response
expect(response.ok).toBe(true);
expect(response.status).toBe(200);
expect(response.body).toHaveProperty('snapshot');
```

### Assertion Helpers (`assertion-helpers.ts`)

Common assertion utilities for consistent test assertions.

```typescript
import {
  assertSuccessStatus,
  assertErrorResponse,
  assertSnapshotResponse,
  assertActResponse,
  assertCorrelationIdHeader,
} from '@/__tests__/helpers';

// Status assertions
assertSuccessStatus(response.status);
assertErrorStatus(response.status);
assertStatus(response.status, 404);

// Response structure assertions
assertSnapshotResponse(response.body);
assertActResponse(response.body);
assertErrorResponse(response.body);

// Header assertions
assertCorrelationIdHeader(response.headers);
```

## Factories

### Test Data Factory (`test-data.factory.ts`)

Generates unique test data.

```typescript
import {
  generateUniqueString,
  generateEmail,
  generateTargetId,
  generateCdpUrl,
  generateRef,
  generateCorrelationId,
} from '@/__tests__/factories';

const email = generateEmail();  // user_1234567890@test.example.com
const targetId = generateTargetId();  // target_abc123
const cdpUrl = generateCdpUrl(9222);  // http://127.0.0.1:9222
const ref = generateRef('d', 1);  // d1
```

### Request Factory (`request.factory.ts`)

Creates API request payloads.

```typescript
import {
  createSnapshotRequest,
  createClickRequest,
  createTypeRequest,
  createFillRequest,
} from '@/__tests__/factories';

const snapshotReq = createSnapshotRequest({ targetId: 'tab-1', timeoutMs: 5000 });
const clickReq = createClickRequest({ ref: 'd1', button: 'left' });
const typeReq = createTypeRequest({ ref: 'd2', text: 'test input' });
```

### Response Factory (`response.factory.ts`)

Creates API response objects.

```typescript
import {
  createSuccessResponse,
  createErrorResponse,
  createSnapshotResponse,
  createActResponse,
} from '@/__tests__/factories';

const success = createSuccessResponse({ data: 'test' });
const error = createErrorResponse({ error: 'Not found', code: 'NOT_FOUND' });
const snapshot = createSnapshotResponse({ refs: [{ ref: 'd1', role: 'button' }] });
```

### Page State Factory (`page-state.factory.ts`)

Creates mock Playwright objects.

```typescript
import {
  createMockPage,
  createMockBrowser,
  createMockBrowserContext,
  createMockConsoleMessage,
} from '@/__tests__/factories';

const page = createMockPage({ url: 'https://example.test' });
const browser = createMockBrowser();
const context = createMockBrowserContext();
```

### Error Factory (`error.factory.ts`)

Creates error objects for testing error handling.

```typescript
import {
  createTimeoutError,
  createNotFoundError,
  createBrowserUnavailableError,
  createElementNotFoundError,
  isTimeoutError,
  isBrowserUnavailableError,
} from '@/__tests__/factories';

const timeoutErr = createTimeoutError('snapshot', 5000);
const notFoundErr = createNotFoundError('tab', 'tab-123');
const browserErr = createBrowserUnavailableError('http://127.0.0.1:9222');

// Type guards
if (isTimeoutError(err)) {
  // Handle timeout
}
```

## Mocks

### Playwright Mocks (`__mocks__/playwright.ts`)

Mock implementations of Playwright classes.

```typescript
import {
  MockLocator,
  MockFrame,
  MockResponse,
  createMockLocator,
} from '@/__tests__/__mocks__/playwright';

const locator = createMockLocator('button');
await locator.click();
expect(locator.getClickCount()).toBe(1);
```

### Express Mocks (`__mocks__/express.ts`)

Mock implementations of Express.js classes.

```typescript
import {
  MockApplication,
  MockRequest,
  MockResponse,
  createMockApplication,
} from '@/__tests__/__mocks__/express';

const app = createMockApplication();
const req = new MockRequest({ method: 'POST', path: '/snapshot' });
const res = new MockResponse();
```

### File System Mocks (`__mocks__/fs.ts`)

In-memory file system for testing.

```typescript
import { mockFileSystem, fs } from '@/__tests__/__mocks__/fs';

// Write file
mockFileSystem.writeFileSync('/test.txt', 'content');

// Read file
const content = fs.readFileSync('/test.txt', 'utf8');

// Check existence
const exists = fs.existsSync('/test.txt');
```

### WebSocket Mocks (`__mocks__/ws.ts`)

Mock WebSocket implementations.

```typescript
import {
  MockWebSocket,
  MockWebSocketServer,
  createMockWebSocket,
  createMockWebSocketServer,
} from '@/__tests__/__mocks__/ws';

const server = createMockWebSocketServer({ port: 8080 });
const client = createMockWebSocket('ws://localhost:8080');
```

## Fixtures

### API Responses

Pre-built JSON responses for testing.

- `snapshot-success.json` - Successful snapshot response
- `snapshot-error.json` - Error snapshot response
- `act-success.json` - Successful act response
- `act-error.json` - Error act response
- `status.json` - Status endpoint response
- `screenshot-success.json` - Screenshot response

### HTML Pages

Test HTML pages for integration testing.

- `simple-form.html` - Basic form with text inputs
- `complex-form.html` - Complex form with various input types
- `dropdown-page.html` - Dropdown/select testing
- `file-upload-page.html` - File upload testing
- `dynamic-content-page.html` - Dynamic content testing

### Test Files

Files for upload/download testing.

- `test-upload.txt` - Text file for upload tests
- `test-data.json` - JSON file for upload tests
- `test-data.csv` - CSV file for upload tests
- `test-download.pdf` - PDF file for download tests

## Usage Examples

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { createMockPage } from '@/__tests__/factories';
import { createClickRequest } from '@/__tests__/factories';

describe('click action', () => {
  it('should click element', async () => {
    const page = createMockPage();
    const request = createClickRequest({ ref: 'd1' });
    
    // Test logic here
    expect(request.action).toBe('click');
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { withTestServer } from '@/__tests__/helpers';
import { ApiClient } from '@/__tests__/helpers';
import { createSnapshotRequest } from '@/__tests__/factories';

describe('POST /snapshot', () => {
  it('should return snapshot', async () => {
    await withTestServer(async (state) => {
      const client = ApiClient.fromTestServer(state);
      const request = createSnapshotRequest();
      
      const response = await client.post('/snapshot', request);
      
      expect(response.ok).toBe(true);
      expect(response.body).toHaveProperty('snapshot');
    });
  });
});
```

### Contract Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { createSnapshotResponse } from '@/__tests__/factories';
import { assertSnapshotResponse } from '@/__tests__/helpers';

describe('Snapshot Response Contract', () => {
  it('should have required fields', () => {
    const response = createSnapshotResponse();
    
    assertSnapshotResponse(response);
    expect(response).toHaveProperty('snapshot');
    expect(response).toHaveProperty('refs');
  });
});
```

## Best Practices

1. **Use factories for test data** - Don't hardcode test data; use factories for consistency
2. **Use mocks for isolation** - Mock external dependencies to test units in isolation
3. **Use fixtures for complex data** - Use pre-built fixtures for complex test scenarios
4. **Clean up resources** - Always clean up test servers and mock resources
5. **Type safety** - Use TypeScript types from factories for type-safe test data
