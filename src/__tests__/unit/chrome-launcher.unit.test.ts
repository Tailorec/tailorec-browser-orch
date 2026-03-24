import { describe, expect, it, vi } from 'vitest';
import { TakeSnapshotUseCase } from '../../core/use-cases/take-snapshot.use-case.js';

describe('TakeSnapshotUseCase', () => {
  it('captures AI snapshots and stores refs in the session', async () => {
    const sessionService = {
      getPage: vi.fn(async () => ({ url: () => 'https://example.test' })),
      storeRoleRefs: vi.fn(async () => undefined),
    };
    const snapshotService = {
      captureSnapshot: vi.fn(async () => ({
        snapshot: 'snapshot',
        refs: { e1: { role: 'button' } },
        stats: { lines: 1, chars: 8, refs: 1, interactive: 1 },
        truncated: false,
      })),
    };
    const useCase = new TakeSnapshotUseCase(sessionService as any, snapshotService as any);

    const result = await useCase.execute({ targetId: 'tab-1' });

    expect(result).toMatchObject({
      ok: true,
      snapshot: 'snapshot',
      refs: { e1: { role: 'button' } },
    });
    expect(sessionService.storeRoleRefs).toHaveBeenCalledWith('tab-1', { e1: { role: 'button' } }, 'aria');
  });

  it('captures aria snapshots without storing refs', async () => {
    const sessionService = {
      getPage: vi.fn(async () => ({ url: () => 'https://example.test' })),
      storeRoleRefs: vi.fn(async () => undefined),
    };
    const snapshotService = {
      captureAriaSnapshot: vi.fn(async () => ({ nodes: [{ role: 'button' }] })),
    };
    const useCase = new TakeSnapshotUseCase(sessionService as any, snapshotService as any);

    const result = await useCase.execute({ type: 'aria', options: { ariaLimit: 10 } });

    expect(result).toEqual({
      ok: true,
      nodes: [{ role: 'button' }],
      targetId: undefined,
      url: 'https://example.test',
    });
    expect(sessionService.storeRoleRefs).not.toHaveBeenCalled();
  });
});
