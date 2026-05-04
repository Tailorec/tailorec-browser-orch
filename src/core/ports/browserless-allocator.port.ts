import type { ResolvedBrowserProfile } from '../../config/config.types.js';

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

export type BrowserlessWorkerSnapshot = {
  taskId: string;
  endpoint: string;
  assignedRunIds: string[];
  createdAt: number;
  lastAssignedAt: number;
};

export type BrowserlessAllocatorStatusSnapshot = {
  totalAssignedRuns: number;
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

  getStatusSnapshot(): Promise<BrowserlessAllocatorStatusSnapshot>;

  reconcileOrphans(): Promise<BrowserlessOrphanReconciliationResult>;
}
