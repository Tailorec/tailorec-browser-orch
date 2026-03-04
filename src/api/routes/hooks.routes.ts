import type { Router } from 'express';
import type { HooksController } from '../controllers/hooks.controller.js';
import type { MiddlewareRegistry } from '../middlewares/index.js';

/**
 * Register hooks routes
 * Extracted from src/browser/routes/agent.act.ts
 */
export function registerHooksRoutes(
  router: Router,
  controller: HooksController,
  middleware: MiddlewareRegistry,
): void {
  /**
   * POST /hooks/file-chooser
   * Stage files for file chooser upload
   * 
   * Request body:
   * - paths: Array<string> - File paths or URLs to stage
   * - targetId?: string - Tab target ID
   * - ref?: string - Element reference to click for file chooser
   * - inputRef?: string - Input element reference (alternative to ref)
   * - element?: string - Element selector (alternative to ref)
   * - timeoutMs?: number - Action timeout
   * 
   * Notes:
   * - URLs will be downloaded and staged locally
   * - ref cannot be combined with inputRef/element
   * 
   * Response:
   * - ok: boolean
   * 
   * Error responses:
   * - 400: Missing paths or invalid combination of parameters
   */
  router.post(
    '/hooks/file-chooser',
    middleware.correlation,
    middleware.logging,
    controller.handleFileChooser.bind(controller),
  );

  /**
   * POST /hooks/dialog
   * Arm dialog handler
   * 
   * Request body:
   * - accept: boolean - Accept or dismiss dialog
   * - promptText?: string - Text for prompt dialogs
   * - targetId?: string - Tab target ID
   * - timeoutMs?: number - Action timeout
   * 
   * Response:
   * - ok: boolean
   * 
   * Error responses:
   * - 400: Missing accept parameter
   */
  router.post(
    '/hooks/dialog',
    middleware.correlation,
    middleware.logging,
    controller.handleDialog.bind(controller),
  );

  /**
   * POST /wait/download
   * Wait for download to complete
   * 
   * Request body:
   * - targetId?: string - Tab target ID
   * - path?: string - Output path for downloaded file
   * - timeoutMs?: number - Wait timeout
   * 
   * Response:
   * - ok: boolean
   * - targetId: string
   * - download: unknown - Download information
   */
  router.post(
    '/wait/download',
    middleware.correlation,
    middleware.logging,
    controller.handleWaitDownload.bind(controller),
  );

  /**
   * POST /download
   * Download file from element
   * 
   * Request body:
   * - ref: string - Download link/button element reference
   * - path: string - Output path for downloaded file
   * - targetId?: string - Tab target ID
   * - timeoutMs?: number - Download timeout
   * 
   * Response:
   * - ok: boolean
   * - targetId: string
   * - url: string
   * 
   * Error responses:
   * - 400: Missing ref or path parameter
   */
  router.post(
    '/download',
    middleware.correlation,
    middleware.logging,
    controller.handleDownload.bind(controller),
  );
}
