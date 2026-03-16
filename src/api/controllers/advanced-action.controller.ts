import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { SessionService } from '../../core/services/session.service.js';
import { DiscoveryService } from '../../core/services/discovery.service.js';
import { getProfileContext, mapRouteError, sendLegacyError } from './controller-runtime.utils.js';

const log = createSubsystemLogger('action-controller-advanced');

export class AdvancedActionController {
  private readonly validator = new ActionValidator();

  constructor(
    private executeActionUseCase: ExecuteActionUseCase,
    private sessionService: SessionService,
    private discoveryService: DiscoveryService,
    private browserContext: BrowserRouteContext,
    private evaluateEnabled: boolean,
  ) {}

  async handleQueryState(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateQueryState(req.body || {});
      const { profileCtx, tab, page } = await this.resolvePage(req, dto.targetId);

      if (dto.refs?.length) {
        const states = await Promise.all(
          dto.refs.map(async (ref) => this.discoveryService.queryElementState(page, ref)),
        );
        res.json({ ok: true, targetId: tab.targetId, states });
        return;
      }

      if (!dto.ref) {
        sendLegacyError(res, 400, 'ref or refs is required');
        return;
      }

      const state = await this.discoveryService.queryElementState(page, dto.ref);
      res.json({ ok: true, targetId: tab.targetId, state });
      log.debug('query_state completed', { profile: profileCtx.profile.name, target_id: tab.targetId });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Query state failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleScrollIntoView(req: Request, res: Response): Promise<void> {
    const dto = this.validator.validateScrollIntoView(req.body || {});
    await this.execute(req, res, dto.targetId, {
      kind: 'scrollIntoView',
      ref: dto.ref,
      timeoutMs: dto.timeoutMs,
    });
  }

  async handleEvaluate(req: Request, res: Response): Promise<void> {
    try {
      if (!this.evaluateEnabled) {
        sendLegacyError(
          res,
          403,
          'act:evaluate is disabled by config (browser.evaluateEnabled=false).\nDocs: /gateway/configuration#browser-openclaw-managed-browser',
        );
        return;
      }

      const dto = this.validator.validateEvaluate(req.body || {});
      await this.execute(req, res, dto.targetId, {
        kind: 'evaluate',
        fn: dto.fn,
        ref: dto.ref,
      }, true);
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Evaluate failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleClose(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, (req.body || {}).targetId, { kind: 'close' });
  }

  async handleDiscoverDropdown(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDiscoverDropdown(req.body || {});
      const { tab, page } = await this.resolvePage(req, dto.targetId);
      const result = await this.discoveryService.discoverDropdownOptions(
        page,
        dto.ref,
        dto.searchText,
        dto.timeoutMs,
      );
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Discover dropdown failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleCloseDropdown(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateCloseDropdown(req.body || {});
      const { tab, page } = await this.resolvePage(req, dto.targetId);
      await this.discoveryService.closeDropdown(page, dto.ref);
      res.json({ ok: true, targetId: tab.targetId });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Close dropdown failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleDetectBlocker(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDetectBlocker(req.body || {});
      const { tab, page } = await this.resolvePage(req, dto.targetId);
      const result = await this.discoveryService.detectBlockingElement(page, dto.ref);
      res.json({ ok: true, targetId: tab.targetId, ...(result ?? { isBlocked: false }) });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Detect blocker failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  async handleDismissBlocker(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDismissBlocker(req.body || {});
      const { tab, page } = await this.resolvePage(req, (req.body || {}).targetId);
      const result = await this.discoveryService.dismissBlocker(
        page,
        dto.targetRef,
        dto.strategy as any,
        dto.closeButtonRef,
      );
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Dismiss blocker failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  private async execute(
    req: Request,
    res: Response,
    targetId: string | undefined,
    action: Parameters<ExecuteActionUseCase['execute']>[0]['action'],
    includeResult = false,
  ): Promise<void> {
    try {
      const { profileCtx, tab } = await this.resolvePage(req, targetId);
      const result = await this.executeActionUseCase.execute({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        action,
      });

      if (!result.ok) {
        sendLegacyError(res, 500, result.error || 'Action failed');
        return;
      }

      res.json({
        ok: true,
        targetId: result.targetId ?? tab.targetId,
        url: result.url ?? tab.url,
        ...(includeResult ? { result: result.result } : {}),
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Action failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }

  private async resolvePage(req: Request, targetId?: string) {
    const profileCtx = getProfileContext(this.browserContext, req);
    const tab = await profileCtx.ensureTabAvailable(targetId);
    const page = await this.sessionService.getPage(tab.targetId, profileCtx.profile.cdpUrl);
    return { profileCtx, tab, page };
  }
}
