/**
 * Take Snapshot Use Case
 *
 * Orchestrates the capture of a page snapshot.
 * This is a domain use case that coordinates services to capture snapshots.
 */

import { SnapshotService, type SnapshotOptions, type SnapshotResult } from '../services/snapshot.service.js';
import { SessionService } from '../services/session.service.js';
import type { IEventBus } from '../ports/event-bus.port.js';

/**
 * Snapshot type
 */
export type SnapshotType = 'ai' | 'aria' | 'role';

/**
 * Take snapshot request
 */
export type TakeSnapshotRequest = {
  /**
   * CDP URL for browser connection
   */
  cdpUrl?: string;

  /**
   * Target ID (optional, uses default if not provided)
   */
  targetId?: string;

  /**
   * Snapshot type
   */
  type?: SnapshotType;

  /**
   * Snapshot options
   */
  options?: SnapshotOptions & {
    /**
     * Maximum number of nodes for aria snapshot
     */
    ariaLimit?: number;

    /**
     * Selector for role snapshot
     */
    selector?: string;

    /**
     * Frame selector for role snapshot
     */
    frameSelector?: string;

    /**
     * Refs mode for role snapshot
     */
    refsMode?: 'role' | 'aria';
  };
};

/**
 * Take snapshot response
 */
export type TakeSnapshotResponse = {
  /**
   * Whether snapshot was successful
   */
  ok: boolean;

  /**
   * Snapshot string (for ai/role types)
   */
  snapshot?: string;

  /**
   * Aria nodes (for aria type)
   */
  nodes?: unknown[];

  /**
   * Role references map
   */
  refs?: Record<string, { role: string; name?: string; nth?: number }>;

  /**
   * Snapshot statistics
   */
  stats?: {
    lines: number;
    chars: number;
    refs: number;
    interactive: number;
  };

  /**
   * Whether snapshot was truncated
   */
  truncated?: boolean;

  /**
   * Error message if snapshot failed
   */
  error?: string;
};

/**
 * Take Snapshot Use Case
 *
 * Orchestrates the capture of page snapshots by coordinating
 * the session and snapshot services.
 */
export class TakeSnapshotUseCase {
  constructor(
    private sessionService: SessionService,
    private snapshotService: SnapshotService,
    private eventBus?: IEventBus,
  ) {}

  /**
   * Take a page snapshot
   * @param request - Snapshot request
   * @returns Snapshot result
   */
  async execute(request: TakeSnapshotRequest): Promise<TakeSnapshotResponse> {
    try {
      // Publish start event
      this.publishEvent('SNAPSHOT_STARTED', {
        type: request.type ?? 'ai',
        targetId: request.targetId,
      });

      // Get page from session
      const page = await this.sessionService.getPage(request.targetId, request.cdpUrl);

      // Capture snapshot based on type
      const snapshotType = request.type ?? 'ai';
      let result: TakeSnapshotResponse;

      switch (snapshotType) {
        case 'aria':
          result = await this.captureAriaSnapshot(page, request.options);
          break;
        case 'role':
          result = await this.captureRoleSnapshot(page, request.targetId, request.options);
          break;
        case 'ai':
        default:
          result = await this.captureAiSnapshot(page, request.targetId, request.options);
          break;
      }

      // Publish completion event
      this.publishEvent('SNAPSHOT_COMPLETED', {
        type: snapshotType,
        targetId: request.targetId,
        chars: result.stats?.chars,
        refs: result.refs ? Object.keys(result.refs).length : 0,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Publish error event
      this.publishEvent('SNAPSHOT_FAILED', {
        type: request.type ?? 'ai',
        targetId: request.targetId,
        error: errorMessage,
      });

      return {
        ok: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Capture AI snapshot
   */
  private async captureAiSnapshot(
    page: any,
    targetId?: string,
    options?: SnapshotOptions,
  ): Promise<TakeSnapshotResponse> {
    const result = await this.snapshotService.captureSnapshot(page, options ?? {});

    // Store refs in session
    if (targetId && result.refs) {
      await this.sessionService.storeRoleRefs(targetId, result.refs, 'aria');
    }

    return {
      ok: true,
      snapshot: result.snapshot,
      refs: result.refs,
      stats: result.stats,
      truncated: result.truncated,
    };
  }

  /**
   * Capture aria snapshot
   */
  private async captureAriaSnapshot(
    page: any,
    options?: { ariaLimit?: number },
  ): Promise<TakeSnapshotResponse> {
    const result = await this.snapshotService.captureAriaSnapshot(
      page,
      options?.ariaLimit ?? 500,
    );

    return {
      ok: true,
      nodes: result.nodes,
    };
  }

  /**
   * Capture role snapshot
   */
  private async captureRoleSnapshot(
    page: any,
    targetId?: string,
    options?: SnapshotOptions & {
      selector?: string;
      frameSelector?: string;
      refsMode?: 'role' | 'aria';
    },
  ): Promise<TakeSnapshotResponse> {
    // For role snapshots, use AI snapshot as base
    const result = await this.snapshotService.captureSnapshot(page, options ?? {});

    // Store refs in session
    if (targetId && result.refs) {
      const mode = options?.refsMode ?? 'role';
      await this.sessionService.storeRoleRefs(targetId, result.refs, mode);
    }

    return {
      ok: true,
      snapshot: result.snapshot,
      refs: result.refs,
      stats: result.stats,
      truncated: result.truncated,
    };
  }

  /**
   * Publish event to event bus
   */
  private publishEvent(type: string, payload: { targetId?: string; [key: string]: unknown }): void {
    if (!this.eventBus) return;

    this.eventBus.publish({
      type,
      timestamp: new Date().toISOString(),
      aggregateId: payload.targetId ?? 'unknown',
      ...payload,
    });
  }
}

/**
 * Domain event types for take snapshot
 */
export const TakeSnapshotEvents = {
  STARTED: 'SNAPSHOT_STARTED',
  COMPLETED: 'SNAPSHOT_COMPLETED',
  FAILED: 'SNAPSHOT_FAILED',
} as const;
