import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { ActionCompatController } from '../../api/controllers/action-compat.controller.js';
import { registerActionRoutes } from '../../api/routes/action.routes.js';
import { createTestApp } from '../helpers/test-helpers.js';

describe('act contract', () => {
  it('returns the current error and success shapes for /act', async () => {
    const compat = new ActionCompatController(
      {
        handleClick: vi.fn(async (_req, res) => res.json({ ok: true, targetId: 'tab-1' })),
      } as any,
      {} as any,
      {} as any,
      true,
    );
    const app = createTestApp((router, middleware) => {
      registerActionRoutes(router, {} as any, {} as any, {} as any, compat, middleware);
    });

    const errorResponse = await request(app).post('/act').send({ kind: 'click' });
    expect(
      z.object({ ok: z.literal(false), error: z.string() }).parse(errorResponse.body),
    ).toEqual({ ok: false, error: 'ref is required' });

    const successResponse = await request(app).post('/act').send({ kind: 'click', ref: 'e1' });
    expect(
      z.object({ ok: z.literal(true), targetId: z.string() }).parse(successResponse.body),
    ).toEqual({ ok: true, targetId: 'tab-1' });
  });
});
