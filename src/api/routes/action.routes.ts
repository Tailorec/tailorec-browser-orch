import type { Router } from 'express';
import type { SimpleActionController } from '../controllers/simple-action.controller.js';
import type { FormActionController } from '../controllers/form-action.controller.js';
import type { AdvancedActionController } from '../controllers/advanced-action.controller.js';
import type { ActionCompatController } from '../controllers/action-compat.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

/**
 * Register action routes
 * Extracted from src/browser/routes/agent.act.ts
 */
export function registerActionRoutes(
  router: Router,
  _simpleController: SimpleActionController,
  _formController: FormActionController,
  _advancedController: AdvancedActionController,
  compatController: ActionCompatController,
  middleware: MiddlewareRegistry,
): void {
  router.post(
    '/act',
    middleware.correlation,
    middleware.logging,
    compatController.handleAct.bind(compatController),
  );
}
