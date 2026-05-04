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
      endpoint: 'wss://browser.example.com/?token=test-token&workerId=configured-browserless-1',
      assignedRunIds: ['run-1', 'run-2'],
      maxSessions: 5,
    });
    expect(status.maxTotalSessions).toBe(20);
    expect(status.maxSessionsPerWorker).toBe(5);
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

  it('reports tracked workers as running for readiness waits', async () => {
    const allocator = new InMemoryBrowserlessAllocatorAdapter();

    const assignment = await allocator.assignRun({
      runId: 'run-1',
      sessionId: 'session-1',
      profile,
    });

    await expect(
      allocator.waitForWorkerRunning({
        taskId: assignment.taskId,
        endpoint: assignment.endpoint,
        timeoutMs: 1_000,
        pollIntervalMs: 100,
      }),
    ).resolves.toMatchObject({
      taskId: assignment.taskId,
      endpoint: assignment.endpoint,
    });
  });

  it('packs runs onto the oldest non-full worker before creating a new one', async () => {
    const allocator = new InMemoryBrowserlessAllocatorAdapter({
      maxSessionsPerWorker: 2,
      maxTotalSessions: 6,
    });

    const first = await allocator.assignRun({ runId: 'run-1', sessionId: 'session-1', profile });
    const second = await allocator.assignRun({ runId: 'run-2', sessionId: 'session-2', profile });
    const third = await allocator.assignRun({ runId: 'run-3', sessionId: 'session-3', profile });

    expect(first.taskId).toBe('configured-browserless-1');
    expect(second.taskId).toBe('configured-browserless-1');
    expect(third.taskId).toBe('configured-browserless-2');
  });

  it('rejects new runs when max total browserless sessions are exhausted', async () => {
    const allocator = new InMemoryBrowserlessAllocatorAdapter({
      maxSessionsPerWorker: 2,
      maxTotalSessions: 3,
    });

    await allocator.assignRun({ runId: 'run-1', sessionId: 'session-1', profile });
    await allocator.assignRun({ runId: 'run-2', sessionId: 'session-2', profile });
    await allocator.assignRun({ runId: 'run-3', sessionId: 'session-3', profile });

    await expect(
      allocator.assignRun({ runId: 'run-4', sessionId: 'session-4', profile }),
    ).rejects.toMatchObject({
      name: 'BrowserlessCapacityExceededError',
      active: 3,
      max: 3,
    });
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
