import process from 'node:process';
import type {
  BrowserlessOwnedWorkerRecord,
  BrowserlessAllocatorStatusSnapshot,
  BrowserlessOrphanReconciliationResult,
  BrowserlessWorkerAssignment,
  BrowserlessWorkerOwnership,
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
  ownership: BrowserlessWorkerOwnership;
  unavailableSince: number | null;
  unavailableReason: string | null;
  idleShutdownTimer?: ReturnType<typeof setTimeout>;
};

type InMemoryBrowserlessAllocatorOptions = {
  maxSessionsPerWorker?: number;
  maxTotalSessions?: number;
  idleGraceMs?: number;
  ownerScope?: string;
  ownerId?: string;
  listOwnedWorkers?: () => Promise<BrowserlessOwnedWorkerRecord[]>;
  stopOwnedWorker?: (worker: BrowserlessOwnedWorkerRecord) => Promise<void>;
};

export class InMemoryBrowserlessAllocatorAdapter implements IBrowserlessAllocator {
  private readonly workersByEndpoint = new Map<string, TrackedWorker>();
  private readonly assignmentsByRunId = new Map<string, BrowserlessWorkerAssignment>();
  private readonly maxSessionsPerWorker: number;
  private readonly maxTotalSessions: number;
  private readonly idleGraceMs: number;
  private readonly ownership: BrowserlessWorkerOwnership;
  private readonly listOwnedWorkers: () => Promise<BrowserlessOwnedWorkerRecord[]>;
  private readonly stopOwnedWorker: (worker: BrowserlessOwnedWorkerRecord) => Promise<void>;
  private nextTaskNumber = 1;

  constructor(options: InMemoryBrowserlessAllocatorOptions = {}) {
    this.maxSessionsPerWorker = options.maxSessionsPerWorker ?? 5;
    this.maxTotalSessions = options.maxTotalSessions ?? 20;
    this.idleGraceMs = options.idleGraceMs ?? 30_000;
    this.ownership = {
      ownerScope: options.ownerScope ?? 'openclaw-browser',
      ownerId: options.ownerId ?? `openclaw-browser-${process.pid}-${Date.now()}`,
    };
    this.listOwnedWorkers = options.listOwnedWorkers ?? (async () => []);
    this.stopOwnedWorker = options.stopOwnedWorker ?? (async () => undefined);
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
      .find(
        (candidate) =>
          candidate.unavailableSince === null && candidate.assignedRunIds.size < candidate.maxSessions,
      );
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
        ownership: this.ownership,
        unavailableSince: null,
        unavailableReason: null,
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
      if (worker.unavailableSince !== null) {
        this.stopWorkerIfIdle(worker);
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
  }) {
    const worker = this.workersByEndpoint.get(input.endpoint);
    if (!worker || worker.taskId !== input.taskId) {
      throw new Error(`browserless worker ${input.taskId} is not tracked`);
    }
    if (worker.unavailableSince !== null) {
      throw new Error(
        worker.unavailableReason
          ? `browserless worker ${input.taskId} is unavailable: ${worker.unavailableReason}`
          : `browserless worker ${input.taskId} is unavailable`,
      );
    }

    return {
      taskId: worker.taskId,
      endpoint: worker.endpoint,
      runningAt: worker.runningAt,
    };
  }

  async markWorkerUnavailable(input: { taskId: string; endpoint: string; reason?: string }): Promise<void> {
    const worker = this.workersByEndpoint.get(input.endpoint);
    if (!worker || worker.taskId !== input.taskId) {
      return;
    }
    this.clearIdleShutdown(worker);
    worker.unavailableSince = Date.now();
    worker.unavailableReason = input.reason ?? null;
    if (worker.assignedRunIds.size === 0) {
      this.stopWorkerIfIdle(worker);
    }
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
      ownership: worker.ownership,
      unavailableSince: worker.unavailableSince,
      unavailableReason: worker.unavailableReason,
    }));
    return {
      totalAssignedRuns: this.assignmentsByRunId.size,
      maxTotalSessions: this.maxTotalSessions,
      maxSessionsPerWorker: this.maxSessionsPerWorker,
      workers,
    };
  }

  async reconcileOrphans(): Promise<BrowserlessOrphanReconciliationResult> {
    const discoveredWorkers = await this.listOwnedWorkers();
    let stoppedWorkerCount = 0;

    for (const worker of discoveredWorkers) {
      if (worker.ownership.ownerScope !== this.ownership.ownerScope) {
        continue;
      }
      if (worker.ownership.ownerId === this.ownership.ownerId) {
        continue;
      }
      await this.stopOwnedWorker(worker);
      stoppedWorkerCount += 1;
    }

    return {
      discoveredWorkerCount: discoveredWorkers.length,
      stoppedWorkerCount,
    };
  }
}
