import { describe, expect, it, vi } from 'vitest';
import { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';

describe('ExecuteActionUseCase', () => {
  it('executes actions and persists fill metadata', async () => {
    const page = { url: vi.fn(() => 'https://example.test') };
    const session = {
      getRoleRefs: vi.fn(() => ({ e1: { role: 'button' } })),
      getRoleRefsMode: vi.fn(() => 'aria'),
    };
    const sessionService = {
      getPage: vi.fn(async () => page),
      restoreRoleRefs: vi.fn(async () => undefined),
      getSession: vi.fn(async () => session),
      refLocator: vi.fn(() => ({})),
      storeRoleRefs: vi.fn(async () => undefined),
      forgetSession: vi.fn(),
    };
    const interactionService = {
      executeAction: vi.fn(async () => ({
        ok: true,
        targetId: 'tab-1',
        url: 'https://example.test',
        result: {
          results: [
            {
              ref: 'e1',
              requestedValue: 'Alice',
              actualValue: 'Alice',
              matched: true,
              strategy: 'label',
            },
          ],
        },
      })),
    };
    const eventBus = { publish: vi.fn() };
    const useCase = new ExecuteActionUseCase(
      sessionService as any,
      interactionService as any,
      {} as any,
      eventBus as any,
    );

    const result = await useCase.execute({
      cdpUrl: 'http://127.0.0.1:9222',
      targetId: 'tab-1',
      action: { kind: 'fill', fields: [{ ref: 'e1', type: 'text', value: 'Alice' }] } as any,
    });

    expect(result).toMatchObject({
      ok: true,
      allMatched: true,
      mismatched: false,
      results: [{ ref: 'e1', requestedValue: 'Alice' }],
    });
    expect(sessionService.storeRoleRefs).toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
  });

  it('uses discovery before click/type actions and surfaces dismiss failures', async () => {
    const useCase = new ExecuteActionUseCase(
      {
        getPage: vi.fn(async () => ({ url: () => 'https://example.test' })),
        restoreRoleRefs: vi.fn(async () => undefined),
        getSession: vi.fn(async () => ({
          getRoleRefs: () => ({}),
          getRoleRefsMode: () => 'aria',
        })),
        refLocator: vi.fn(() => ({})),
      } as any,
      {
        executeAction: vi.fn(async () => ({ ok: true })),
      } as any,
      {
        detectBlockingElement: vi.fn(async () => ({
          isBlocked: true,
          dismissStrategy: 'click_close',
          blockerTagName: 'dialog',
        })),
        dismissBlocker: vi.fn(async () => ({ dismissed: false })),
      } as any,
    );

    const result = await useCase.execute({
      targetId: 'tab-1',
      action: { kind: 'click', ref: 'e1' } as any,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Unable to dismiss blocking element: dialog',
    });
  });
});
