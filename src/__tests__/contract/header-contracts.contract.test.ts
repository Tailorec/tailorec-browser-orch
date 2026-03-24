import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { BasicController } from '../../api/controllers/basic.controller.js';
import { registerBasicRoutes } from '../../api/routes/basic.routes.js';
import { createBrowserContextMock, createTestApp } from '../helpers/test-helpers.js';

describe('header contracts', () => {
  it('always returns a correlation header and preserves provided values', async () => {
    const { browserContext } = createBrowserContextMock();
    const app = createTestApp((router, middleware) => {
      registerBasicRoutes(router, new BasicController(browserContext as any), middleware);
    });

    const generated = await request(app).get('/status');
    expect(generated.headers['x-correlation-id']).toBeTruthy();

    const preserved = await request(app)
      .get('/status')
      .set('x-correlation-id', 'corr-777');
    expect(preserved.headers['x-correlation-id']).toBe('corr-777');
  });
});
