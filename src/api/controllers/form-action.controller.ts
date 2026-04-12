import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { getProfileContext, getRunId, mapRouteError, sendErrorResponse } from './controller-runtime.utils.js';

const log = createSubsystemLogger('action-controller-forms');

export class FormActionController {
  private readonly validator = new ActionValidator();

  constructor(
    private executeActionUseCase: ExecuteActionUseCase,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleFill(req: Request, res: Response): Promise<void> {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const record = body as Record<string, unknown>;
    const targetId =
      typeof record.targetId === 'string' && record.targetId.trim() ? record.targetId.trim() : undefined;
    const timeoutMs = typeof record.timeoutMs === 'number'
      ? record.timeoutMs
      : typeof record.timeoutMs === 'string' && record.timeoutMs.trim()
        ? Number(record.timeoutMs)
        : undefined;

    const fields = this.parseFillFields(record.fields);
    if (!fields.length) {
      sendErrorResponse(res, 400, 'fields are required');
      return;
    }

    await this.handleAction(
      req,
      res,
      targetId,
      {
        kind: 'fill',
        fields,
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
      },
      true,
    );
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
      const runId = getRunId(req);
      const tab = await profileCtx.ensureTabAvailable(runId, targetId);
      const result = await this.executeActionUseCase.execute({
        cdpUrl: tab.browserEndpoint,
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

  private parseFillFields(
    value: unknown,
  ): Array<{ ref: string; type: string; value?: string | number | boolean }> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const ref = typeof record.ref === 'string' ? record.ref.trim() : '';
        const type = typeof record.type === 'string' ? record.type.trim() : '';

        if (!ref || !type) {
          return null;
        }

        const rawValue = record.value;
        const normalized =
          typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean'
            ? rawValue
            : undefined;

        return normalized === undefined ? { ref, type } : { ref, type, value: normalized };
      })
      .filter(
        (
          entry,
        ): entry is {
          ref: string;
          type: string;
          value?: string | number | boolean;
        } => entry !== null,
      );
  }

  private buildWaitLoadStateTimeoutResponse(
    kind: Parameters<ExecuteActionUseCase['execute']>[0]['action']['kind'],
    error: unknown,
    _targetId: string | undefined,
    _timeoutMs: number | undefined,
    _loadState: 'load' | 'domcontentloaded' | 'networkidle' | undefined,
  ): { ok: false; error: string } | null {
    const rawMessage = error instanceof Error ? error.message : String(error ?? '');
    if (kind !== 'wait' || !rawMessage.includes('Timeout')) {
      return null;
    }

    if (
      !rawMessage.includes('waitForLoadState') &&
      !rawMessage.includes('waitForFunction') &&
      !rawMessage.includes('waitForURL') &&
      !rawMessage.includes('locator.evaluate')
    ) {
      return { ok: false, error: 'Browser action timed out' };
    }
    return { ok: false, error: 'Browser action timed out' };
  }
}
