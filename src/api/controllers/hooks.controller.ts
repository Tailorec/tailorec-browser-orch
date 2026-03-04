import type { Request, Response } from 'express';
import { ActionValidator } from '../validators/action.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('hooks-controller');

/**
 * Hooks controller
 * Handles HTTP requests for browser hooks (file chooser, dialog, download)
 * Delegates to use cases from Worktree A
 */
export class HooksController {
  private readonly validator: ActionValidator;

  constructor(
    // Note: Add use case dependencies when implemented in Worktree A
    // private executeFileChooserUseCase: ExecuteFileChooserUseCase,
    // private handleDialogUseCase: HandleDialogUseCase,
    // private waitForDownloadUseCase: WaitForDownloadUseCase,
  ) {
    this.validator = new ActionValidator();
  }

  /**
   * Handle POST /hooks/file-chooser
   * Stage files for file chooser upload
   */
  async handleFileChooser(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('file-chooser hook request started', { 
      targetId: body.targetId,
      paths: body.paths?.length || 0,
    });

    try {
      const dto = this.validator.validateFileChooser(body);

      if (!dto.paths.length) {
        res.status(400).json({
          ok: false,
          error: 'paths are required',
        });
        return;
      }

      if ((dto.inputRef || dto.element) && dto.ref) {
        res.status(400).json({
          ok: false,
          error: 'ref cannot be combined with inputRef/element',
        });
        return;
      }

      // Note: File chooser use case to be implemented in Worktree A
      // For now, return success placeholder
      res.json({ ok: true });

      log.info('file-chooser hook request completed', {
        duration_ms: Date.now() - started,
        paths: dto.paths.length,
      });
    } catch (error) {
      log.exception('file-chooser hook request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /hooks/dialog
   * Arm dialog handler
   */
  async handleDialog(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('dialog hook request started', { 
      targetId: body.targetId,
      accept: body.accept,
    });

    try {
      const dto = this.validator.validateDialog(body);

      if (dto.accept === undefined) {
        res.status(400).json({
          ok: false,
          error: 'accept is required',
        });
        return;
      }

      // Note: Dialog use case to be implemented in Worktree A
      // For now, return success placeholder
      res.json({ ok: true });

      log.info('dialog hook request completed', {
        duration_ms: Date.now() - started,
        accept: dto.accept,
      });
    } catch (error) {
      log.exception('dialog hook request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /wait/download
   * Wait for download to complete
   */
  async handleWaitDownload(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('wait/download request started', { 
      targetId: body.targetId,
      path: body.path,
    });

    try {
      const dto = this.validator.validateDownloadWait(body);

      // Note: Wait for download use case to be implemented in Worktree A
      // For now, return not implemented
      res.status(501).json({
        ok: false,
        error: 'Wait for download not yet implemented',
      });

      log.info('wait/download request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('wait/download request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /download
   * Download file from element
   */
  async handleDownload(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('download request started', { 
      targetId: body.targetId,
      ref: body.ref,
      path: body.path,
    });

    try {
      const dto = this.validator.validateDownload(body);

      if (!dto.ref) {
        res.status(400).json({
          ok: false,
          error: 'ref is required',
        });
        return;
      }

      if (!dto.path) {
        res.status(400).json({
          ok: false,
          error: 'path is required',
        });
        return;
      }

      // Note: Download use case to be implemented in Worktree A
      // For now, return not implemented
      res.status(501).json({
        ok: false,
        error: 'Download not yet implemented',
      });

      log.info('download request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('download request failed', error);
      throw error;
    }
  }
}
