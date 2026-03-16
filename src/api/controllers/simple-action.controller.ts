import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import type { BrowserRouteContext } from '../context/browser.context.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { getProfileContext, mapRouteError, sendLegacyError } from './controller-runtime.utils.js';

const log = createSubsystemLogger('action-controller');

export class SimpleActionController {
  private readonly validator = new ActionValidator();

  constructor(
    private executeActionUseCase: ExecuteActionUseCase,
    private browserContext: BrowserRouteContext,
  ) {}

  async handleClick(req: Request, res: Response): Promise<void> {
    await this.handleAction(req, res, () => this.validator.validateClick(req.body || {}), (dto) => ({
      kind: 'click',
      ref: dto.ref,
      doubleClick: dto.doubleClick,
      button: dto.button,
      modifiers: dto.modifiers,
      timeoutMs: dto.timeoutMs,
    }));
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
    await this.handleAction(req, res, () => this.validator.validateNavigate(req.body || {}), (dto) => ({
      kind: 'navigate',
      url: dto.url,
      timeoutMs: dto.timeoutMs,
    }));
  }

  private async handleAction<T extends { targetId?: string }>(
    req: Request,
    res: Response,
    parse: () => T,
    buildAction: (dto: T) => Parameters<ExecuteActionUseCase['execute']>[0]['action'],
  ): Promise<void> {
    const started = Date.now();
    try {
      const dto = parse();
      const profileCtx = getProfileContext(this.browserContext, req);
      const tab = await profileCtx.ensureTabAvailable(dto.targetId);
      const result = await this.executeActionUseCase.execute({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        action: buildAction(dto),
      });

      if (!result.ok) {
        sendLegacyError(res, 500, result.error || 'Action failed');
        return;
      }

      res.json({
        ok: true,
        targetId: result.targetId ?? tab.targetId,
        url: result.url ?? tab.url,
        ...(result.result !== undefined ? { result: result.result } : {}),
      });

      log.info('simple action completed', {
        duration_ms: Date.now() - started,
        path: req.path,
      });
    } catch (error) {
      const mapped = mapRouteError(this.browserContext, error, 'Action failed');
      sendLegacyError(res, mapped.status, mapped.message);
    }
  }
}
