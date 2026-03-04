/**
 * Take snapshot use case
 * Worktree A stub - to be implemented
 */

export interface SnapshotOptions {
  timeoutMs?: number;
  maxChars?: number;
  interactiveOnly?: boolean;
  compact?: boolean;
  maxDepth?: number;
}

export interface TakeSnapshotRequest {
  targetId?: string;
  options?: SnapshotOptions;
}

export interface TakeSnapshotResponse {
  targetId: string;
  url: string;
  snapshot: string;
  refs: Record<string, unknown>;
  truncated?: boolean;
  stats?: Record<string, unknown>;
}

export interface TakeSnapshotUseCase {
  execute(request: TakeSnapshotRequest): Promise<TakeSnapshotResponse>;
}
