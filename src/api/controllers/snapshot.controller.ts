import type { Request, Response } from 'express';
import type { TakeSnapshotUseCase } from '../../core/use-cases/take-snapshot.use-case.js';
import { SnapshotValidator } from '../validators/snapshot.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { DiscoveryService } from '../../core/services/discovery.service.js';
import { SessionService } from '../../core/services/session.service.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { getProfileContext, mapRouteError, sendLegacyError } from './controller-runtime.utils.js';

const log = createSubsystemLogger('snapshot-controller');

export class SnapshotController {
  private readonly validator = new SnapshotValidator();

  constructor(
    private takeSnapshotUseCase: TakeSnapshotUseCase,
    private sessionService: SessionService,
    private discoveryService: DiscoveryService,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validate(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(dto.targetId);
      const result = await this.takeSnapshotUseCase.execute({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        options: {
          timeoutMs: dto.timeoutMs,
          maxChars: dto.maxChars,
          interactiveOnly: dto.interactiveOnly,
          compact: dto.compact,
          maxDepth: dto.maxDepth,
        },
      });

      if (!result.ok) {
        sendLegacyError(res, 500, result.error || 'Snapshot failed');
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
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleSnapshotDelta(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDelta(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(dto.targetId);
      const page = await this.sessionService.getPage(tab.targetId, profileCtx.profile.cdpUrl);

      const result =
        dto.action === 'start'
          ? await this.discoveryService.startDomObserver(page, dto.anchorRef)
          : await this.discoveryService.stopDomObserver(page);

      res.json({ ok: true, targetId: tab.targetId, ...result });
      log.info('snapshot delta completed', { target_id: tab.targetId, action: dto.action });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Delta snapshot failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleSnapshotAria(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validate(req.body || {});
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(dto.targetId);
      const result = await this.takeSnapshotUseCase.execute({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        type: 'aria',
        options: {
          ariaLimit: dto.maxChars,
        },
      });

      if (!result.ok) {
        sendLegacyError(res, 500, result.error || 'ARIA snapshot failed');
        return;
      }

      res.json({
        ok: true,
        targetId: result.targetId ?? tab.targetId,
        url: result.url ?? tab.url,
        nodes: result.nodes ?? [],
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'ARIA snapshot failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }
}
