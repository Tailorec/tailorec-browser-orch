import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { SnapshotController } from '../../api/controllers/snapshot.controller.js';
import { registerSnapshotRoutes } from '../../api/routes/snapshot.routes.js';
import { createBrowserContextMock, createTestApp } from '../helpers/test-helpers.js';

describe('snapshot error handling integration', () => {
  it('maps route errors with the current middleware stack', async () => {
    const { browserContext } = createBrowserContextMock();
    browserContext.mapTabError.mockReturnValue({
      status: 503,
      message: 'Browser CDP unavailable. Retry in a few seconds.',
    });

    const controller = new SnapshotController(
      {
        execute: vi.fn(async () => {
          throw new Error('connectOverCDP ECONNREFUSED');
        }),
      } as any,
      {} as any,
      {} as any,
      browserContext as any,
    );
    const app = createTestApp((router, middleware) => {
      registerSnapshotRoutes(router, controller, middleware);
    });

    const response = await request(app).post('/snapshot').send({});
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      error: 'Browser CDP unavailable. Retry in a few seconds.',
    });
  });
});
