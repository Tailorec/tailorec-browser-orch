import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { BasicController } from '../../api/controllers/basic.controller.js';
import { registerBasicRoutes } from '../../api/routes/basic.routes.js';
import { createBrowserContextMock, createTestApp } from '../helpers/test-helpers.js';

describe('status contract', () => {
  it('returns the current status payload shape', async () => {
    const { browserContext } = createBrowserContextMock();
    browserContext.state.mockReturnValue({
      server: {} as any,
      port: 4000,
      configuredProfiles: new Map(),
      profiles: new Map([['default', {}]]),
    });
    const app = createTestApp((router, middleware) => {
      registerBasicRoutes(router, new BasicController(browserContext as any), middleware);
    });

    const response = await request(app).get('/status');

    const schema = z.object({
      ok: z.literal(true),
      profiles: z.array(z.string()),
    });

    expect(schema.parse(response.body)).toEqual({ ok: true, profiles: ['default'] });
  });
});
