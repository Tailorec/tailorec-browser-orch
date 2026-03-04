import type { Request, Response } from 'express';
import type { ExecuteActionUseCase } from '../../core/use-cases/execute-action.use-case.js';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('action-controller-forms');

/**
 * Action controller - Form & Interaction Actions
 * Handles HTTP requests for form and interaction actions (fill, select, drag, resize, wait)
 * Delegates to ExecuteActionUseCase from Worktree A
 */
export class FormActionController {
  private readonly validator: ActionValidator;

  constructor(
    private executeActionUseCase: ExecuteActionUseCase,
  ) {
    this.validator = new ActionValidator();
  }

  /**
   * Handle POST /act/fill
   * Fill form fields
   */
  async handleFill(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('fill request started', { fields: body.fields?.length || 0 });

    try {
      const dto = this.validator.validateFill(body);

      const result = await this.executeActionUseCase.execute({
        action: {
          kind: 'fill',
          fields: dto.fields as Array<{ ref: string; type: string; value?: string | number | boolean }>,
        },
        targetId: dto.targetId,
      });

      res.json({
        ok: true,
        targetId: result.targetId,
        url: result.url,
        results: result.results,
        allMatched: result.allMatched,
        mismatched: result.mismatched,
      });

      log.info('fill request completed', {
        duration_ms: Date.now() - started,
        fields: dto.fields.length,
      });
    } catch (error) {
      log.exception('fill request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /act/select
   * Select options
   */
  async handleSelect(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('select request started', { ref: body.ref, values: body.values?.length || 0 });

    try {
      // Note: Select use case to be implemented
      res.status(501).json({
        ok: false,
        error: 'Select not yet implemented',
      });

      log.info('select request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('select request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /act/drag
   * Drag from one element to another
   */
  async handleDrag(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('drag request started', { startRef: body.startRef, endRef: body.endRef });

    try {
      // Note: Drag use case to be implemented
      res.status(501).json({
        ok: false,
        error: 'Drag not yet implemented',
      });

      log.info('drag request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('drag request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /act/resize
   * Resize viewport
   */
  async handleResize(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('resize request started', { width: body.width, height: body.height });

    try {
      // Note: Resize use case to be implemented
      res.status(501).json({
        ok: false,
        error: 'Resize not yet implemented',
      });

      log.info('resize request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('resize request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /act/wait
   * Wait for condition
   */
  async handleWait(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('wait request started', { 
      timeMs: body.timeMs,
      text: body.text,
      selector: body.selector,
    });

    try {
      const dto = this.validator.validateWait(body);

      await this.executeActionUseCase.execute({
        action: {
          kind: 'wait',
          timeMs: dto.timeMs,
          text: dto.text,
          textGone: dto.textGone,
          selector: dto.selector,
          url: dto.url,
          loadState: dto.loadState,
          fn: dto.fn,
        },
        targetId: dto.targetId,
      });

      res.json({
        ok: true,
        targetId: dto.targetId || 'unknown',
        url: '',
      });

      log.info('wait request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('wait request failed', error);
      throw error;
    }
  }
}
