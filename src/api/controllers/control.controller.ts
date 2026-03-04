import type { Request, Response } from 'express';
import type { GenerateControlTokenUseCase } from '../../core/use-cases/generate-control-token.use-case.js';
import { createSubsystemLogger } from '../../logging/subsystem.js';

const log = createSubsystemLogger('control-controller');

/**
 * Control controller
 * Handles HTTP requests for browser control
 * Delegates to GenerateControlTokenUseCase from Worktree A
 */
export class ControlController {
  constructor(
    private generateControlTokenUseCase: GenerateControlTokenUseCase,
  ) {}

  /**
   * Handle GET /control
   * Generate control token and return WebSocket URL
   */
  async handleControl(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const token = req.query.token as string | undefined;
    const targetId = req.query.targetId as string | undefined;
    
    log.info('control request started', { 
      hasToken: !!token,
      targetId: targetId || 'none',
    });

    try {
      // If no token provided, generate one
      if (!token) {
        res.status(401).json({ 
          ok: false, 
          error: 'missing_control_token',
        });
        return;
      }

      // Verify token (this should be done by use case)
      // For now, we'll just pass through and let the use case handle it
      let claims: { run_id?: string } | null = null;
      
      try {
        // Note: Token verification should be in use case
        // This is a placeholder
        claims = { run_id: 'unknown' };
      } catch (error) {
        res.status(401).json({
          ok: false,
          error: error instanceof Error ? error.message : 'invalid_control_token',
        });
        return;
      }

      // Build WebSocket URL
      const wsProtocol = req.protocol === 'https' ? 'wss' : 'ws';
      const host = req.get('host') || '127.0.0.1:4000';
      const wsUrl = `${wsProtocol}://${host}/control/live?${new URLSearchParams({
        token,
        ...(targetId ? { targetId } : {}),
      }).toString()}`;

      res.json({
        ok: true,
        mode: 'interactive',
        ws_url: wsUrl,
        run_id: claims?.run_id ?? null,
        note: 'Use ws_url for browser interaction. Legacy frame/action/status control endpoints are removed.',
      });

      log.info('control request completed', {
        duration_ms: Date.now() - started,
        ws_url: wsUrl,
      });
    } catch (error) {
      log.exception('control request failed', error);
      throw error;
    }
  }

  /**
   * Handle GET /control/live (WebSocket upgrade)
   * This is handled by WebSocket server, not HTTP
   * This method is a placeholder for documentation
   */
  handleControlLive(req: Request, res: Response): void {
    // WebSocket upgrade is handled separately
    // This endpoint should not be called via HTTP
    res.status(426).json({
      ok: false,
      error: 'WebSocket upgrade required',
    });
  }
}
