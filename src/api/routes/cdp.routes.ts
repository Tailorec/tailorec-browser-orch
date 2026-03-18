import type { Router } from 'express';
import type { CdpController } from '../controllers/cdp.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

export function registerCdpRoutes(
  router: Router,
  controller: CdpController,
  middleware: MiddlewareRegistry,
): void {
  router.post(
    '/cdp/screenshot',
    middleware.correlation,
    middleware.logging,
    controller.handleScreenshot.bind(controller),
  );

  router.post(
    '/cdp/target',
    middleware.correlation,
    middleware.logging,
    controller.handleCreateTarget.bind(controller),
  );

  router.post(
    '/cdp/evaluate',
    middleware.correlation,
    middleware.logging,
    controller.handleEvaluate.bind(controller),
  );
}

