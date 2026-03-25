import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ControlController } from '../../api/controllers/control.controller.js';
import { createControlToken } from '../../shared/utils/control-token.js';
import { createMockReq, createMockRes } from '../helpers/test-helpers.js';

describe('ControlController', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AGENT_RUNTIME_JWT_SECRET = 'top-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns a websocket URL for a valid token', async () => {
    const controller = new ControlController();
    const { token } = createControlToken({ runId: 'run-123' });
    const req = createMockReq({
      query: { token, targetId: 'tab-1' },
      headers: { host: 'browser.test:4000' },
      protocol: 'https',
    });
    const res = createMockRes();

    await controller.handleControl(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      ok: true,
      mode: 'interactive',
      run_id: 'run-123',
    });
    expect((res.payload as { ws_url: string }).ws_url).toContain('wss://browser.test:4000/control/live?');
    expect((res.payload as { ws_url: string }).ws_url).toContain('targetId=tab-1');
  });

  it('rejects missing tokens', async () => {
    const controller = new ControlController();
    const res = createMockRes();

    await controller.handleControl(createMockReq({ query: {} }), res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ ok: false, error: 'missing_control_token' });
  });
});
