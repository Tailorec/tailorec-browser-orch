import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { BasicController } from '../../api/controllers/basic.controller.js';
import { registerBasicRoutes } from '../../api/routes/basic.routes.js';
import { createBrowserContextMock, createTestApp } from '../helpers/test-helpers.js';

describe('basic routes integration', () => {
  it('serves health and status responses through the current route stack', async () => {
    const { browserContext } = createBrowserContextMock();
    const controller = new BasicController(browserContext as any);
    const app = createTestApp((router, middleware) => {
      registerBasicRoutes(router, controller, middleware);
    });

    const health = await request(app).get('/');
    expect(health.status).toBe(200);
    expect(health.text).toBe('Tailorec Browser Service OK');

    const status = await request(app).get('/status').set('x-correlation-id', 'corr-1');
    expect(status.status).toBe(200);
    expect(status.body).toEqual({
      ok: true,
      provider: 'local',
      profiles: [],
      configured_profiles: [
        {
          name: 'default',
          provider: 'local',
          browser_endpoint: 'http://127.0.0.1:9222/',
        },
      ],
    });
    expect(status.headers['x-correlation-id']).toBe('corr-1');
  });
});
