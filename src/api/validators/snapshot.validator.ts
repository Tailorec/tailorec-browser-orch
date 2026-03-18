import { z } from 'zod';

/**
 * Snapshot request validation schema
 * Extracted from src/browser/routes/agent.snapshot.ts
 */
export const SnapshotRequestSchema = z.object({
  targetId: z.string().optional(),
  timeoutMs: z.number().optional(),
  maxChars: z.number().optional(),
  interactiveOnly: z.boolean().optional().default(false),
  compact: z.boolean().optional().default(false),
  maxDepth: z.number().optional().default(10),
});

export type SnapshotRequestDTO = z.infer<typeof SnapshotRequestSchema>;

/**
 * Snapshot delta request validation schema
 */
export const SnapshotDeltaRequestSchema = z.object({
  targetId: z.string().optional(),
  action: z.enum(['start', 'stop']),
  anchorRef: z.string().optional(),
});

export type SnapshotDeltaRequestDTO = z.infer<typeof SnapshotDeltaRequestSchema>;

/**
 * Snapshot validation error
 */
export class SnapshotValidationError extends Error {
  constructor(
    public errors: Array<{ field: string; message: string }>,
  ) {
    super(`Snapshot validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'SnapshotValidationError';
  }
}

/**
 * Snapshot validator class
 * Validates snapshot request payloads
 */
export class SnapshotValidator {
  /**
   * Validate snapshot request
   */
  validate(payload: unknown): SnapshotRequestDTO {
    const result = SnapshotRequestSchema.safeParse(payload);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.') || 'root',
        message: err.message,
      }));
      throw new SnapshotValidationError(errors);
    }

    return result.data;
  }

  /**
   * Validate snapshot delta request
   */
  validateDelta(payload: unknown): SnapshotDeltaRequestDTO {
    const result = SnapshotDeltaRequestSchema.safeParse(payload);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.') || 'root',
        message: err.message,
      }));
      throw new SnapshotValidationError(errors);
    }

    return result.data;
  }
}
