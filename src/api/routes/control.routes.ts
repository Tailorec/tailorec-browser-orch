import type { Router } from 'express';
import type { ControlController } from '../controllers/control.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

/**
 * Register control routes
 * Extracted from src/browser/routes/control.ts
 */
export function registerControlRoutes(
  router: Router,
  controller: ControlController,
  middleware: MiddlewareRegistry,
): void {
  /**
   * GET /control
   * Generate control token and return WebSocket URL for interactive control
   * 
   * Query parameters:
   * - token?: string - JWT control token (required)
   * - targetId?: string - Tab target ID (optional)
   * 
   * Response:
   * - ok: boolean
   * - mode: 'interactive'
   * - ws_url: string - WebSocket URL for control
   * - run_id: string | null
   * - note: string - Usage instructions
   * 
   * Error responses:
   * - 401: Missing or invalid token
   */
  router.get(
    '/control',
    middleware.correlation,
    middleware.logging,
    controller.handleControl.bind(controller),
  );

  /**
   * GET /control/live
   * WebSocket endpoint for live browser control
   * 
   * Query parameters:
   * - token: string - JWT control token (required)
   * - targetId?: string - Tab target ID (optional)
   * 
   * This endpoint handles WebSocket upgrades, not HTTP requests.
   * The WebSocket server sends:
   * - frame: JPEG screenshot frames
   * - status: Page status updates
   * 
   * The WebSocket server receives:
   * - click: Mouse click events
   * - wheel: Scroll events
   * - key: Key press events
   * - type: Text input events
   * - ping: Keepalive
   */
  router.get(
    '/control/live',
    middleware.correlation,
    middleware.logging,
    controller.handleControlLive.bind(controller),
  );
}
