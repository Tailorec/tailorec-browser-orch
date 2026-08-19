import { describe, expect, it, vi } from 'vitest';
import { ActionCompatController } from '../../api/controllers/action-compat.controller.js';
import { createMockReq, createMockRes } from '../helpers/test-helpers.js';

describe('ActionCompatController', () => {
  it('dispatches valid click requests to the simple controller', async () => {
    const simple = { handleClick: vi.fn(async () => undefined) };
    const controller = new ActionCompatController(simple as any, {} as any, {} as any, true);
    const req = createMockReq({
      body: { run_id: 'run-1', kind: 'click', ref: 'e1', button: 'left', modifiers: ['Alt'] },
    });
    const res = createMockRes();

    await controller.handleAct(req, res);

    expect(simple.handleClick).toHaveBeenCalledWith(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('rejects click requests without a ref', async () => {
    const controller = new ActionCompatController({} as any, {} as any, {} as any, true);
    const req = createMockReq({ body: { run_id: 'run-1', kind: 'click' } });
    const res = createMockRes();

    await controller.handleAct(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ ok: false, error: 'ref is required' });
  });

  it('dispatches wait requests with selector support to the form controller', async () => {
    const form = { handleWait: vi.fn(async () => undefined) };
    const controller = new ActionCompatController({} as any, form as any, {} as any, true);
    const req = createMockReq({
      body: { run_id: 'run-1', kind: 'wait', selector: '.ready', timeoutMs: 1000 },
    });
    const res = createMockRes();

    await controller.handleAct(req, res);

    expect(form.handleWait).toHaveBeenCalledWith(req, res);
    expect(res.statusCode).toBe(200);
  });
});
