import type {
  BrowserlessAllocatorStatusSnapshot,
  BrowserlessOrphanReconciliationResult,
  BrowserlessWorkerAssignment,
  IBrowserlessAllocator,
} from '../../core/ports/browserless-allocator.port.js';
import { BrowserlessCapacityExceededError } from '../../core/ports/browserless-allocator.port.js';
import type { ResolvedBrowserProfile } from '../../config/config.types.js';

type TrackedWorker = {
  taskId: string;
  endpoint: string;
  assignedRunIds: Set<string>;
  createdAt: number;
  runningAt: number;
  lastAssignedAt: number;
  maxSessions: number;
  idleSince: number | null;
  idleShutdownTimer?: ReturnType<typeof setTimeout>;
};

type InMemoryBrowserlessAllocatorOptions = {
  maxSessionsPerWorker?: number;
  maxTotalSessions?: number;
  idleGraceMs?: number;
};

export class InMemoryBrowserlessAllocatorAdapter implements IBrowserlessAllocator {
  private readonly workersByEndpoint = new Map<string, TrackedWorker>();
  private readonly assignmentsByRunId = new Map<string, BrowserlessWorkerAssignment>();
  private readonly maxSessionsPerWorker: number;
  private readonly maxTotalSessions: number;
  private readonly idleGraceMs: number;
  private nextTaskNumber = 1;

  constructor(options: InMemoryBrowserlessAllocatorOptions = {}) {
    this.maxSessionsPerWorker = options.maxSessionsPerWorker ?? 5;
    this.maxTotalSessions = options.maxTotalSessions ?? 20;
    this.idleGraceMs = options.idleGraceMs ?? 30_000;
  }

  private buildWorkerEndpoint(profile: ResolvedBrowserProfile, workerTaskId: string): string {
    const url = new URL(profile.browserEndpoint);
    url.searchParams.set('workerId', workerTaskId);
    return url.toString();
  }

  private clearIdleShutdown(worker: TrackedWorker): void {
    if (worker.idleShutdownTimer) {
      clearTimeout(worker.idleShutdownTimer);
      worker.idleShutdownTimer = undefined;
    }
    worker.idleSince = null;
  }

  private stopWorkerIfIdle(worker: TrackedWorker): void {
    if (worker.assignedRunIds.size > 0) {
      return;
    }
    this.workersByEndpoint.delete(worker.endpoint);
    if (worker.idleShutdownTimer) {
      clearTimeout(worker.idleShutdownTimer);
      worker.idleShutdownTimer = undefined;
    }
  }

  private scheduleIdleShutdown(worker: TrackedWorker, now: number): void {
    worker.idleSince = now;
    if (this.idleGraceMs <= 0) {
      this.stopWorkerIfIdle(worker);
      return;
    }

    if (worker.idleShutdownTimer) {
      clearTimeout(worker.idleShutdownTimer);
    }

    worker.idleShutdownTimer = setTimeout(() => {
      worker.idleShutdownTimer = undefined;
      this.stopWorkerIfIdle(worker);
    }, this.idleGraceMs);
    if (typeof worker.idleShutdownTimer.unref === 'function') {
      worker.idleShutdownTimer.unref();
    }
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
    const existingWorker = Array.from(this.workersByEndpoint.values())
      .sort((left, right) => left.createdAt - right.createdAt)
      .find((candidate) => candidate.assignedRunIds.size < candidate.maxSessions);
    let worker = existingWorker;

    if (!worker) {
      const taskId = `configured-browserless-${this.nextTaskNumber}`;
      worker = {
        taskId,
        endpoint: this.buildWorkerEndpoint(input.profile, taskId),
        assignedRunIds: new Set(),
        createdAt: now,
        runningAt: now,
        lastAssignedAt: now,
        maxSessions: this.maxSessionsPerWorker,
        idleSince: null,
      };
      this.nextTaskNumber += 1;
      this.workersByEndpoint.set(worker.endpoint, worker);
    }

    this.clearIdleShutdown(worker);
    worker.assignedRunIds.add(input.runId);
    worker.lastAssignedAt = now;

    const assignment: BrowserlessWorkerAssignment = {
      runId: input.runId,
      taskId: worker.taskId,
      endpoint: worker.endpoint,
      assignedAt: now,
    };
    this.assignmentsByRunId.set(input.runId, assignment);
    return assignment;
  }

  async getAssignment(runId: string): Promise<BrowserlessWorkerAssignment | null> {
    return this.assignmentsByRunId.get(runId) ?? null;
  }

  async releaseRun(runId: string): Promise<void> {
    const assignment = this.assignmentsByRunId.get(runId);
    if (!assignment) {
      return;
    }

    this.assignmentsByRunId.delete(runId);
    const worker = this.workersByEndpoint.get(assignment.endpoint);
    if (!worker) {
      return;
    }

    worker.assignedRunIds.delete(runId);
    if (worker.assignedRunIds.size === 0) {
      this.scheduleIdleShutdown(worker, Date.now());
    }
  }

  async waitForWorkerRunning(input: {
    taskId: string;
    endpoint: string;
    timeoutMs: number;
    pollIntervalMs: number;
  }) {
    const worker = this.workersByEndpoint.get(input.endpoint);
    if (!worker || worker.taskId !== input.taskId) {
      throw new Error(`browserless worker ${input.taskId} is not tracked`);
    }

    return {
      taskId: worker.taskId,
      endpoint: worker.endpoint,
      runningAt: worker.runningAt,
    };
  }

  async getStatusSnapshot(): Promise<BrowserlessAllocatorStatusSnapshot> {
    const workers = Array.from(this.workersByEndpoint.values()).map((worker) => ({
      taskId: worker.taskId,
      endpoint: worker.endpoint,
      assignedRunIds: Array.from(worker.assignedRunIds),
      createdAt: worker.createdAt,
      lastAssignedAt: worker.lastAssignedAt,
      maxSessions: worker.maxSessions,
      idleSince: worker.idleSince,
    }));
    return {
      totalAssignedRuns: this.assignmentsByRunId.size,
      maxTotalSessions: this.maxTotalSessions,
      maxSessionsPerWorker: this.maxSessionsPerWorker,
      workers,
    };
  }

  async reconcileOrphans(): Promise<BrowserlessOrphanReconciliationResult> {
    return {
      discoveredWorkerCount: 0,
      stoppedWorkerCount: 0,
    };
  }
}
