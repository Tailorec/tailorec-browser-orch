import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { getProfileContext, getRunId, mapRouteError, sendErrorResponse } from './controller-runtime.utils.js';

const log = createSubsystemLogger('action-controller');

export class SimpleActionController {
  private readonly validator = new ActionValidator();

  constructor(
    private executeActionUseCase: ExecuteActionUseCase,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleClick(req: Request, res: Response): Promise<void> {
    await this.handleAction(
      req,
      res,
      () => this.validator.validateClick(req.body || {}),
      (dto) => ({
        kind: 'click',
        ref: dto.ref,
        doubleClick: dto.doubleClick,
        button: dto.button,
        modifiers: dto.modifiers,
        timeoutMs: dto.timeoutMs,
      }),
      true,
    );
  }

  async handleType(req: Request, res: Response): Promise<void> {
    await this.handleAction(req, res, () => this.validator.validateType(req.body || {}), (dto) => ({
      kind: 'type',
      ref: dto.ref,
      text: dto.text,
      submit: dto.submit,
      slowly: dto.slowly,
      timeoutMs: dto.timeoutMs,
    }));
  }

  async handlePress(req: Request, res: Response): Promise<void> {
    await this.handleAction(req, res, () => this.validator.validatePress(req.body || {}), (dto) => ({
      kind: 'press',
      key: dto.key,
      delayMs: dto.delayMs,
    }));
  }

  async handleHover(req: Request, res: Response): Promise<void> {
    await this.handleAction(req, res, () => this.validator.validateHover(req.body || {}), (dto) => ({
      kind: 'hover',
      ref: dto.ref,
      timeoutMs: dto.timeoutMs,
    }));
  }

  async handleNavigate(req: Request, res: Response): Promise<void> {
    await this.handleAction(
      req,
      res,
      () => this.validator.validateNavigate(req.body || {}),
      (dto) => ({
        kind: 'navigate',
        url: dto.url,
        timeoutMs: dto.timeoutMs,
      }),
      true,
      (dto) => ({ createNewTab: !dto.targetId }),
    );
  }

  private async handleAction<T extends { targetId?: string }>(
    req: Request,
    res: Response,
    parse: () => T,
    buildAction: (dto: T) => Parameters<ExecuteActionUseCase['execute']>[0]['action'],
    includeUrl = false,
    tabOptions?: (dto: T) => { createNewTab?: boolean },
  ): Promise<void> {
    const started = Date.now();
    try {
      const dto = parse();
      const runId = getRunId(req);
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(runId, dto.targetId, tabOptions?.(dto));
      const result = await this.executeActionUseCase.execute({
        cdpUrl: profileCtx.profile.browserEndpoint,
        targetId: tab.targetId,
        action: buildAction(dto),
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
        ...(result.result !== undefined ? { result: result.result } : {}),
      });

      log.info('simple action completed', {
        duration_ms: Date.now() - started,
        path: req.path,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Action failed');
      sendErrorResponse(res, mapped.status, mapped.message);
    }
  }
}
