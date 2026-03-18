/**
 * API Routes Index
 * 
 * Registers all API routes with the Express server.
 */

import type { Router } from 'express';

/**
 * Route registrar interface
 */
export interface RouteRegistrar {
  use(path: string, router: Router): void;
}

/**
 * Register all routes
 */
export function registerAllRoutes(registrar: RouteRegistrar): void {
  // Routes are registered by their respective modules
  // This function ensures all routes are loaded
}

export { registerSnapshotRoutes } from './snapshot.routes.js';
export { registerActionRoutes } from './action.routes.js';
export { registerControlRoutes } from './control.routes.js';
export { registerHooksRoutes } from './hooks.routes.js';
export { registerBasicRoutes } from './basic.routes.js';
export { registerMediaRoutes } from './media.routes.js';
export { registerActivityRoutes } from './activity.routes.js';
export { registerCdpRoutes } from './cdp.routes.js';
