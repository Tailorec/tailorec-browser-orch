import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
  ListTasksCommand,
  StopTaskCommand,
  type AssignPublicIp,
  type Tag,
} from '@aws-sdk/client-ecs';
import type {
  BrowserlessOwnedWorkerRecord,
  BrowserlessAllocatorStatusSnapshot,
  BrowserlessOrphanReconciliationResult,
  BrowserlessWorkerAssignment,
  BrowserlessWorkerOwnership,
  BrowserlessWorkerRunningState,
  IBrowserlessAllocator,
} from '../../core/ports/browserless-allocator.port.js';
import { BrowserlessCapacityExceededError } from '../../core/ports/browserless-allocator.port.js';
import type { ResolvedBrowserProfile } from '../../config/config.types.js';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('ecs-browserless-allocator');

type EcsTaskRecord = {
  taskArn: string;
  lastStatus?: string;
  stoppedReason?: string;
  stopCode?: string;
  tags?: Array<{ key?: string; value?: string }>;
  privateIp?: string;
};

type EcsBrowserlessControlPlane = {
  runTask(input: {
    cluster: string;
    taskDefinition: string;
    subnetIds: string[];
    securityGroupIds: string[];
    assignPublicIp: AssignPublicIp;
    startedBy: string;
    tags: Tag[];
  }): Promise<{ taskArn: string }>;
  describeTasks(input: {
    cluster: string;
    taskArns: string[];
    includeTags?: boolean;
  }): Promise<EcsTaskRecord[]>;
  listTasks(input: {
    cluster: string;
    family: string;
  }): Promise<string[]>;
  stopTask(input: {
    cluster: string;
    taskArn: string;
    reason?: string;
  }): Promise<void>;
};

type TrackedWorker = {
  taskArn: string;
  taskId: string;
  endpoint: string;
  assignedRunIds: Set<string>;
  createdAt: number;
  runningAt: number;
  lastAssignedAt: number;
  maxSessions: number;
  idleSince: number | null;
  ownership: BrowserlessWorkerOwnership;
  unavailableSince: number | null;
  unavailableReason: string | null;
  idleShutdownTimer?: ReturnType<typeof setTimeout>;
};

export type EcsBrowserlessAllocatorOptions = {
  cluster: string;
  taskDefinition: string;
  subnetIds: string[];
  securityGroupIds: string[];
  assignPublicIp: AssignPublicIp;
  browserlessPort: number;
  browserlessToken?: string;
  maxSessionsPerWorker?: number;
  maxTotalSessions?: number;
  idleGraceMs?: number;
  ownerScope?: string;
  ownerId?: string;
  ecsClient?: EcsBrowserlessControlPlane;
  region?: string;
};

class AwsSdkEcsBrowserlessControlPlane implements EcsBrowserlessControlPlane {
  constructor(private readonly ecsClient: ECSClient) {}

  async runTask(input: {
    cluster: string;
    taskDefinition: string;
    subnetIds: string[];
    securityGroupIds: string[];
    assignPublicIp: AssignPublicIp;
    startedBy: string;
    tags: Tag[];
  }): Promise<{ taskArn: string }> {
    const response = await this.ecsClient.send(
      new RunTaskCommand({
        cluster: input.cluster,
        taskDefinition: input.taskDefinition,
        launchType: 'FARGATE',
        count: 1,
        startedBy: input.startedBy,
        enableECSManagedTags: true,
        tags: input.tags,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: input.subnetIds,
            securityGroups: input.securityGroupIds,
            assignPublicIp: input.assignPublicIp,
          },
        },
      }),
    );

    if ((response.failures?.length ?? 0) > 0) {
      const failure = response.failures?.[0];
      throw new Error(failure?.reason ?? failure?.detail ?? 'failed to run browserless ECS task');
    }

    const taskArn = response.tasks?.[0]?.taskArn;
    if (!taskArn) {
      throw new Error('browserless ECS task launch returned no task ARN');
    }

    return { taskArn };
  }

  async describeTasks(input: {
    cluster: string;
    taskArns: string[];
    includeTags?: boolean;
  }): Promise<EcsTaskRecord[]> {
    if (input.taskArns.length === 0) {
      return [];
    }

    const response = await this.ecsClient.send(
      new DescribeTasksCommand({
        cluster: input.cluster,
        tasks: input.taskArns,
        include: input.includeTags ? ['TAGS'] : undefined,
      }),
    );

    return (response.tasks ?? []).map((task) => ({
      taskArn: task.taskArn ?? '',
      lastStatus: task.lastStatus,
      stoppedReason: task.stoppedReason,
      stopCode: task.stopCode,
      tags: task.tags?.map((tag) => ({ key: tag.key, value: tag.value })),
      privateIp:
        task.attachments
          ?.flatMap((attachment) => attachment.details ?? [])
          .find((detail) => detail.name === 'privateIPv4Address')
          ?.value ?? undefined,
    }));
  }

  async listTasks(input: {
    cluster: string;
    family: string;
  }): Promise<string[]> {
    const response = await this.ecsClient.send(
      new ListTasksCommand({
        cluster: input.cluster,
        family: input.family,
      }),
    );

    return response.taskArns ?? [];
  }

  async stopTask(input: {
    cluster: string;
    taskArn: string;
    reason?: string;
  }): Promise<void> {
    await this.ecsClient.send(
      new StopTaskCommand({
        cluster: input.cluster,
        task: input.taskArn,
        reason: input.reason,
      }),
    );
  }
}

function parseTaskId(taskArn: string): string {
  const segments = taskArn.split('/');
  return segments[segments.length - 1] || taskArn;
}

function parseTaskDefinitionFamily(taskDefinition: string): string {
  const match = taskDefinition.match(/task-definition\/([^:]+)(?::|$)/);
  if (!match?.[1]) {
    throw new Error(`unable to parse ECS task definition family from ${taskDefinition}`);
  }
  return match[1];
}

function toOwnershipTags(ownership: BrowserlessWorkerOwnership): Tag[] {
  return [
    { key: 'openclaw-browserless-owner-scope', value: ownership.ownerScope },
    { key: 'openclaw-browserless-owner-id', value: ownership.ownerId },
    { key: 'openclaw-browserless-managed-by', value: 'openclaw-browser' },
  ];
}

function tagsToOwnership(tags: Array<{ key?: string; value?: string }> | undefined): BrowserlessWorkerOwnership | null {
  const ownerScope = tags?.find((tag) => tag.key === 'openclaw-browserless-owner-scope')?.value;
  const ownerId = tags?.find((tag) => tag.key === 'openclaw-browserless-owner-id')?.value;
  if (!ownerScope || !ownerId) {
    return null;
  }
  return { ownerScope, ownerId };
}

export class EcsBrowserlessAllocatorAdapter implements IBrowserlessAllocator {
  private readonly workersByTaskId = new Map<string, TrackedWorker>();
  private readonly assignmentsByRunId = new Map<string, BrowserlessWorkerAssignment>();
  private readonly maxSessionsPerWorker: number;
  private readonly maxTotalSessions: number;
  private readonly idleGraceMs: number;
  private readonly ownership: BrowserlessWorkerOwnership;
  private readonly ecs: EcsBrowserlessControlPlane;
  private readonly family: string;

  constructor(private readonly options: EcsBrowserlessAllocatorOptions) {
    this.maxSessionsPerWorker = options.maxSessionsPerWorker ?? 5;
    this.maxTotalSessions = options.maxTotalSessions ?? 20;
    this.idleGraceMs = options.idleGraceMs ?? 30_000;
    this.ownership = {
      ownerScope: options.ownerScope ?? 'openclaw-browser',
      ownerId: options.ownerId ?? `openclaw-browser-${process.pid}-${Date.now()}`,
    };
    this.ecs =
      options.ecsClient ??
      new AwsSdkEcsBrowserlessControlPlane(
        new ECSClient({
          region: options.region,
        }),
      );
    this.family = parseTaskDefinitionFamily(options.taskDefinition);
  }

  private buildWorkerEndpoint(profile: ResolvedBrowserProfile, privateIpOrHost: string): string {
    const url = new URL(profile.browserEndpoint);
    url.hostname = privateIpOrHost;
    url.port = String(this.options.browserlessPort);
    if (this.options.browserlessToken && !url.searchParams.has('token')) {
      url.searchParams.set('token', this.options.browserlessToken);
    }
    return url.toString();
  }

  private clearIdleShutdown(worker: TrackedWorker): void {
    if (worker.idleShutdownTimer) {
      clearTimeout(worker.idleShutdownTimer);
      worker.idleShutdownTimer = undefined;
    }
    worker.idleSince = null;
  }

  private async stopWorker(worker: TrackedWorker, reason: string): Promise<void> {
    try {
      await this.ecs.stopTask({
        cluster: this.options.cluster,
        taskArn: worker.taskArn,
        reason,
      });
      log.info('browserless worker stopped', {
        task_id: worker.taskId,
        reason,
      });
    } catch (error) {
      log.warn('browserless worker stop failed', {
        task_id: worker.taskId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    this.workersByTaskId.delete(worker.taskId);
    if (worker.idleShutdownTimer) {
      clearTimeout(worker.idleShutdownTimer);
      worker.idleShutdownTimer = undefined;
    }
  }

  private scheduleIdleShutdown(worker: TrackedWorker, now: number): void {
    worker.idleSince = now;
    log.info('browserless worker entered idle grace', {
      task_id: worker.taskId,
      idle_grace_ms: this.idleGraceMs,
    });
    if (this.idleGraceMs <= 0) {
      void this.stopWorker(worker, 'idle browserless worker shutdown').catch(() => undefined);
      return;
    }

    if (worker.idleShutdownTimer) {
      clearTimeout(worker.idleShutdownTimer);
    }

    worker.idleShutdownTimer = setTimeout(() => {
      worker.idleShutdownTimer = undefined;
      if (worker.assignedRunIds.size > 0) {
        return;
      }
      void this.stopWorker(worker, 'idle browserless worker shutdown').catch(() => undefined);
    }, this.idleGraceMs);
    if (typeof worker.idleShutdownTimer.unref === 'function') {
      worker.idleShutdownTimer.unref();
    }
  }

  private async refreshWorkerFromEcs(worker: TrackedWorker, profile: ResolvedBrowserProfile): Promise<TrackedWorker> {
    const [record] = await this.ecs.describeTasks({
      cluster: this.options.cluster,
      taskArns: [worker.taskArn],
    });

    if (!record) {
      throw new Error(`browserless worker ${worker.taskId} is no longer visible in ECS`);
    }

    if (record.lastStatus === 'STOPPED') {
      worker.unavailableSince = worker.unavailableSince ?? Date.now();
      worker.unavailableReason =
        worker.unavailableReason ??
        record.stoppedReason ??
        record.stopCode ??
        'browserless ECS task stopped';
      throw new Error(worker.unavailableReason);
    }

    if (record.privateIp) {
      const nextEndpoint = this.buildWorkerEndpoint(profile, record.privateIp);
      if (worker.endpoint !== nextEndpoint) {
        worker.endpoint = nextEndpoint;
        for (const runId of worker.assignedRunIds) {
          const assignment = this.assignmentsByRunId.get(runId);
          if (assignment) {
            assignment.endpoint = nextEndpoint;
          }
        }
      }
    }

    if (record.lastStatus === 'RUNNING' && worker.runningAt === 0) {
      worker.runningAt = Date.now();
      log.info('browserless worker reached running state', {
        task_id: worker.taskId,
        endpoint: worker.endpoint,
      });
    }

    return worker;
  }

  async assignRun(input: {
    runId: string;
    sessionId: string;
    profile: ResolvedBrowserProfile;
  }): Promise<BrowserlessWorkerAssignment> {
    const existing = this.assignmentsByRunId.get(input.runId);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    if (this.assignmentsByRunId.size >= this.maxTotalSessions) {
      throw new BrowserlessCapacityExceededError(
        `browserless capacity exceeded: ${this.assignmentsByRunId.size}/${this.maxTotalSessions}`,
        this.assignmentsByRunId.size,
        this.maxTotalSessions,
      );
    }

    const worker = Array.from(this.workersByTaskId.values())
      .sort((left, right) => left.createdAt - right.createdAt)
      .find(
        (candidate) =>
          candidate.unavailableSince === null && candidate.assignedRunIds.size < candidate.maxSessions,
      );

    let selectedWorker = worker;
    let assignment: BrowserlessWorkerAssignment | null = null;
    if (!selectedWorker) {
      log.info('browserless worker launch requested', {
        cluster: this.options.cluster,
        task_definition: this.options.taskDefinition,
      });
      const launched = await this.ecs.runTask({
        cluster: this.options.cluster,
        taskDefinition: this.options.taskDefinition,
        subnetIds: this.options.subnetIds,
        securityGroupIds: this.options.securityGroupIds,
        assignPublicIp: this.options.assignPublicIp,
        startedBy: this.ownership.ownerId,
        tags: toOwnershipTags(this.ownership),
      });
      selectedWorker = {
        taskArn: launched.taskArn,
        taskId: parseTaskId(launched.taskArn),
        endpoint: input.profile.browserEndpoint,
        assignedRunIds: new Set([input.runId]),
        createdAt: now,
        runningAt: 0,
        lastAssignedAt: now,
        maxSessions: this.maxSessionsPerWorker,
        idleSince: null,
        ownership: this.ownership,
        unavailableSince: null,
        unavailableReason: null,
      };
      assignment = {
        runId: input.runId,
        taskId: selectedWorker.taskId,
        endpoint: selectedWorker.endpoint,
        assignedAt: now,
      };
      this.assignmentsByRunId.set(input.runId, assignment);
      this.workersByTaskId.set(selectedWorker.taskId, selectedWorker);
      log.info('browserless worker launched', {
        task_id: selectedWorker.taskId,
        task_arn: selectedWorker.taskArn,
      });
      try {
        await this.refreshWorkerFromEcs(selectedWorker, input.profile);
      } catch {
        // Endpoint discovery may lag behind task launch. Readiness waits will refresh later.
      }
    }

    this.clearIdleShutdown(selectedWorker);
    if (!assignment) {
      selectedWorker.assignedRunIds.add(input.runId);
      selectedWorker.lastAssignedAt = now;
      assignment = {
        runId: input.runId,
        taskId: selectedWorker.taskId,
        endpoint: selectedWorker.endpoint,
        assignedAt: now,
      };
      this.assignmentsByRunId.set(input.runId, assignment);
    }
    log.info('browserless run assigned', {
      run_id: input.runId,
      task_id: selectedWorker.taskId,
      assigned_runs: selectedWorker.assignedRunIds.size,
    });
    return assignment;
  }

  async getAssignment(runId: string): Promise<BrowserlessWorkerAssignment | null> {
    const assignment = this.assignmentsByRunId.get(runId);
    if (!assignment) {
      return null;
    }

    const worker = this.workersByTaskId.get(assignment.taskId);
    if (worker) {
      assignment.endpoint = worker.endpoint;
    }
    return assignment;
  }

  async releaseRun(runId: string): Promise<void> {
    const assignment = this.assignmentsByRunId.get(runId);
    if (!assignment) {
      return;
    }

    this.assignmentsByRunId.delete(runId);
    const worker = this.workersByTaskId.get(assignment.taskId);
    if (!worker) {
      return;
    }

    worker.assignedRunIds.delete(runId);
    log.info('browserless run released', {
      run_id: runId,
      task_id: worker.taskId,
      assigned_runs: worker.assignedRunIds.size,
    });
    if (worker.assignedRunIds.size === 0) {
      if (worker.unavailableSince !== null) {
        try {
          await this.stopWorker(worker, 'unavailable browserless worker released');
        } catch {
          return;
        }
      } else {
        this.scheduleIdleShutdown(worker, Date.now());
      }
    }
  }

  async waitForWorkerRunning(input: {
    taskId: string;
    endpoint: string;
    timeoutMs: number;
    pollIntervalMs: number;
  }): Promise<BrowserlessWorkerRunningState> {
    const worker = this.workersByTaskId.get(input.taskId);
    if (!worker) {
      throw new Error(`browserless worker ${input.taskId} is not tracked`);
    }
    if (worker.unavailableSince !== null) {
      throw new Error(
        worker.unavailableReason
          ? `browserless worker ${input.taskId} is unavailable: ${worker.unavailableReason}`
          : `browserless worker ${input.taskId} is unavailable`,
      );
    }

    const startedAt = Date.now();
    for (;;) {
      try {
        await this.refreshWorkerFromEcs(worker, {
          name: 'browserless',
          provider: 'browserless',
          browserEndpoint: input.endpoint || worker.endpoint,
          browserEndpointIsLoopback: false,
          driver: 'chrome',
          color: 'blue',
        });
      } catch (error) {
        worker.unavailableSince = worker.unavailableSince ?? Date.now();
        worker.unavailableReason = worker.unavailableReason ?? (error instanceof Error ? error.message : String(error));
        throw error;
      }

      if (worker.runningAt > 0) {
        return {
          taskId: worker.taskId,
          endpoint: worker.endpoint,
          runningAt: worker.runningAt,
        };
      }

      if (Date.now() - startedAt >= input.timeoutMs) {
        throw new Error(`timed out waiting for browserless worker ${input.taskId} to reach RUNNING`);
      }

      await sleep(input.pollIntervalMs);
    }
  }

  async markWorkerUnavailable(input: { taskId: string; endpoint: string; reason?: string }): Promise<void> {
    const worker = this.workersByTaskId.get(input.taskId);
    if (!worker) {
      return;
    }
    this.clearIdleShutdown(worker);
    worker.unavailableSince = Date.now();
    worker.unavailableReason = input.reason ?? null;
    log.warn('browserless worker marked unavailable', {
      task_id: worker.taskId,
      reason: worker.unavailableReason,
    });
    if (worker.assignedRunIds.size === 0) {
      try {
        await this.stopWorker(worker, 'browserless worker marked unavailable');
      } catch {
        return;
      }
    }
  }

  async getStatusSnapshot(): Promise<BrowserlessAllocatorStatusSnapshot> {
    return {
      totalAssignedRuns: this.assignmentsByRunId.size,
      maxTotalSessions: this.maxTotalSessions,
      maxSessionsPerWorker: this.maxSessionsPerWorker,
      workers: Array.from(this.workersByTaskId.values()).map((worker) => ({
        taskId: worker.taskId,
        endpoint: worker.endpoint,
        assignedRunIds: Array.from(worker.assignedRunIds),
        createdAt: worker.createdAt,
        lastAssignedAt: worker.lastAssignedAt,
        maxSessions: worker.maxSessions,
        idleSince: worker.idleSince,
        ownership: worker.ownership,
        unavailableSince: worker.unavailableSince,
        unavailableReason: worker.unavailableReason,
      })),
    };
  }

  async reconcileOrphans(): Promise<BrowserlessOrphanReconciliationResult> {
    const taskArns = await this.ecs.listTasks({
      cluster: this.options.cluster,
      family: this.family,
    });
    const tasks = await this.ecs.describeTasks({
      cluster: this.options.cluster,
      taskArns,
      includeTags: true,
    });

    let stoppedWorkerCount = 0;
    for (const task of tasks) {
      const ownership = tagsToOwnership(task.tags);
      if (!ownership) {
        continue;
      }
      if (ownership.ownerScope !== this.ownership.ownerScope) {
        continue;
      }
      if (ownership.ownerId === this.ownership.ownerId) {
        continue;
      }

      try {
        await this.ecs.stopTask({
          cluster: this.options.cluster,
          taskArn: task.taskArn,
          reason: 'openclaw-browser startup orphan reconciliation',
        });
        stoppedWorkerCount += 1;
        log.info('browserless orphan worker stopped', {
          task_arn: task.taskArn,
          owner_id: ownership.ownerId,
        });
      } catch (error) {
        log.warn('browserless orphan stop failed', {
          task_arn: task.taskArn,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    log.info('browserless allocator orphan reconciliation completed', {
      discovered_workers: tasks.filter((task) => {
        const ownership = tagsToOwnership(task.tags);
        return ownership?.ownerScope === this.ownership.ownerScope;
      }).length,
      stopped_workers: stoppedWorkerCount,
    });
    return {
      discoveredWorkerCount: tasks.filter((task) => {
        const ownership = tagsToOwnership(task.tags);
        return ownership?.ownerScope === this.ownership.ownerScope;
      }).length,
      stoppedWorkerCount,
    };
  }
}
