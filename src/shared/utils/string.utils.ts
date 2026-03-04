/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => char?.toUpperCase() ?? '')
    .replace(/^[A-Z]/, char => char.toLowerCase());
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Redact sensitive information from object values
 */
export function redactSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitivePatterns = ['password', 'pwd', 'secret', 'token', 'authorization', 'api_key'];
  const redacted = { ...obj };

  for (const [key, value] of Object.entries(redacted)) {
    const keyLower = key.toLowerCase();
    if (sensitivePatterns.some(pattern => keyLower.includes(pattern))) {
      redacted[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>);
    }
  }

  return redacted;
}

/**
 * Generate random alphanumeric string
 */
export function randomString(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

/**
 * Escape special regex characters in string
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if string is blank (empty or whitespace only)
 */
export function isBlank(str: string | null | undefined): boolean {
  if (!str) return true;
  return str.trim().length === 0;
}

/**
 * Check if string is not blank
 */
export function isNotBlank(str: string | null | undefined): boolean {
  return !isBlank(str);
}
