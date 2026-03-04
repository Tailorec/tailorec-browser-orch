import type { Request, Response } from 'express';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('basic-controller');

/**
 * Basic controller
 * Handles simple HTTP requests (health check, status)
 */
export class BasicController {
  constructor(
    // Note: Add use case dependencies when implemented in Worktree A
    // private getBrowserStatusUseCase: GetBrowserStatusUseCase,
  ) {}

  /**
   * Handle GET /
   * Health check endpoint
   */
  async handleHealth(req: Request, res: Response): Promise<void> {
    log.info('health check request');
    
    res.send('Tailorec Browser Service OK');
  }

  /**
   * Handle GET /status
   * Get browser service status
   */
  async handleStatus(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    
    log.info('status request started');

    try {
      // Note: Get browser status from use case when implemented
      // For now, return basic status
      res.json({
        ok: true,
        profiles: [], // Note: Get from use case
      });

      log.info('status request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('status request failed', error);
      throw error;
    }
  }
}
