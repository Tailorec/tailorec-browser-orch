import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { getProfileContext, mapRouteError, sendLegacyError } from './controller-runtime.utils.js';

const log = createSubsystemLogger('action-controller-forms');

export class FormActionController {
  private readonly validator = new ActionValidator();

  constructor(
    private executeActionUseCase: ExecuteActionUseCase,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleFill(req: Request, res: Response): Promise<void> {
    const dto = this.validator.validateFill(req.body || {});
    await this.handleAction(req, res, dto.targetId, {
      kind: 'fill',
      fields: dto.fields as Array<{ ref: string; type: string; value?: string | number | boolean }>,
      timeoutMs: dto.timeoutMs,
    }, true);
  }

  async handleSelect(req: Request, res: Response): Promise<void> {
    const dto = this.validator.validateSelect(req.body || {});
    await this.handleAction(req, res, dto.targetId, {
      kind: 'select',
      ref: dto.ref,
      values: dto.values,
      timeoutMs: dto.timeoutMs,
    });
  }

  async handleDrag(req: Request, res: Response): Promise<void> {
    const dto = this.validator.validateDrag(req.body || {});
    await this.handleAction(req, res, dto.targetId, {
      kind: 'drag',
      startRef: dto.startRef,
      endRef: dto.endRef,
      timeoutMs: dto.timeoutMs,
    });
  }

  async handleResize(req: Request, res: Response): Promise<void> {
    const dto = this.validator.validateResize(req.body || {});
    await this.handleAction(req, res, dto.targetId, {
      kind: 'resize',
      width: dto.width,
      height: dto.height,
    });
  }

  async handleWait(req: Request, res: Response): Promise<void> {
    const dto = this.validator.validateWait(req.body || {});
    await this.handleAction(req, res, dto.targetId, {
      kind: 'wait',
      timeMs: dto.timeMs,
      text: dto.text,
      textGone: dto.textGone,
      selector: dto.selector,
      url: dto.url,
      loadState: dto.loadState,
      fn: dto.fn,
      timeoutMs: dto.timeoutMs,
    });
  }

  private async handleAction(
    req: Request,
    res: Response,
    targetId: string | undefined,
    action: Parameters<ExecuteActionUseCase['execute']>[0]['action'],
    includeFillResponse = false,
  ): Promise<void> {
    const started = Date.now();
    try {
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const result = await this.executeActionUseCase.execute({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        action,
      });

      if (!result.ok) {
        sendLegacyError(res, 500, result.error || 'Action failed');
        return;
      }

      if (includeFillResponse) {
        res.json({
          ok: true,
          targetId: result.targetId ?? tab.targetId,
          url: result.url ?? tab.url,
          results: result.results ?? [],
          allMatched: result.allMatched ?? false,
          mismatched: (result.results ?? [])
            .filter((entry) => !entry.matched)
            .map((entry) => ({
              ref: entry.ref,
              requested: entry.requestedValue,
              actual: entry.actualValue,
              warning: entry.warning,
            })),
        });
      } else {
        res.json({
          ok: true,
          targetId: result.targetId ?? tab.targetId,
          url: result.url ?? tab.url,
        });
      }

      log.info('form action completed', {
        duration_ms: Date.now() - started,
        path: req.path,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Action failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }
}
