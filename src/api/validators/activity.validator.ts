import { z } from 'zod';

const ActivityRequestSchema = z.object({
  targetId: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

export type ActivityRequestDTO = z.infer<typeof ActivityRequestSchema>;

export class ActivityValidationError extends Error {
  constructor(public errors: Array<{ field: string; message: string }>) {
    super(`Activity validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'ActivityValidationError';
  }
}

export class ActivityValidator {
  validate(payload: unknown): ActivityRequestDTO {
    const result = ActivityRequestSchema.safeParse(payload);
    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.') || 'root',
        message: err.message,
      }));
      throw new ActivityValidationError(errors);
    }
    return result.data;
  }
}

