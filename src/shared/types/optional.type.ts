/**
 * Optional type for values that may be absent.
 * Provides a type-safe alternative to null/undefined.
 */
export type Optional<T> =
  | { present: true; value: T }
  | { present: false };

/**
 * Create a present optional
 */
export function some<T>(value: T): Optional<T> {
  return { present: true, value };
}

/**
 * Create an absent optional
 */
export function none<T>(): Optional<T> {
  return { present: false };
}

/**
 * Map over the value if present
 */
export function mapOptional<T, U>(
  optional: Optional<T>,
  fn: (value: T) => U,
): Optional<U> {
  if (optional.present) {
    return some(fn(optional.value));
  }
  return none();
}

/**
 * Get value or default
 */
export function getOrElse<T>(optional: Optional<T>, defaultValue: T): T {
  return optional.present ? optional.value : defaultValue;
}

/**
 * Get value or null
 */
export function toNullable<T>(optional: Optional<T>): T | null {
  return optional.present ? optional.value : null;
}

/**
 * Get value or undefined
 */
export function toUndefined<T>(optional: Optional<T>): T | undefined {
  return optional.present ? optional.value : undefined;
}

/**
 * Check if optional is present
 */
export function isPresent<T>(optional: Optional<T>): optional is { present: true; value: T } {
  return optional.present;
}

/**
 * Check if optional is absent
 */
export function isAbsent<T>(optional: Optional<T>): optional is { present: false } {
  return !optional.present;
}
