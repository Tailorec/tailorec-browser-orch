import { afterEach, describe, expect, it, vi } from 'vitest';
import { EcsBrowserlessAllocatorAdapter } from '../../adapters/browser/ecs-browserless-allocator.adapter.js';

const profile = {
  name: 'default',
  provider: 'browserless' as const,
  browserEndpoint: 'http://127.0.0.1:3000',
  browserEndpointIsLoopback: true,
  driver: 'chrome' as const,
  color: 'blue',
};

type FakeTask = {
  taskArn: string;
  lastStatus?: string;
  privateIp?: string;
  stoppedReason?: string;
  stopCode?: string;
  tags?: Array<{ key?: string; value?: string }>;
};

function createFakeControlPlane() {
  const tasks = new Map<string, FakeTask>();
  const stopCalls: Array<{ taskArn: string; reason?: string }> = [];
  let nextTask = 1;

  return {
    tasks,
    stopCalls,
    async runTask(input: { tags: Array<{ key?: string; value?: string }> }) {
      const taskArn = `arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-${nextTask}`;
      nextTask += 1;
      tasks.set(taskArn, {
        taskArn,
        lastStatus: 'PENDING',
        tags: input.tags,
      });
      return { taskArn };
    },
    async describeTasks(input: { taskArns: string[] }) {
      return input.taskArns
        .map((taskArn) => tasks.get(taskArn))
        .filter((task): task is FakeTask => Boolean(task))
        .map((task) => ({ ...task }));
    },
    async listTasks() {
      return Array.from(tasks.keys());
    },
    async stopTask(input: { taskArn: string; reason?: string }) {
      stopCalls.push(input);
      tasks.delete(input.taskArn);
    },
  };
}

describe('EcsBrowserlessAllocatorAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('launches browserless ECS tasks and packs runs onto the oldest non-full worker', async () => {
    const ecs = createFakeControlPlane();
    const allocator = new EcsBrowserlessAllocatorAdapter({
      cluster: 'cluster-1',
      taskDefinition: 'arn:aws:ecs:us-east-1:123456789012:task-definition/tailorec-prod-browserless:7',
      subnetIds: ['subnet-1'],
      securityGroupIds: ['sg-1'],
      assignPublicIp: 'DISABLED',
      browserlessPort: 3000,
      browserlessToken: 'test-token',
      maxSessionsPerWorker: 2,
      maxTotalSessions: 4,
      ecsClient: ecs,
    });

    const first = await allocator.assignRun({ runId: 'run-1', sessionId: 'session-1', profile });
    ecs.tasks.get('arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-1')!.lastStatus = 'RUNNING';
    ecs.tasks.get('arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-1')!.privateIp = '10.0.1.10';
    const running = await allocator.waitForWorkerRunning({
      taskId: first.taskId,
      endpoint: first.endpoint,
      timeoutMs: 1_000,
      pollIntervalMs: 1,
    });
    const second = await allocator.assignRun({ runId: 'run-2', sessionId: 'session-2', profile });
    const third = await allocator.assignRun({ runId: 'run-3', sessionId: 'session-3', profile });

    expect(running.endpoint).toBe('http://10.0.1.10:3000/?token=test-token');
    expect(second.taskId).toBe(first.taskId);
    expect(third.taskId).not.toBe(first.taskId);

    const status = await allocator.getStatusSnapshot();
    expect(status.totalAssignedRuns).toBe(3);
    expect(status.workers).toHaveLength(2);
    expect(status.workers[0]).toMatchObject({
      taskId: first.taskId,
      endpoint: 'http://10.0.1.10:3000/?token=test-token',
      assignedRunIds: ['run-1', 'run-2'],
    });
  });

  it('stops an empty worker after idle grace', async () => {
    vi.useFakeTimers();
    const ecs = createFakeControlPlane();
    const allocator = new EcsBrowserlessAllocatorAdapter({
      cluster: 'cluster-1',
      taskDefinition: 'arn:aws:ecs:us-east-1:123456789012:task-definition/tailorec-prod-browserless:7',
      subnetIds: ['subnet-1'],
      securityGroupIds: ['sg-1'],
      assignPublicIp: 'DISABLED',
      browserlessPort: 3000,
      idleGraceMs: 5_000,
      ecsClient: ecs,
    });

    const assignment = await allocator.assignRun({ runId: 'run-1', sessionId: 'session-1', profile });
    ecs.tasks.get('arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-1')!.lastStatus = 'RUNNING';
    ecs.tasks.get('arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-1')!.privateIp = '10.0.1.11';
    await allocator.waitForWorkerRunning({
      taskId: assignment.taskId,
      endpoint: assignment.endpoint,
      timeoutMs: 1_000,
      pollIntervalMs: 1,
    });

    await allocator.releaseRun('run-1');
    await vi.advanceTimersByTimeAsync(5_000);

    expect(ecs.stopCalls).toHaveLength(1);
    expect((await allocator.getStatusSnapshot()).workers).toHaveLength(0);
  });

  it('marks unavailable workers and launches a new task for the next run', async () => {
    const ecs = createFakeControlPlane();
    const allocator = new EcsBrowserlessAllocatorAdapter({
      cluster: 'cluster-1',
      taskDefinition: 'arn:aws:ecs:us-east-1:123456789012:task-definition/tailorec-prod-browserless:7',
      subnetIds: ['subnet-1'],
      securityGroupIds: ['sg-1'],
      assignPublicIp: 'DISABLED',
      browserlessPort: 3000,
      maxSessionsPerWorker: 1,
      ecsClient: ecs,
    });

    const first = await allocator.assignRun({ runId: 'run-1', sessionId: 'session-1', profile });
    await allocator.markWorkerUnavailable({
      taskId: first.taskId,
      endpoint: first.endpoint,
      reason: 'browser disconnected',
    });
    await allocator.releaseRun('run-1');

    const second = await allocator.assignRun({ runId: 'run-2', sessionId: 'session-2', profile });

    expect(second.taskId).not.toBe(first.taskId);
  });

  it('stops prior-owner browserless tasks during orphan reconciliation', async () => {
    const ecs = createFakeControlPlane();
    ecs.tasks.set('arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-old', {
      taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-old',
      lastStatus: 'RUNNING',
      tags: [
        { key: 'openclaw-browserless-owner-scope', value: 'openclaw-browser' },
        { key: 'openclaw-browserless-owner-id', value: 'old-owner' },
      ],
    });
    ecs.tasks.set('arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-current', {
      taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-current',
      lastStatus: 'RUNNING',
      tags: [
        { key: 'openclaw-browserless-owner-scope', value: 'openclaw-browser' },
        { key: 'openclaw-browserless-owner-id', value: 'current-owner' },
      ],
    });

    const allocator = new EcsBrowserlessAllocatorAdapter({
      cluster: 'cluster-1',
      taskDefinition: 'arn:aws:ecs:us-east-1:123456789012:task-definition/tailorec-prod-browserless:7',
      subnetIds: ['subnet-1'],
      securityGroupIds: ['sg-1'],
      assignPublicIp: 'DISABLED',
      browserlessPort: 3000,
      ownerId: 'current-owner',
      ecsClient: ecs,
    });

    const reconciliation = await allocator.reconcileOrphans();

    expect(reconciliation).toEqual({
      discoveredWorkerCount: 2,
      stoppedWorkerCount: 1,
    });
    expect(ecs.stopCalls).toEqual([
      expect.objectContaining({
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/tailorec-prod-cluster/task-old',
      }),
    ]);
  });
});
