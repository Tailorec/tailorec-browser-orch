import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { ControlController } from '../../api/controllers/control.controller.js';
import { registerControlRoutes } from '../../api/routes/control.routes.js';
import { createControlToken } from '../../shared/utils/control-token.js';
import { createTestApp } from '../helpers/test-helpers.js';

describe('control contract', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AGENT_RUNTIME_JWT_SECRET = 'top-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns the interactive control response shape', async () => {
    const { token } = createControlToken({ runId: 'run-1' });
    const app = createTestApp((router, middleware) => {
      registerControlRoutes(router, new ControlController(), middleware);
    });

    const response = await request(app).get('/control').query({ token });
    const schema = z.object({
      ok: z.literal(true),
      mode: z.literal('interactive'),
      ws_url: z.string().url(),
      run_id: z.string().nullable(),
      note: z.string(),
    });

    expect(schema.parse(response.body).run_id).toBe('run-1');
  });
});
