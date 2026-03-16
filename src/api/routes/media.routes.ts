import type { Router } from 'express';
import type { MediaController } from '../controllers/media.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

export function registerMediaRoutes(
  router: Router,
  controller: MediaController,
  middleware: MiddlewareRegistry,
): void {
  router.post(
    '/screenshot',
    middleware.correlation,
    middleware.logging,
    controller.handleScreenshot.bind(controller),
  );

  router.post(
    '/screenshot/labeled',
    middleware.correlation,
    middleware.logging,
    controller.handleLabeledScreenshot.bind(controller),
  );

  router.post(
    '/highlight',
    middleware.correlation,
    middleware.logging,
    controller.handleHighlight.bind(controller),
  );
}
