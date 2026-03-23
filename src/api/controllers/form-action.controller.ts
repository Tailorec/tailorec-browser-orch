import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { getProfileContext, mapRouteError, sendErrorResponse } from './controller-runtime.utils.js';

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
    await this.handleAction(
      req,
      res,
      dto.targetId,
      {
        kind: 'resize',
        width: dto.width,
        height: dto.height,
      },
      false,
      true,
    );
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
    includeUrl = false,
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
        const timeoutMs = 'timeoutMs' in action ? action.timeoutMs : undefined;
        const waitTimeoutResponse = this.buildWaitLoadStateTimeoutResponse(
          action.kind,
          result.error,
          tab.targetId,
          timeoutMs,
          action.kind === 'wait' ? action.loadState : undefined,
        );
        if (waitTimeoutResponse) {
          res.status(408).json(waitTimeoutResponse);
          return;
        }
        const mapped = mapRouteError(this.browserContext, result.error || 'Action failed', 'Action failed');
        sendErrorResponse(res, mapped.status, mapped.message);
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
          ...(includeUrl ? { url: result.url ?? tab.url } : {}),
        });
      }

      log.info('form action completed', {
        duration_ms: Date.now() - started,
        path: req.path,
      });
    } catch (error) {
      const timeoutMs = 'timeoutMs' in action ? action.timeoutMs : undefined;
      const waitTimeoutResponse = this.buildWaitLoadStateTimeoutResponse(
        action.kind,
        error,
        targetId,
        timeoutMs,
        action.kind === 'wait' ? action.loadState : undefined,
      );
      if (waitTimeoutResponse) {
        res.status(408).json(waitTimeoutResponse);
        return;
      }
      const mapped = mapRouteError(this.browserContext, error, 'Action failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }

  private buildWaitLoadStateTimeoutResponse(
    kind: Parameters<ExecuteActionUseCase['execute']>[0]['action']['kind'],
    error: unknown,
    targetId: string | undefined,
    timeoutMs: number | undefined,
    loadState: 'load' | 'domcontentloaded' | 'networkidle' | undefined,
  ):
    | {
        ok: false;
        error: string;
        code: 'WAIT_LOAD_STATE_TIMEOUT';
        details: {
          kind: string;
          targetId: string | null;
          loadState: string | null;
          timeoutMs: number | null;
          hint: string;
          raw: string;
        };
      }
    | null {
    const rawMessage = error instanceof Error ? error.message : String(error ?? '');
    if (kind !== 'wait' || !rawMessage.includes('waitForLoadState') || !rawMessage.includes('Timeout')) {
      return null;
    }

    const hint =
      loadState === 'networkidle'
        ? 'networkidle can hang on pages with long-polling/analytics; prefer load or domcontentloaded'
        : 'increase timeoutMs or use a less strict wait condition';

    return {
      ok: false,
      error: 'Browser wait action timed out',
      code: 'WAIT_LOAD_STATE_TIMEOUT',
      details: {
        kind: 'wait',
        targetId: targetId ?? null,
        loadState: loadState ?? null,
        timeoutMs: timeoutMs ?? null,
        hint,
        raw: rawMessage.slice(0, 1000),
      },
    };
  }
}
