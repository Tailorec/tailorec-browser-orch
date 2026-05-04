import { describe, expect, it } from 'vitest';
import { InMemoryBrowserlessAllocatorAdapter } from '../../adapters/browser/in-memory-browserless-allocator.adapter.js';

const profile = {
  name: 'default',
  provider: 'browserless' as const,
  browserEndpoint: 'wss://browser.example.com?token=test-token',
  browserEndpointIsLoopback: false,
  driver: 'chrome' as const,
  color: 'blue',
};

describe('InMemoryBrowserlessAllocatorAdapter', () => {
  it('tracks run-to-worker assignments in status snapshots', async () => {
    const allocator = new InMemoryBrowserlessAllocatorAdapter();

    await allocator.assignRun({
      runId: 'run-1',
      sessionId: 'session-1',
      profile,
    });
    await allocator.assignRun({
      runId: 'run-2',
      sessionId: 'session-2',
      profile,
    });

    const status = await allocator.getStatusSnapshot();

    expect(status.totalAssignedRuns).toBe(2);
    expect(status.workers).toHaveLength(1);
    expect(status.workers[0]).toMatchObject({
      taskId: 'configured-browserless-1',
      endpoint: 'wss://browser.example.com?token=test-token',
      assignedRunIds: ['run-1', 'run-2'],
    });
  });

  it('releases assignments without disturbing other runs on the same worker', async () => {
    const allocator = new InMemoryBrowserlessAllocatorAdapter();

    await allocator.assignRun({
      runId: 'run-1',
      sessionId: 'session-1',
      profile,
    });
    await allocator.assignRun({
      runId: 'run-2',
      sessionId: 'session-2',
      profile,
    });

    await allocator.releaseRun('run-1');

    const status = await allocator.getStatusSnapshot();
    expect(status.totalAssignedRuns).toBe(1);
    expect(status.workers).toHaveLength(1);
    expect(status.workers[0]?.assignedRunIds).toEqual(['run-2']);
  });

  it('exposes orphan reconciliation as a stable no-op in the in-memory implementation', async () => {
    const allocator = new InMemoryBrowserlessAllocatorAdapter();

    await allocator.assignRun({
      runId: 'run-1',
      sessionId: 'session-1',
      profile,
    });

    const reconciliation = await allocator.reconcileOrphans();
    const status = await allocator.getStatusSnapshot();

    expect(reconciliation).toEqual({
      discoveredWorkerCount: 0,
      stoppedWorkerCount: 0,
    });
    expect(status.totalAssignedRuns).toBe(1);
  });
});
