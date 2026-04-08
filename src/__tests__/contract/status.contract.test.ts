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
      provider: z.enum(['local', 'browserless']).nullable(),
      profiles: z.array(z.string()),
      configured_profiles: z.array(z.object({
        name: z.string(),
        provider: z.enum(['local', 'browserless']),
        browser_endpoint: z.string(),
      })),
    });

    expect(schema.parse(response.body)).toEqual({
      ok: true,
      provider: null,
      profiles: ['default'],
      configured_profiles: [],
    });
  });
});
