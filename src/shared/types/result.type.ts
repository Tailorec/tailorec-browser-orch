/**
 * Result type for operations that can fail.
 * Inspired by Rust's Result<T, E>
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a successful result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Map over the success value
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return { ok: true, value: fn(result.value) } as Result<U, E>;
  }
  return result as Result<U, E>;
}

/**
 * Map over the error
 */
export function mapErrorResult<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (result.ok) {
    return result as Result<T, F>;
  }
  const errorResult = result as { ok: false; error: E };
  return { ok: false, error: fn(errorResult.error) } as Result<T, F>;
}

/**
 * Unwrap result or throw error
 */
export function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw (result as { ok: false; error: E }).error instanceof Error
    ? (result as { ok: false; error: E }).error
    : new Error(String((result as { ok: false; error: E }).error));
}

/**
 * Chain operations, returning early on failure
 */
export function andThenResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (!result.ok) {
    return result as Result<U, E>;
  }
  return fn(result.value);
}

/**
 * Convert Result to Optional-like value
 */
export function resultToValue<T>(result: Result<T, unknown>): T | undefined {
  return result.ok ? result.value : undefined;
}
