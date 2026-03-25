import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TimeoutError,
  ValidationError,
} from '../../api/middlewares/error.middleware.js';
import { createTestApp } from '../helpers/test-helpers.js';
import { createActionRouteHarness } from '../integration/routes/helpers/route-harness.js';
import { createSnapshotRouteHarness } from '../integration/routes/helpers/route-harness.js';

function createErrorApp() {
  return createTestApp((router, middleware) => {
    router.get('/validation', middleware.correlation, middleware.logging, () => {
      throw new ValidationError('invalid payload');
    });
    router.get('/forbidden', middleware.correlation, middleware.logging, () => {
      throw new ForbiddenError('act:evaluate is disabled by config');
    });
    router.get('/not-found', middleware.correlation, middleware.logging, () => {
      throw new NotFoundError('profile not found');
    });
    router.get('/timeout', middleware.correlation, middleware.logging, () => {
      throw new TimeoutError('Browser wait action timed out');
    });
    router.get('/conflict', middleware.correlation, middleware.logging, () => {
      throw new ConflictError('ref and element are mutually exclusive');
    });
    router.get('/unavailable', middleware.correlation, middleware.logging, () => {
      throw new ServiceUnavailableError('Browser is unavailable');
    });
    router.get('/unexpected', middleware.correlation, middleware.logging, () => {
      throw new Error('Unexpected error occurred');
    });
  });
}

describe('contract: HTTP error response structure', () => {
  describe('400 Bad Request', () => {
    it('missing kind field returns 400', async () => {
      const { app } = createActionRouteHarness();
      const response = await request(app).post('/act').send({});
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ ok: false, error: expect.any(String) });
      expect(response.body.error).toContain('kind');
    });

    it('missing ref for click returns 400', async () => {
      const { app } = createActionRouteHarness();
      const response = await request(app).post('/act').send({ kind: 'click' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ref');
    });

    it('missing text for type returns 400', async () => {
      const { app } = createActionRouteHarness();
      const response = await request(app).post('/act').send({ kind: 'type', ref: 'd1' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('text');
    });

    it('invalid button value returns 400', async () => {
      const { app } = createActionRouteHarness();
      const response = await request(app).post('/act').send({ kind: 'click', ref: 'd1', button: 'invalid' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('button');
    });

    it('missing url for navigate returns 400', async () => {
      const { app } = createActionRouteHarness();
      const response = await request(app).post('/act').send({ kind: 'navigate' });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('url');
    });

    it('snapshot delta with invalid action returns 400', async () => {
      const { app } = createSnapshotRouteHarness();
      const response = await request(app).post('/snapshot/delta').send({ action: 'invalid' });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ ok: false, error: expect.stringContaining('action') });
    });

    it('validation middleware returns 400 envelope', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/validation');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, error: 'invalid payload' });
    });
  });

  describe('403 Forbidden', () => {
    it('forbidden errors return 403', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/forbidden');
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ ok: false, error: 'act:evaluate is disabled by config' });
    });
  });

  describe('404 Not Found', () => {
    it('unknown route returns 404', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/unknown-route');
      expect(response.status).toBe(404);
      expect(response.type).toBe('text/html');
    });

    it('not found errors return 404 envelope', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/not-found');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, error: 'profile not found' });
    });
  });

  describe('408 Request Timeout', () => {
    it('timeout errors return 408 envelope', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/timeout');
      expect(response.status).toBe(408);
      expect(response.body).toEqual({ ok: false, error: 'Browser wait action timed out' });
    });

    it('timeout contract keeps error as string', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/timeout');
      expect(typeof response.body.error).toBe('string');
    });
  });

  describe('409 Conflict', () => {
    it('conflict errors return 409 envelope', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/conflict');
      expect(response.status).toBe(409);
      expect(response.body.error).toContain('mutually exclusive');
    });

    it('conflict responses preserve shared error shape', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/conflict');
      expect(response.body).toMatchObject({ ok: false, error: expect.any(String) });
    });
  });

  describe('500 and 503 error responses', () => {
    it('unexpected error returns 500 structure', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/unexpected');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, error: 'Unexpected error occurred' });
    });

    it('service unavailable returns 503 structure', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/unavailable');
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ ok: false, error: 'Browser is unavailable' });
    });
  });

  describe('error response consistency', () => {
    for (const path of ['/validation', '/forbidden', '/not-found', '/timeout', '/conflict', '/unavailable', '/unexpected']) {
      it(`responds with shared envelope for ${path}`, async () => {
        const app = createErrorApp();
        const response = await request(app).get(path);
        expect(response.body).toMatchObject({ ok: false, error: expect.any(String) });
        expect(response.headers['content-type']).toContain('application/json');
      });
    }

    it('preserves correlation header on error responses', async () => {
      const app = createErrorApp();
      const response = await request(app).get('/validation').set('x-correlation-id', 'err-123');
      expect(response.headers['x-correlation-id']).toBe('err-123');
    });
  });
});
