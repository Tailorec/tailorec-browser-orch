import type {
  BrowserlessAllocatorStatusSnapshot,
  BrowserlessOrphanReconciliationResult,
  BrowserlessWorkerAssignment,
  IBrowserlessAllocator,
} from '../../core/ports/browserless-allocator.port.js';
import type { ResolvedBrowserProfile } from '../../config/config.types.js';

type TrackedWorker = {
  taskId: string;
  endpoint: string;
  assignedRunIds: Set<string>;
  createdAt: number;
  runningAt: number;
  lastAssignedAt: number;
};

export class InMemoryBrowserlessAllocatorAdapter implements IBrowserlessAllocator {
  private readonly workersByEndpoint = new Map<string, TrackedWorker>();
  private readonly assignmentsByRunId = new Map<string, BrowserlessWorkerAssignment>();
  private nextTaskNumber = 1;

  async assignRun(input: {
    runId: string;
    sessionId: string;
    profile: ResolvedBrowserProfile;
  }): Promise<BrowserlessWorkerAssignment> {
    const existing = this.assignmentsByRunId.get(input.runId);
    if (existing) {
      return existing;
    }

    const endpoint = input.profile.browserEndpoint;
    const now = Date.now();
    let worker = this.workersByEndpoint.get(endpoint);
    if (!worker) {
      worker = {
        taskId: `configured-browserless-${this.nextTaskNumber}`,
        endpoint,
        assignedRunIds: new Set(),
        createdAt: now,
        runningAt: now,
        lastAssignedAt: now,
      };
      this.nextTaskNumber += 1;
      this.workersByEndpoint.set(endpoint, worker);
    }

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
      this.workersByEndpoint.delete(assignment.endpoint);
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
    }));
    return {
      totalAssignedRuns: this.assignmentsByRunId.size,
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
