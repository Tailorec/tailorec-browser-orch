import { describe, expect, it, vi } from 'vitest';
import { ActionCompatController } from '../../api/controllers/action-compat.controller.js';
import { createMockReq, createMockRes } from '../helpers/test-helpers.js';

describe('ActionCompatController validation', () => {
  it('rejects unknown action kinds', async () => {
    const controller = new ActionCompatController({} as any, {} as any, {} as any, true);
    const res = createMockRes();

    await controller.handleAct(createMockReq({ body: { kind: 'unknown' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ ok: false, error: 'kind is required' });
  });

  it('rejects selector for non-wait actions', async () => {
    const controller = new ActionCompatController({} as any, {} as any, {} as any, true);
    const res = createMockRes();

    await controller.handleAct(
      createMockReq({ body: { run_id: 'run-1', kind: 'click', ref: 'e1', selector: '#bad' } }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error: string }).error).toContain("'selector' is not supported");
  });

  it('rejects invalid click button and modifiers', async () => {
    const controller = new ActionCompatController({} as any, {} as any, {} as any, true);

    const badButton = createMockRes();
    await controller.handleAct(
      createMockReq({ body: { run_id: 'run-1', kind: 'click', ref: 'e1', button: 'bad' } }),
      badButton,
    );
    expect(badButton.payload).toEqual({ ok: false, error: 'button must be left|right|middle' });

    const badModifiers = createMockRes();
    await controller.handleAct(
      createMockReq({ body: { run_id: 'run-1', kind: 'click', ref: 'e1', modifiers: ['Bad'] } }),
      badModifiers,
    );
    expect(badModifiers.payload).toEqual({
      ok: false,
      error: 'modifiers must be Alt|Control|ControlOrMeta|Meta|Shift',
    });
  });

  it('rejects empty wait payloads and disabled wait functions', async () => {
    const disabledController = new ActionCompatController({} as any, {} as any, {} as any, false);

    const missingConditions = createMockRes();
    await disabledController.handleAct(
      createMockReq({ body: { run_id: 'run-1', kind: 'wait' } }),
      missingConditions,
    );
    expect(missingConditions.statusCode).toBe(400);

    const disabledFn = createMockRes();
    await disabledController.handleAct(
      createMockReq({ body: { run_id: 'run-1', kind: 'wait', fn: '() => true' } }),
      disabledFn,
    );
    expect(disabledFn.statusCode).toBe(403);
  });

  it('dispatches evaluate requests to the advanced controller when enabled', async () => {
    const advanced = { handleEvaluate: vi.fn(async () => undefined) };
    const controller = new ActionCompatController({} as any, {} as any, advanced as any, true);
    const req = createMockReq({ body: { run_id: 'run-1', kind: 'evaluate', fn: '() => 1' } });
    const res = createMockRes();

    await controller.handleAct(req, res);

    expect(advanced.handleEvaluate).toHaveBeenCalledWith(req, res);
  });
});
