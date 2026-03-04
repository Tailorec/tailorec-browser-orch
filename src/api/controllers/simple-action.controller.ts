import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../logging/subsystem.js';

const log = createSubsystemLogger('action-controller');

/**
 * Action controller - Simple Actions
 * Handles HTTP requests for simple browser actions (click, type, press, hover, navigate)
 * Delegates to ExecuteActionUseCase from Worktree A
 */
export class SimpleActionController {
  private readonly validator: ActionValidator;

  constructor(
    private executeActionUseCase: ExecuteActionUseCase,
  ) {
    this.validator = new ActionValidator();
  }

  /**
   * Handle POST /act/click
   * Click an element
   */
  async handleClick(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('click request started', { ref: body.ref });

    try {
      const dto = this.validator.validateClick(body);

      const result = await this.executeActionUseCase.execute({
        action: {
          kind: 'click',
          ref: dto.ref,
          doubleClick: dto.doubleClick,
          button: dto.button,
          modifiers: dto.modifiers,
        },
        targetId: dto.targetId,
      });

      res.json({
        ok: true,
        targetId: result.targetId,
        url: result.url,
      });

      log.info('click request completed', {
        duration_ms: Date.now() - started,
        ref: dto.ref,
      });
    } catch (error) {
      log.exception('click request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /act/type
   * Type text into input
   */
  async handleType(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('type request started', { ref: body.ref });

    try {
      const dto = this.validator.validateType(body);

      const result = await this.executeActionUseCase.execute({
        action: {
          kind: 'type',
          ref: dto.ref,
          text: dto.text,
          submit: dto.submit,
          slowly: dto.slowly,
        },
        targetId: dto.targetId,
      });

      res.json({
        ok: true,
        targetId: result.targetId,
        url: result.url,
      });

      log.info('type request completed', {
        duration_ms: Date.now() - started,
        ref: dto.ref,
      });
    } catch (error) {
      log.exception('type request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /act/press
   * Press a key
   */
  async handlePress(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('press request started', { key: body.key });

    try {
      const dto = this.validator.validatePress(body);

      const result = await this.executeActionUseCase.execute({
        action: {
          kind: 'press',
          key: dto.key,
          delayMs: dto.delayMs,
        },
        targetId: dto.targetId,
      });

      res.json({
        ok: true,
        targetId: result.targetId,
        url: result.url,
      });

      log.info('press request completed', {
        duration_ms: Date.now() - started,
        key: dto.key,
      });
    } catch (error) {
      log.exception('press request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /act/hover
   * Hover over an element
   */
  async handleHover(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('hover request started', { ref: body.ref });

    try {
      const dto = this.validator.validateHover(body);

      await this.executeActionUseCase.execute({
        action: {
          kind: 'hover',
          ref: dto.ref,
        },
        targetId: dto.targetId,
      });

      res.json({
        ok: true,
        targetId: dto.targetId || 'unknown',
        url: '',
      });

      log.info('hover request completed', {
        duration_ms: Date.now() - started,
        ref: dto.ref,
      });
    } catch (error) {
      log.exception('hover request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /act/navigate
   * Navigate to URL
   */
  async handleNavigate(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('navigate request started', { url: body.url });

    try {
      const dto = this.validator.validateNavigate(body);

      const result = await this.executeActionUseCase.execute({
        action: {
          kind: 'navigate',
          url: dto.url,
        },
        targetId: dto.targetId,
      });

      res.json({
        ok: true,
        targetId: result.targetId,
        url: result.url,
      });

      log.info('navigate request completed', {
        duration_ms: Date.now() - started,
        url: dto.url,
      });
    } catch (error) {
      log.exception('navigate request failed', error);
      throw error;
    }
  }
}
