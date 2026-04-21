import type { Router } from 'express';
import type { RunSessionController } from '../controllers/run-session.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

export function registerRunSessionRoutes(
  router: Router,
  controller: RunSessionController,
  middleware: MiddlewareRegistry,
): void {
  router.post(
    '/runs/:runId/session',
    middleware.correlation,
    middleware.logging,
    controller.handleCreateSession.bind(controller),
  );

  router.delete(
    '/runs/:runId/session',
    middleware.correlation,
    middleware.logging,
    controller.handleCloseSession.bind(controller),
  );
}
