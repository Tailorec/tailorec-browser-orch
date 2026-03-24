import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ControlController } from '../../api/controllers/control.controller.js';
import { registerControlRoutes } from '../../api/routes/control.routes.js';
import { createControlToken } from '../../shared/utils/control-token.js';
import { createTestApp } from '../helpers/test-helpers.js';

describe('control route integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AGENT_RUNTIME_JWT_SECRET = 'top-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns interactive control metadata for valid tokens', async () => {
    const { token } = createControlToken({ runId: 'run-42' });
    const app = createTestApp((router, middleware) => {
      registerControlRoutes(router, new ControlController(), middleware);
    });

    const response = await request(app)
      .get('/control')
      .query({ token, targetId: 'tab-1' })
      .set('Host', 'browser.test:4000');

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('interactive');
    expect(response.body.ws_url).toContain('ws://browser.test:4000/control/live?');
    expect(response.body.ws_url).toContain('targetId=tab-1');
  });

  it('rejects missing control tokens', async () => {
    const app = createTestApp((router, middleware) => {
      registerControlRoutes(router, new ControlController(), middleware);
    });

    const response = await request(app).get('/control');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ ok: false, error: 'missing_control_token' });
  });
});
