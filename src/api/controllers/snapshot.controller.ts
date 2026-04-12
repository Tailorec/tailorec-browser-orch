import type { Request, Response } from 'express';
import type { Locator } from 'playwright-core';
import type { TakeSnapshotUseCase } from '../../core/use-cases/take-snapshot.use-case.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { DiscoveryService } from '../../core/services/discovery.service.js';
import { SessionService } from '../../core/services/session.service.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { getProfileContext, getRunId, mapRouteError, sendErrorResponse } from './controller-runtime.utils.js';

const log = createSubsystemLogger('snapshot-controller');

export class SnapshotController {
  constructor(
    private takeSnapshotUseCase: TakeSnapshotUseCase,
    private sessionService: SessionService,
    private discoveryService: DiscoveryService,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleSnapshot(req: Request, res: Response): Promise<void> {
    const body = (req.body || {}) as Record<string, unknown>;
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() || undefined : undefined;
    try {
      const runId = getRunId(req);
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(runId, targetId);
      const timeoutMs = this.toNumber(body.timeoutMs);
      const maxChars = this.toNumber(body.maxChars);
      const interactiveOnly = body.interactiveOnly === true;
      const compact = body.compact === true;
      const maxDepth = this.toNumber(body.maxDepth);
      const result = await this.takeSnapshotUseCase.execute({
        cdpUrl: profileCtx.profile.browserEndpoint,
        targetId: tab.targetId,
        options: {
          timeoutMs,
          maxChars,
          interactiveOnly,
          compact,
          maxDepth,
        },
      });

      if (!result.ok) {
        sendErrorResponse(res, 500, result.error || 'Snapshot failed');
        return;
      }

      res.json({
        ok: true,
        targetId: result.targetId ?? tab.targetId,
        url: result.url ?? tab.url,
        snapshot: result.snapshot,
        refs: result.refs,
        truncated: result.truncated,
        stats: result.stats,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Snapshot failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  async handleSnapshotDelta(req: Request, res: Response): Promise<void> {
    const body = (req.body || {}) as Record<string, unknown>;
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() || undefined : undefined;
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    const anchorRef = typeof body.anchorRef === 'string' ? body.anchorRef.trim() || undefined : undefined;
    if (action !== 'start' && action !== 'stop') {
      sendErrorResponse(res, 400, "action must be 'start' or 'stop'");
      return;
    }
    try {
      const runId = getRunId(req);
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(runId, targetId, { useCurrentTab: true });
      const page = await this.sessionService.getPage(tab.targetId, profileCtx.profile.browserEndpoint);
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.browserEndpoint);

      const result =
        action === 'start'
          ? await this.discoveryService.startDomObserver(
              page,
              anchorRef,
              (ref: string): Locator => this.sessionService.refLocator(tab.targetId, ref),
            )
          : await this.discoveryService.stopDomObserver(page);

      res.json({ ok: true, targetId: tab.targetId, ...result });
      log.info('snapshot delta completed', { target_id: tab.targetId, action });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Snapshot delta failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }
}
