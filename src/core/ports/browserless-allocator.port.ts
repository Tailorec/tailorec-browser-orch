import type { ResolvedBrowserProfile } from '../../config/config.types.js';

export class BrowserlessCapacityExceededError extends Error {
  constructor(
    message: string,
    readonly active: number,
    readonly max: number,
  ) {
    super(message);
    this.name = 'BrowserlessCapacityExceededError';
  }
}

export type BrowserlessWorkerAssignment = {
  runId: string;
  taskId: string;
  endpoint: string;
  assignedAt: number;
};

export type BrowserlessWorkerRunningState = {
  taskId: string;
  endpoint: string;
  runningAt: number;
};

export type BrowserlessWorkerOwnership = {
  ownerScope: string;
  ownerId: string;
};

export type BrowserlessOwnedWorkerRecord = {
  taskId: string;
  endpoint: string;
  ownership: BrowserlessWorkerOwnership;
};

export type BrowserlessWorkerSnapshot = {
  taskId: string;
  endpoint: string;
  assignedRunIds: string[];
  createdAt: number;
  lastAssignedAt: number;
  maxSessions: number;
  idleSince: number | null;
  ownership: BrowserlessWorkerOwnership;
  unavailableSince: number | null;
  unavailableReason: string | null;
};

export type BrowserlessAllocatorStatusSnapshot = {
  totalAssignedRuns: number;
  maxTotalSessions: number;
  maxSessionsPerWorker: number;
  workers: BrowserlessWorkerSnapshot[];
};

export type BrowserlessOrphanReconciliationResult = {
  discoveredWorkerCount: number;
  stoppedWorkerCount: number;
};

export interface IBrowserlessAllocator {
  assignRun(input: {
    runId: string;
    sessionId: string;
    profile: ResolvedBrowserProfile;
  }): Promise<BrowserlessWorkerAssignment>;

  getAssignment(runId: string): Promise<BrowserlessWorkerAssignment | null>;

  releaseRun(runId: string): Promise<void>;

  waitForWorkerRunning(input: {
    taskId: string;
    endpoint: string;
    timeoutMs: number;
    pollIntervalMs: number;
  }): Promise<BrowserlessWorkerRunningState>;

  markWorkerUnavailable(input: {
    taskId: string;
    endpoint: string;
    reason?: string;
  }): Promise<void>;

  getStatusSnapshot(): Promise<BrowserlessAllocatorStatusSnapshot>;

  reconcileOrphans(): Promise<BrowserlessOrphanReconciliationResult>;
}
