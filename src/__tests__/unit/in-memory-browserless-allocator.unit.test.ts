import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.useRealTimers();
  });

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
      idleSince: null,
      ownership: {
        ownerScope: 'openclaw-browser',
        ownerId: expect.any(String),
      },
      unavailableSince: null,
      unavailableReason: null,
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

  it('keeps an empty worker alive until the idle grace elapses', async () => {
    vi.useFakeTimers();
    const allocator = new InMemoryBrowserlessAllocatorAdapter({
      idleGraceMs: 5_000,
    });

    await allocator.assignRun({
      runId: 'run-1',
      sessionId: 'session-1',
      profile,
    });

    await allocator.releaseRun('run-1');

    let status = await allocator.getStatusSnapshot();
    expect(status.workers).toHaveLength(1);
    expect(status.workers[0]?.idleSince).toBeTypeOf('number');

    await vi.advanceTimersByTimeAsync(4_999);
    status = await allocator.getStatusSnapshot();
    expect(status.workers).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    status = await allocator.getStatusSnapshot();
    expect(status.workers).toHaveLength(0);
  });

  it('reuses an idle worker if demand returns before idle shutdown', async () => {
    vi.useFakeTimers();
    const allocator = new InMemoryBrowserlessAllocatorAdapter({
      maxSessionsPerWorker: 2,
      idleGraceMs: 5_000,
    });

    const first = await allocator.assignRun({
      runId: 'run-1',
      sessionId: 'session-1',
      profile,
    });
    await allocator.releaseRun('run-1');

    await vi.advanceTimersByTimeAsync(2_000);
    const second = await allocator.assignRun({
      runId: 'run-2',
      sessionId: 'session-2',
      profile,
    });

    expect(second.taskId).toBe(first.taskId);
    const status = await allocator.getStatusSnapshot();
    expect(status.workers).toHaveLength(1);
    expect(status.workers[0]?.idleSince).toBeNull();
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

  it('marks an unavailable worker so it is not reused for later runs', async () => {
    const allocator = new InMemoryBrowserlessAllocatorAdapter({
      maxSessionsPerWorker: 1,
    });

    const first = await allocator.assignRun({
      runId: 'run-1',
      sessionId: 'session-1',
      profile,
    });

    await allocator.markWorkerUnavailable({
      taskId: first.taskId,
      endpoint: first.endpoint,
      reason: 'worker disconnected',
    });

    await allocator.releaseRun('run-1');

    const second = await allocator.assignRun({
      runId: 'run-2',
      sessionId: 'session-2',
      profile,
    });

    expect(second.taskId).toBe('configured-browserless-2');
    const status = await allocator.getStatusSnapshot();
    expect(status.workers).toHaveLength(1);
    expect(status.workers[0]).toMatchObject({
      taskId: 'configured-browserless-2',
      unavailableSince: null,
      unavailableReason: null,
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

  it('stops prior-owner workers during orphan reconciliation', async () => {
    const stopOwnedWorker = vi.fn(async () => undefined);
    const allocator = new InMemoryBrowserlessAllocatorAdapter({
      ownerScope: 'openclaw-browser',
      ownerId: 'current-owner',
      listOwnedWorkers: async () => [
        {
          taskId: 'task-current',
          endpoint: 'wss://browser.example.com/current',
          ownership: { ownerScope: 'openclaw-browser', ownerId: 'current-owner' },
        },
        {
          taskId: 'task-orphan',
          endpoint: 'wss://browser.example.com/orphan',
          ownership: { ownerScope: 'openclaw-browser', ownerId: 'old-owner' },
        },
        {
          taskId: 'task-foreign',
          endpoint: 'wss://browser.example.com/foreign',
          ownership: { ownerScope: 'another-service', ownerId: 'foreign-owner' },
        },
      ],
      stopOwnedWorker,
    });

    const reconciliation = await allocator.reconcileOrphans();

    expect(reconciliation).toEqual({
      discoveredWorkerCount: 3,
      stoppedWorkerCount: 1,
    });
    expect(stopOwnedWorker).toHaveBeenCalledTimes(1);
    expect(stopOwnedWorker).toHaveBeenCalledWith({
      taskId: 'task-orphan',
      endpoint: 'wss://browser.example.com/orphan',
      ownership: { ownerScope: 'openclaw-browser', ownerId: 'old-owner' },
    });
  });
});
