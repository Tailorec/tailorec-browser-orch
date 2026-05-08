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
      runSessions: new Map(),
      targetOwners: new Map(),
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
      browserless_allocator: z.object({
        total_assigned_runs: z.number(),
        max_total_sessions: z.number(),
        max_sessions_per_worker: z.number(),
        workers: z.array(z.object({
          task_id: z.string(),
          endpoint: z.string(),
          assigned_run_ids: z.array(z.string()),
          created_at: z.number(),
          last_assigned_at: z.number(),
          max_sessions: z.number(),
          idle_since: z.number().nullable(),
          ownership: z.object({
            owner_scope: z.string(),
            owner_id: z.string(),
          }),
          unavailable_since: z.number().nullable(),
          unavailable_reason: z.string().nullable(),
        })),
      }),
    });

    expect(schema.parse(response.body)).toEqual({
      ok: true,
      provider: null,
      profiles: ['default'],
      configured_profiles: [],
      browserless_allocator: {
        total_assigned_runs: 0,
        max_total_sessions: 20,
        max_sessions_per_worker: 5,
        workers: [],
      },
    });
  });
});
