import { DomainError } from './domain.error.js';

/**
 * Error thrown when validation fails
 */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly fieldErrors: Array<{ field: string; message: string }>,
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      { fieldErrors },
    );
  }

  /**
   * Create ValidationError from Zod error
   */
  static fromZodError(zodError: any): ValidationError {
    const fieldErrors = zodError.errors?.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
    })) ?? [];

    return new ValidationError(
      `Validation failed: ${fieldErrors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join(', ')}`,
      fieldErrors,
    );
  }
}

/**
 * Error thrown when input is invalid
 */
export class InvalidInputError extends DomainError {
  constructor(message: string, field?: string) {
    super(
      message,
      'INVALID_INPUT',
      400,
      field ? { field } : undefined,
    );
  }
}
