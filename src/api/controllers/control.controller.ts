import type { Request, Response } from 'express';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { verifyControlToken } from '../../shared/utils/control-token.js';

const log = createSubsystemLogger('control-controller');

export class ControlController {
  async handleControl(req: Request, res: Response): Promise<void> {
    const token = req.query.token as string | undefined;
    const targetId = req.query.targetId as string | undefined;

    if (!token) {
      res.status(401).json({ ok: false, error: 'missing_control_token' });
      return;
    }

    let claims;
    try {
      claims = verifyControlToken(token);
    } catch (error) {
      res.status(401).json({
        ok: false,
        error: error instanceof Error ? error.message : 'invalid_control_token',
      });
      return;
    }

    const wsProtocol = req.protocol === 'https' ? 'wss' : 'ws';
    const host = req.get('host') || '127.0.0.1:4000';
    const wsUrl = `${wsProtocol}://${host}/control/live?${new URLSearchParams({
      token,
      ...(targetId ? { targetId } : {}),
    }).toString()}`;

    log.info('control request completed', { run_id: claims.run_id, target_id: targetId });
    res.json({
      ok: true,
      mode: 'interactive',
      ws_url: wsUrl,
      run_id: claims.run_id ?? null,
      note: 'Use ws_url for browser interaction. Legacy frame/action/status control endpoints are removed.',
    });
  }

  handleControlLive(_req: Request, res: Response): void {
    res.status(426).json({
      ok: false,
      error: 'WebSocket upgrade required',
    });
  }
}
