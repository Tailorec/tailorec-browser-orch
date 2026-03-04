import type { Router } from 'express';
import type { BasicController } from '../controllers/basic.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

/**
 * Register basic routes
 * Extracted from src/browser/routes/basic.ts
 */
export function registerBasicRoutes(
  router: Router,
  controller: BasicController,
  middleware: MiddlewareRegistry,
): void {
  /**
   * GET /
   * Health check endpoint
   * 
   * Response:
   * Plain text: "Tailorec Browser Service OK"
   */
  router.get(
    '/',
    middleware.correlation,
    middleware.logging,
    controller.handleHealth.bind(controller),
  );

  /**
   * GET /status
   * Get browser service status
   * 
   * Response:
   * - ok: boolean
   * - profiles: Array<string> - Available browser profiles
   */
  router.get(
    '/status',
    middleware.correlation,
    middleware.logging,
    controller.handleStatus.bind(controller),
  );
}
