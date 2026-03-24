import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { SnapshotController } from '../../api/controllers/snapshot.controller.js';
import { registerSnapshotRoutes } from '../../api/routes/snapshot.routes.js';
import { createBrowserContextMock, createTestApp } from '../helpers/test-helpers.js';

describe('snapshot routes integration', () => {
  it('serves snapshot and snapshot delta responses', async () => {
    const { browserContext } = createBrowserContextMock();
    const sessionService = {
      getPage: vi.fn(async () => ({ page: true })),
      restoreRoleRefs: vi.fn(async () => undefined),
      refLocator: vi.fn(() => ({})),
    };
    const controller = new SnapshotController(
      {
        execute: vi.fn(async () => ({
          ok: true,
          targetId: 'tab-1',
          url: 'https://example.test',
          snapshot: 'snapshot text',
          refs: { e1: { role: 'button' } },
          truncated: false,
          stats: { lines: 1, chars: 13, refs: 1, interactive: 1 },
        })),
      } as any,
      sessionService as any,
      {
        startDomObserver: vi.fn(async () => ({ changes: [{ ref: 'e1' }] })),
        stopDomObserver: vi.fn(async () => ({ changes: [] })),
      } as any,
      browserContext as any,
    );
    const app = createTestApp((router, middleware) => {
      registerSnapshotRoutes(router, controller, middleware);
    });

    const snapshot = await request(app).post('/snapshot').send({});
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.snapshot).toBe('snapshot text');

    const delta = await request(app).post('/snapshot/delta').send({ action: 'start' });
    expect(delta.status).toBe(200);
    expect(delta.body.changes).toEqual([{ ref: 'e1' }]);
  });

  it('rejects invalid snapshot delta actions', async () => {
    const { browserContext } = createBrowserContextMock();
    const controller = new SnapshotController({} as any, {} as any, {} as any, browserContext as any);
    const app = createTestApp((router, middleware) => {
      registerSnapshotRoutes(router, controller, middleware);
    });

    const response = await request(app).post('/snapshot/delta').send({ action: 'pause' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ ok: false, error: "action must be 'start' or 'stop'" });
  });
});
