import type { Router } from 'express';
import type { SnapshotController } from '../controllers/snapshot.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

/**
 * Register snapshot routes
 * Extracted from src/browser/routes/agent.snapshot.ts
 */
export function registerSnapshotRoutes(
  router: Router,
  controller: SnapshotController,
  middleware: MiddlewareRegistry,
): void {
  /**
   * POST /snapshot
   * Take a snapshot of the current page
   * 
   * Request body:
   * - targetId?: string - Tab target ID
   * - timeoutMs?: number - Request timeout (500-60000)
   * - maxChars?: number - Maximum characters (100-100000)
   * - interactiveOnly?: boolean - Only interactive elements (default: false)
   * - compact?: boolean - Compact output (default: false)
   * - maxDepth?: number - Max tree depth (1-20, default: 10)
   * 
   * Response:
   * - ok: boolean
   * - targetId: string
   * - url: string
   * - snapshot: string
   * - refs: Record<string, unknown>
   * - truncated?: boolean
   * - stats?: Record<string, unknown>
   */
  router.post(
    '/snapshot',
    middleware.correlation,
    middleware.logging,
    controller.handleSnapshot.bind(controller),
  );

  /**
   * POST /snapshot/delta
   * Start/stop incremental snapshot observation
   * 
   * Request body:
   * - targetId?: string - Tab target ID
   * - action: 'start' | 'stop' - Start or stop delta observation
   * - anchorRef?: string - Anchor reference for delta
   * 
   * Response:
   * - ok: boolean
   * - targetId: string
   * - changes?: Array<unknown>
   */
  router.post(
    '/snapshot/delta',
    middleware.correlation,
    middleware.logging,
    controller.handleSnapshotDelta.bind(controller),
  );

}
