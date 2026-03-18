import type { Router } from 'express';
import type { ActivityController } from '../controllers/activity.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

export function registerActivityRoutes(
  router: Router,
  controller: ActivityController,
  middleware: MiddlewareRegistry,
): void {
  router.post(
    '/activity/console',
    middleware.correlation,
    middleware.logging,
    controller.handleConsole.bind(controller),
  );

  router.post(
    '/activity/errors',
    middleware.correlation,
    middleware.logging,
    controller.handleErrors.bind(controller),
  );

  router.post(
    '/activity/network',
    middleware.correlation,
    middleware.logging,
    controller.handleNetwork.bind(controller),
  );
}

