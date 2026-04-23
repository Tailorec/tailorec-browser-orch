import type { Request, Response } from 'express';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import {
  getProfileContext,
  getRunIdFromParamsOrBody,
  mapRouteError,
  sendErrorResponse,
} from './controller-runtime.utils.js';

const log = createSubsystemLogger('run-session-controller');

export class RunSessionController {
  constructor(private readonly browserContext: BrowserRouteContext) {}

  async handleCreateSession(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    try {
      const runId = getRunIdFromParamsOrBody(req);
      const profileCtx = getProfileContext(this.browserContext, req);
      const created = await profileCtx.ensureRunSession(runId);
      res.status(201).json({
        ok: true,
        accepted: true,
        run_id: created.runId,
        session_id: created.sessionId,
        created: created.created,
      });
      log.info('run session create handled', {
        run_id: created.runId,
        session_id: created.sessionId,
        created: created.created,
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Failed to create run session');
      sendErrorResponse(res, mapped.status, mapped.message, mapped.details);
    }
  }

  async handleCloseSession(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    try {
      const runId = getRunIdFromParamsOrBody(req);
      const profileCtx = getProfileContext(this.browserContext, req);
      const runSession = this.browserContext.state().runSessions.get(runId);
      const closed = await profileCtx.closeRunSession(runId);
      res.json({
        ok: true,
        run_id: runId,
        session_id: runSession?.sessionId ?? null,
        closed: closed.closed,
        target_id: closed.targetId ?? null,
      });
      log.info('run session close handled', {
        run_id: runId,
        session_id: runSession?.sessionId ?? null,
        closed: closed.closed,
        target_id: closed.targetId ?? null,
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Failed to close run session');
      sendErrorResponse(res, mapped.status, mapped.message, mapped.details);
    }
  }
}
