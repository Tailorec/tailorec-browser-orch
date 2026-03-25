import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { ActionCompatController } from '../../api/controllers/action-compat.controller.js';
import { registerActionRoutes } from '../../api/routes/action.routes.js';
import { createTestApp } from '../helpers/test-helpers.js';

describe('action route integration', () => {
  it('validates compatibility payloads before dispatching', async () => {
    const simple = { handleClick: vi.fn(async (_req, res) => res.json({ ok: true, kind: 'click' })) };
    const form = { handleWait: vi.fn(async (_req, res) => res.json({ ok: true, kind: 'wait' })) };
    const advanced = {
      handleEvaluate: vi.fn(async (_req, res) => res.json({ ok: true, kind: 'evaluate' })),
    };
    const compat = new ActionCompatController(simple as any, form as any, advanced as any, true);
    const app = createTestApp((router, middleware) => {
      registerActionRoutes(router, {} as any, {} as any, {} as any, compat, middleware);
    });

    const invalidClick = await request(app).post('/act').send({
      kind: 'click',
      ref: 'e1',
      selector: '#legacy',
    });
    expect(invalidClick.status).toBe(400);

    const wait = await request(app).post('/act').send({ kind: 'wait', selector: '.ready' });
    expect(wait.status).toBe(200);
    expect(wait.body).toEqual({ ok: true, kind: 'wait' });

    const evaluate = await request(app).post('/act').send({ kind: 'evaluate', fn: '() => 1' });
    expect(evaluate.status).toBe(200);
    expect(evaluate.body).toEqual({ ok: true, kind: 'evaluate' });
  });
});
