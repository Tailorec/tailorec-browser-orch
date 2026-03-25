import { DomainError } from './domain.error.js';

/**
 * Error thrown when browser action fails
 */
export class BrowserError extends DomainError {
  constructor(
    message: string,
    code: string = 'BROWSER_ERROR',
    status: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message, code, status, details);
  }
}

/**
 * Error thrown when element is not found
 */
export class ElementNotFoundError extends BrowserError {
  constructor(
    public readonly ref: string,
    public readonly url?: string,
  ) {
    super(
      `Element [ref=${ref}] not found`,
      'ELEMENT_NOT_FOUND',
      404,
      { ref, url },
    );
  }
}

/**
 * Error thrown when action times out
 */
export class TimeoutError extends BrowserError {
  constructor(
    public readonly action: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `Action "${action}" timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      408,
      { action, timeoutMs },
    );
  }
}

/**
 * Error thrown when element reference is stale
 */
export class StaleElementError extends BrowserError {
  constructor(public readonly ref: string) {
    super(
      `Element [ref=${ref}] is stale. Take a new snapshot.`,
      'STALE_ELEMENT',
      409,
      { ref },
    );
  }
}

/**
 * Error thrown when browser is not available
 */
export class BrowserNotAvailableError extends BrowserError {
  constructor() {
    super(
      'Browser is not available. Please start the browser first.',
      'BROWSER_NOT_AVAILABLE',
      503,
    );
  }
}
