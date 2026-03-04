import type { Request, Response } from 'express';
import type { TakeSnapshotUseCase } from '../../core/use-cases/take-snapshot.use-case.js';
import { SnapshotValidator, type SnapshotRequestDTO, type SnapshotDeltaRequestDTO } from '../validators/snapshot.validator.js';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('snapshot-controller');

/**
 * Snapshot controller
 * Handles HTTP requests for snapshot operations
 * Delegates to TakeSnapshotUseCase from Worktree A
 */
export class SnapshotController {
  private readonly validator: SnapshotValidator;

  constructor(
    private takeSnapshotUseCase: TakeSnapshotUseCase,
  ) {
    this.validator = new SnapshotValidator();
  }

  /**
   * Handle POST /snapshot
   * Take a snapshot of the current page
   */
  async handleSnapshot(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('snapshot request started', {
      targetId: body.targetId,
      interactiveOnly: body.interactiveOnly,
    });

    try {
      // Validate request
      const dto = this.validator.validate(body);

      // Execute use case
      const result = await this.takeSnapshotUseCase.execute({
        targetId: dto.targetId,
        options: {
          timeoutMs: dto.timeoutMs,
          maxChars: dto.maxChars,
          interactiveOnly: dto.interactiveOnly,
          compact: dto.compact,
          maxDepth: dto.maxDepth,
        },
      });

      // Send response - preserve API contract
      res.json({
        ok: true,
        targetId: result.targetId,
        url: result.url,
        snapshot: result.snapshot,
        refs: result.refs,
        truncated: result.truncated,
        stats: result.stats,
      });

      log.info('snapshot request completed', {
        duration_ms: Date.now() - started,
        chars: typeof result.snapshot === 'string' ? result.snapshot.length : 0,
        refs: Object.keys(result.refs || {}).length,
      });
    } catch (error) {
      log.exception('snapshot request failed', error);
      throw error; // Let error middleware handle it
    }
  }

  /**
   * Handle POST /snapshot/delta
   * Start/stop incremental snapshot observation
   */
  async handleSnapshotDelta(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    const body = req.body || {};
    
    log.info('snapshot delta request started', {
      targetId: body.targetId,
      action: body.action,
    });

    try {
      // Validate request
      const dto = this.validator.validateDelta(body);

      // Note: Delta snapshot use case to be implemented in Worktree A
      // For now, return not implemented
      res.status(501).json({
        ok: false,
        error: 'Delta snapshots not yet implemented',
      });

      log.info('snapshot delta request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('snapshot delta request failed', error);
      throw error;
    }
  }

  /**
   * Handle POST /snapshot/aria
   * Take accessibility tree snapshot
   */
  async handleSnapshotAria(req: Request, res: Response): Promise<void> {
    const started = Date.now();
    
    log.info('snapshot aria request started');

    try {
      // Note: Aria snapshot use case to be implemented in Worktree A
      res.status(501).json({
        ok: false,
        error: 'Aria snapshots not yet implemented',
      });

      log.info('snapshot aria request completed', {
        duration_ms: Date.now() - started,
      });
    } catch (error) {
      log.exception('snapshot aria request failed', error);
      throw error;
    }
  }
}
