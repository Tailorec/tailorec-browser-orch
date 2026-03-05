import type { Router, Express } from 'express';
import type { MiddlewareRegistry } from '../middlewares/index.js';
import { SnapshotController } from '../controllers/snapshot.controller.js';
import { SimpleActionController } from '../controllers/simple-action.controller.js';
import { FormActionController } from '../controllers/form-action.controller.js';
import { AdvancedActionController } from '../controllers/advanced-action.controller.js';
import { ControlController } from '../controllers/control.controller.js';
import { HooksController } from '../controllers/hooks.controller.js';
import { BasicController } from '../controllers/basic.controller.js';
import { registerSnapshotRoutes } from './snapshot.routes.js';
import { registerActionRoutes } from './action.routes.js';
import { registerControlRoutes } from './control.routes.js';
import { registerHooksRoutes } from './hooks.routes.js';
import { registerBasicRoutes } from './basic.routes.js';

/**
 * Route registrar interface
 * Provides a consistent API for route registration across different server types
 */
export interface RouteRegistrar {
  use(middleware: any): void;
  get(path: string, handler: any): void;
  post(path: string, handler: any): void;
  put(path: string, handler: any): void;
  delete(path: string, handler: any): void;
  patch(path: string, handler: any): void;
}

/**
 * Controllers interface
 */
export interface Controllers {
  snapshot: SnapshotController;
  simpleAction: SimpleActionController;
  formAction: FormActionController;
  advancedAction: AdvancedActionController;
  control: ControlController;
  hooks: HooksController;
  basic: BasicController;
}

/**
 * Register all API routes
 */
export function registerAllRoutes(
  app: Express,
  controllers: Controllers,
  middleware: MiddlewareRegistry,
): void {
  // Create routers for each route group
  const snapshotRouter = Router();
  const actionRouter = Router();
  const controlRouter = Router();
  const hooksRouter = Router();
  const basicRouter = Router();

  // Register routes for each router
  registerSnapshotRoutes(snapshotRouter, controllers.snapshot, middleware);
  registerActionRoutes(
    actionRouter,
    controllers.simpleAction,
    controllers.formAction,
    controllers.advancedAction,
    middleware,
  );
  registerControlRoutes(controlRouter, controllers.control, middleware);
  registerHooksRoutes(hooksRouter, controllers.hooks, middleware);
  registerBasicRoutes(basicRouter, controllers.basic, middleware);

  // Mount routers on the main app
  app.use('/api', snapshotRouter);
  app.use('/api', actionRouter);
  app.use('/api', controlRouter);
  app.use('/api', hooksRouter);
  app.use('/api', basicRouter);
}

/**
 * Export individual route registrars for selective use
 */
export {
  registerSnapshotRoutes,
  registerActionRoutes,
  registerControlRoutes,
  registerHooksRoutes,
  registerBasicRoutes,
};
