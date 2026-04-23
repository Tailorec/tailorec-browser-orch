import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { Router } from 'express';
import { createTestApp } from '../../helpers/test-helpers.js';
import { registerRunSessionRoutes } from '../../../api/routes/run-session.routes.js';
import { RunSessionController } from '../../../api/controllers/run-session.controller.js';

function createRunSessionHarness() {
  const state = {
    server: {} as any,
    port: 4000,
    configuredProfiles: new Map(),
    profiles: new Map(),
    runSessions: new Map<string, { sessionId: string }>(),
    targetOwners: new Map(),
  };

  const profileCtx = {
    profile: {
      name: 'default',
      provider: 'browserless' as const,
      browserPort: 9222,
      browserEndpoint: 'http://127.0.0.1:3000',
      browserEndpointIsLoopback: false,
      driver: 'chrome',
      color: 'blue',
    },
    ensureRunSession: vi.fn(async (runId: string) => ({
      runId,
      sessionId: `sess-${runId}`,
      created: true,
    })),
    ensureTabAvailable: vi.fn(),
    closeRunSession: vi.fn(async () => ({ closed: true, targetId: undefined })),
    stopRunningBrowser: vi.fn(async () => undefined),
  };

  const browserContext = {
    state: vi.fn(() => state),
    forProfile: vi.fn(() => profileCtx),
    mapTabError: vi.fn(() => null),
  };

  const controller = new RunSessionController(browserContext as any);
  const app = createTestApp(
    (router: Router, middleware) => {
      registerRunSessionRoutes(router, controller, middleware);
    },
    { autoInjectRunId: false },
  );

  return { app, state, profileCtx, browserContext };
}

describe('integration: run session routes', () => {
  it('creates run session using runId path param', async () => {
    const { app, profileCtx } = createRunSessionHarness();
    const res = await request(app).post('/runs/run-1/session').send({});

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        accepted: true,
        run_id: 'run-1',
        session_id: 'sess-run-1',
        created: true,
      }),
    );
    expect(profileCtx.ensureRunSession).toHaveBeenCalledWith('run-1');
  });

  it('returns created=false for idempotent create', async () => {
    const { app, profileCtx } = createRunSessionHarness();
    profileCtx.ensureRunSession.mockResolvedValueOnce({
      runId: 'run-1',
      sessionId: 'sess-run-1',
      created: false,
    });

    const res = await request(app).post('/runs/run-1/session').send({});

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(false);
    expect(res.body.session_id).toBe('sess-run-1');
  });

  it('closes run session and returns bound session id when present', async () => {
    const { app, state, profileCtx } = createRunSessionHarness();
    state.runSessions.set('run-2', { sessionId: 'sess-run-2' });
    profileCtx.closeRunSession.mockResolvedValueOnce({ closed: true, targetId: 'tab-1' });

    const res = await request(app).delete('/runs/run-2/session').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        run_id: 'run-2',
        session_id: 'sess-run-2',
        closed: true,
        target_id: 'tab-1',
      }),
    );
    expect(profileCtx.closeRunSession).toHaveBeenCalledWith('run-2');
  });
});
