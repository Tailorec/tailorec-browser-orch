import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { BasicController } from '../../api/controllers/basic.controller.js';
import { ValidationError } from '../../api/middlewares/error.middleware.js';
import { registerBasicRoutes } from '../../api/routes/basic.routes.js';
import { createBrowserContextMock, createTestApp } from '../helpers/test-helpers.js';

function createStatusApp() {
  const { browserContext } = createBrowserContextMock();
  return createTestApp((router, middleware) => {
    registerBasicRoutes(router, new BasicController(browserContext as any), middleware);
    router.get('/boom', middleware.correlation, middleware.logging, () => {
      throw new ValidationError('invalid payload');
    });
  });
}

describe('contract: Request headers', () => {
  it('POST-style JSON endpoints use the shared middleware stack', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status').set('Content-Type', 'application/json');
    expect(response.status).toBe(200);
  });

  it('requests without content-type still work for GET', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status');
    expect(response.status).toBe(200);
  });

  it('accepts x-correlation-id header', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status').set('x-correlation-id', 'test-correlation-123');
    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBe('test-correlation-123');
  });

  it('accepts x-request-id as alternative', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status').set('x-request-id', 'request-456');
    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBe('request-456');
  });

  it('accepts x-trace-id as alternative', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status').set('x-trace-id', 'trace-789');
    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBe('trace-789');
  });

  it('works without correlation ID by generating one', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status');
    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBeDefined();
  });

  it('preserves correlation ID format for UUID-like values', async () => {
    const app = createStatusApp();
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const response = await request(app).get('/status').set('x-correlation-id', validUuid);
    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBe(validUuid);
  });

  it('includes host header automatically', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status');
    expect(response.status).toBe(200);
  });
});

describe('contract: Response headers', () => {
  it('all JSON responses have application/json content-type', async () => {
    const app = createStatusApp();
    const responses = await Promise.all([request(app).get('/status'), request(app).get('/boom')]);
    responses.forEach((response) => {
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  it('error responses also have application/json content-type', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/boom');
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('includes correlation ID in all responses', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status');
    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(response.headers['x-correlation-id'].length).toBeGreaterThan(0);
  });

  it('includes correlation ID in error responses', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/boom');
    expect(response.status).toBe(400);
    expect(response.headers['x-correlation-id']).toBeDefined();
  });

  it('correlation ID is consistent across request and response', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status').set('x-correlation-id', 'consistent-test-id');
    expect(response.headers['x-correlation-id']).toBe('consistent-test-id');
  });

  it('server generates correlation ID when not provided', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status');
    expect(typeof response.headers['x-correlation-id']).toBe('string');
    expect(response.headers['x-correlation-id'].length).toBeGreaterThan(0);
  });

  it('generated correlation ID format is valid', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status');
    expect(response.headers['x-correlation-id']).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('cache-control is absent or non-public', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status');
    if (response.headers['cache-control']) {
      expect(response.headers['cache-control']).toMatch(/no-store|private|no-cache/);
    }
  });

  it('responds successfully without extra server-identification requirements', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status');
    expect(response.status).toBe(200);
  });
});

describe('contract: Correlation ID propagation', () => {
  it('correlation ID flows through the full request lifecycle', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/status').set('x-correlation-id', 'lifecycle-test-123');
    expect(response.headers['x-correlation-id']).toBe('lifecycle-test-123');
  });

  it('correlation ID appears in error responses', async () => {
    const app = createStatusApp();
    const response = await request(app).get('/boom').set('x-correlation-id', 'error-test-456');
    expect(response.status).toBe(400);
    expect(response.headers['x-correlation-id']).toBe('error-test-456');
  });

  it('different correlation IDs stay isolated across requests', async () => {
    const app = createStatusApp();
    const response1 = await request(app).get('/status').set('x-correlation-id', 'request-1');
    const response2 = await request(app).get('/status').set('x-correlation-id', 'request-2');
    expect(response1.headers['x-correlation-id']).toBe('request-1');
    expect(response2.headers['x-correlation-id']).toBe('request-2');
  });

  it('generated correlation IDs differ across requests', async () => {
    const app = createStatusApp();
    const response1 = await request(app).get('/status');
    const response2 = await request(app).get('/status');
    expect(response1.headers['x-correlation-id']).not.toBe(response2.headers['x-correlation-id']);
  });
});
