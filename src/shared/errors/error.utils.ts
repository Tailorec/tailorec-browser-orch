/**
 * Error Utilities
 *
 * Error handling helper functions.
 * Migrated from src/infra/errors.ts
 */

/**
 * Format error message to string
 */
export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Create error details object
 */
export function createErrorDetails(err: unknown): {
  message: string;
  name?: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
    };
  }
  return {
    message: String(err),
  };
}
