import type { Request, Response } from 'express';
import type { Locator } from 'playwright-core';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { SessionService } from '../../core/services/session.service.js';
import { DiscoveryService } from '../../core/services/discovery.service.js';
import { getProfileContext, getRunId, mapRouteError, sendErrorResponse } from './controller-runtime.utils.js';

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
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.browserEndpoint);
      const resolveRef = (ref: string): Locator => this.sessionService.refLocator(tab.targetId, ref);

      if (dto.refs?.length) {
        const states = await Promise.all(
          dto.refs.map(async (ref) => this.discoveryService.queryElementState(page, ref, resolveRef)),
        );
        res.json({ ok: true, targetId: tab.targetId, states });
        return;
      }

      if (!dto.ref) {
        sendErrorResponse(res, 400, 'ref or refs is required');
        return;
      }

      const state = await this.discoveryService.queryElementState(page, dto.ref, resolveRef);
      res.json({ ok: true, targetId: tab.targetId, state });
      log.debug('query_state completed', { profile: profileCtx.profile.name, target_id: tab.targetId });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Query state failed');
      sendErrorResponse(res, mapped.status, mapped.message);
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
        sendErrorResponse(
          res,
          403,
          'act:evaluate is disabled by config (browser.evaluateEnabled=false).\nDocs: /gateway/configuration#browser-openclaw-managed-browser',
        );
        return;
      }

      const dto = this.validator.validateEvaluate(req.body || {});
      await this.execute(
        req,
        res,
        dto.targetId,
        {
          kind: 'evaluate',
          fn: dto.fn,
          ref: dto.ref,
        },
        true,
        true,
      );
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Evaluate failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  async handleClose(req: Request, res: Response): Promise<void> {
    try {
      const runId = getRunId(req);
      const targetId = typeof (req.body || {}).targetId === 'string' ? (req.body as { targetId?: string }).targetId : undefined;
      const profileCtx = getProfileContext(this.browserContext, req);
      const closed = await profileCtx.closeRunSession(runId, targetId);
      if (!closed.closed || !closed.targetId) {
        sendErrorResponse(res, 404, 'Run session not found');
        return;
      }
      const page = await this.sessionService.getPage(closed.targetId, profileCtx.profile.browserEndpoint);
      try {
        await page.close();
      } catch {
        // Best-effort close before runtime teardown.
      }
      await profileCtx.stopRunningBrowser();
      this.sessionService.forgetSession(closed.targetId);
      res.json({ ok: true, targetId: closed.targetId });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Close failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  async handleDiscoverDropdown(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDiscoverDropdown(req.body || {});
      const { profileCtx, tab, page } = await this.resolvePage(req, dto.targetId);
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.browserEndpoint);
      const resolveRef = (ref: string): Locator => this.sessionService.refLocator(tab.targetId, ref);
      const result = await this.discoveryService.discoverDropdownOptions(
        page,
        dto.ref,
        dto.searchText,
        dto.timeoutMs,
        resolveRef,
      );
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Discover dropdown failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  async handleCloseDropdown(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateCloseDropdown(req.body || {});
      const { profileCtx, tab, page } = await this.resolvePage(req, dto.targetId);
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.browserEndpoint);
      await this.discoveryService.closeDropdown(
        page,
        dto.ref,
        (ref: string): Locator => this.sessionService.refLocator(tab.targetId, ref),
      );
      res.json({ ok: true, targetId: tab.targetId });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Close dropdown failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  async handleDetectBlocker(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDetectBlocker(req.body || {});
      const { profileCtx, tab, page } = await this.resolvePage(req, dto.targetId);
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.browserEndpoint);
      const result = await this.discoveryService.detectBlockingElement(
        page,
        dto.ref,
        (ref: string): Locator => this.sessionService.refLocator(tab.targetId, ref),
      );
      res.json({ ok: true, targetId: tab.targetId, ...(result ?? { isBlocked: false }) });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Detect blocker failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  async handleDismissBlocker(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validator.validateDismissBlocker(req.body || {});
      const { profileCtx, tab, page } = await this.resolvePage(req, (req.body || {}).targetId);
      await this.sessionService.restoreRoleRefs(tab.targetId, profileCtx.profile.browserEndpoint);
      const result = await this.discoveryService.dismissBlocker(
        page,
        dto.targetRef,
        dto.strategy as any,
        dto.closeButtonRef,
        (ref: string): Locator => this.sessionService.refLocator(tab.targetId, ref),
      );
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Dismiss blocker failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  private async execute(
    req: Request,
    res: Response,
    targetId: string | undefined,
    action: Parameters<ExecuteActionUseCase['execute']>[0]['action'],
    includeResult = false,
    includeUrl = false,
  ): Promise<void> {
    try {
      const { profileCtx, tab } = await this.resolvePage(req, targetId);
      const result = await this.executeActionUseCase.execute({
        cdpUrl: profileCtx.profile.browserEndpoint,
        targetId: tab.targetId,
        action,
      });

      if (!result.ok) {
        const mapped = mapRouteError(this.browserContext, result.error || 'Action failed', 'Action failed');
        sendErrorResponse(res, mapped.status, mapped.message);
        return;
      }

      res.json({
        ok: true,
        targetId: result.targetId ?? tab.targetId,
        ...(includeUrl ? { url: result.url ?? tab.url } : {}),
        ...(includeResult ? { result: result.result } : {}),
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Action failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  private async resolvePage(req: Request, targetId?: string) {
    const runId = getRunId(req);
    const profileCtx = getProfileContext(this.browserContext, req);
    const tab = await profileCtx.ensureTabAvailable(runId, targetId);
    const page = await this.sessionService.getPage(tab.targetId, profileCtx.profile.browserEndpoint);
    return { profileCtx, tab, page };
  }
}
