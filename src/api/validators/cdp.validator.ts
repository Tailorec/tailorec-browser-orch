import { z } from 'zod';

const CdpBaseSchema = z.object({
  targetId: z.string().optional(),
  wsUrl: z.string().optional(),
});

const CdpScreenshotSchema = CdpBaseSchema.extend({
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().int().min(0).max(100).optional(),
  fullPage: z.boolean().optional(),
});

const CdpCreateTargetSchema = z.object({
  url: z.string().min(1),
});

const CdpEvaluateSchema = CdpBaseSchema.extend({
  expression: z.string().min(1),
  awaitPromise: z.boolean().optional(),
  returnByValue: z.boolean().optional(),
});

export type CdpScreenshotDTO = z.infer<typeof CdpScreenshotSchema>;
export type CdpCreateTargetDTO = z.infer<typeof CdpCreateTargetSchema>;
export type CdpEvaluateDTO = z.infer<typeof CdpEvaluateSchema>;

export class CdpValidationError extends Error {
  constructor(public errors: Array<{ field: string; message: string }>) {
    super(`CDP validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'CdpValidationError';
  }
}

export class CdpValidator {
  validateScreenshot(payload: unknown): CdpScreenshotDTO {
    return this.validate(payload, CdpScreenshotSchema);
  }

  validateCreateTarget(payload: unknown): CdpCreateTargetDTO {
    return this.validate(payload, CdpCreateTargetSchema);
  }

  validateEvaluate(payload: unknown): CdpEvaluateDTO {
    return this.validate(payload, CdpEvaluateSchema);
  }

  private validate<T>(payload: unknown, schema: z.ZodSchema<T>): T {
    const result = schema.safeParse(payload);
    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.') || 'root',
        message: err.message,
      }));
      throw new CdpValidationError(errors);
    }
    return result.data;
  }
}

