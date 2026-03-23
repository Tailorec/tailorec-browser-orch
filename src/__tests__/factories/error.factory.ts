/**
 * Error factory for creating test error objects.
 * Used for testing error handling and recovery scenarios.
 */

/**
 * Base error options interface.
 */
export interface ErrorOptions {
  message?: string;
  cause?: Error;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Creates a standard Error with additional properties.
 */
export function createError(message: string, options?: ErrorOptions): Error & { code?: string; details?: Record<string, unknown> } {
  const error = new Error(message, options?.cause ? { cause: options.cause } : undefined);
  if (options?.code) {
    (error as any).code = options.code;
  }
  if (options?.details) {
    (error as any).details = options.details;
  }
  return error as Error & { code?: string; details?: Record<string, unknown> };
}

/**
 * Creates a timeout error.
 */
export function createTimeoutError(operation: string, timeoutMs?: number): Error & { code: string } {
  const message = timeoutMs
    ? `Operation '${operation}' timed out after ${timeoutMs}ms`
    : `Operation '${operation}' timed out`;

  return Object.assign(createError(message, { code: "TIMEOUT" }), {
    code: "TIMEOUT" as const,
    details: { operation, timeoutMs },
  });
}

/**
 * Creates a not found error.
 */
export function createNotFoundError(resource: string, identifier?: string): Error & { code: string } {
  const message = identifier
    ? `${resource} not found: ${identifier}`
    : `${resource} not found`;

  return Object.assign(createError(message, { code: "NOT_FOUND" }), {
    code: "NOT_FOUND" as const,
    details: { resource, identifier },
  });
}

/**
 * Creates an invalid argument error.
 */
export function createInvalidArgumentError(argument: string, value: unknown, reason?: string): Error & { code: string } {
  const message = reason
    ? `Invalid argument '${argument}': ${reason} (got: ${String(value)})`
    : `Invalid argument '${argument}': ${String(value)}`;

  return Object.assign(createError(message, { code: "INVALID_ARGUMENT" }), {
    code: "INVALID_ARGUMENT" as const,
    details: { argument, value },
  });
}

/**
 * Creates a validation error.
 */
export function createValidationError(field: string, message: string, value?: unknown): Error & { code: string } {
  return Object.assign(
    createError(`Validation error for '${field}': ${message}`, {
      code: "VALIDATION_ERROR",
      details: { field, value },
    }),
    {
      code: "VALIDATION_ERROR" as const,
      details: { field, message, value },
    },
  );
}

/**
 * Creates a browser unavailable error.
 */
export function createBrowserUnavailableError(cdpUrl?: string): Error & { code: string } {
  const message = cdpUrl
    ? `Browser unavailable at ${cdpUrl}. Please ensure the browser is running.`
    : "Browser unavailable. Please ensure the browser is running.";

  return Object.assign(createError(message, { code: "BROWSER_UNAVAILABLE" }), {
    code: "BROWSER_UNAVAILABLE" as const,
    details: { cdpUrl },
  });
}

/**
 * Creates an element not found error.
 */
export function createElementNotFoundError(ref: string, action?: string): Error & { code: string } {
  const message = action
    ? `Failed to find element with ref '${ref}' for action '${action}'`
    : `Failed to find element with ref '${ref}'`;

  return Object.assign(createError(message, { code: "ELEMENT_NOT_FOUND" }), {
    code: "ELEMENT_NOT_FOUND" as const,
    details: { ref, action },
  });
}

/**
 * Creates an element not visible error.
 */
export function createElementNotVisibleError(ref: string, action?: string): Error & { code: string } {
  const message = action
    ? `Element with ref '${ref}' is not visible for action '${action}'`
    : `Element with ref '${ref}' is not visible`;

  return Object.assign(createError(message, { code: "ELEMENT_NOT_VISIBLE" }), {
    code: "ELEMENT_NOT_VISIBLE" as const,
    details: { ref, action },
  });
}

/**
 * Creates a connection error.
 */
export function createConnectionError(url: string, reason?: string): Error & { code: string } {
  const message = reason
    ? `Failed to connect to ${url}: ${reason}`
    : `Failed to connect to ${url}`;

  return Object.assign(createError(message, { code: "CONNECTION_ERROR" }), {
    code: "CONNECTION_ERROR" as const,
    details: { url, reason },
  });
}

/**
 * Creates a WebSocket error.
 */
export function createWebSocketError(event: string, code?: number, reason?: string): Error & { code: string } {
  const message = `WebSocket ${event} error${code ? ` (code: ${code})` : ""}${reason ? `: ${reason}` : ""}`;

  return Object.assign(createError(message, { code: "WEBSOCKET_ERROR" }), {
    code: "WEBSOCKET_ERROR" as const,
    details: { event, code, reason },
  });
}

/**
 * Creates a permission denied error.
 */
export function createPermissionDeniedError(resource: string, reason?: string): Error & { code: string } {
  const message = reason
    ? `Permission denied for '${resource}': ${reason}`
    : `Permission denied for '${resource}'`;

  return Object.assign(createError(message, { code: "PERMISSION_DENIED" }), {
    code: "PERMISSION_DENIED" as const,
    details: { resource, reason },
  });
}

/**
 * Creates an authentication error.
 */
export function createAuthenticationError(message?: string): Error & { code: string } {
  return Object.assign(
    createError(message ?? "Authentication failed. Please check your credentials.", {
      code: "AUTHENTICATION_ERROR",
    }),
    {
      code: "AUTHENTICATION_ERROR" as const,
    },
  );
}

/**
 * Creates a rate limit error.
 */
export function createRateLimitError(retryAfter?: number): Error & { code: string } {
  const message = retryAfter
    ? `Rate limit exceeded. Please retry after ${retryAfter} seconds.`
    : "Rate limit exceeded. Please try again later.";

  return Object.assign(createError(message, { code: "RATE_LIMIT_EXCEEDED" }), {
    code: "RATE_LIMIT_EXCEEDED" as const,
    details: { retryAfter },
  });
}

/**
 * Creates a configuration error.
 */
export function createConfigurationError(key: string, value?: unknown, reason?: string): Error & { code: string } {
  const message = reason
    ? `Invalid configuration for '${key}': ${reason}`
    : `Invalid configuration for '${key}'`;

  return Object.assign(createError(message, { code: "CONFIGURATION_ERROR" }), {
    code: "CONFIGURATION_ERROR" as const,
    details: { key, value, reason },
  });
}

/**
 * Creates a file system error.
 */
export function createFileSystemError(operation: string, path: string, reason?: string): Error & { code: string } {
  const message = reason
    ? `File system operation '${operation}' failed for '${path}': ${reason}`
    : `File system operation '${operation}' failed for '${path}'`;

  return Object.assign(createError(message, { code: "FILE_SYSTEM_ERROR" }), {
    code: "FILE_SYSTEM_ERROR" as const,
    details: { operation, path, reason },
  });
}

/**
 * Creates a network error.
 */
export function createNetworkError(url: string, statusCode?: number, statusText?: string): Error & { code: string } {
  const message = statusCode
    ? `Network error: ${statusCode} ${statusText ?? ""} for ${url}`
    : `Network error for ${url}`;

  return Object.assign(createError(message, { code: "NETWORK_ERROR" }), {
    code: "NETWORK_ERROR" as const,
    details: { url, statusCode, statusText },
  });
}

/**
 * Creates a parse error.
 */
export function createParseError(format: string, input: string, reason?: string): Error & { code: string } {
  const message = reason
    ? `Failed to parse ${format}: ${reason}`
    : `Failed to parse ${format}`;

  return Object.assign(createError(message, { code: "PARSE_ERROR" }), {
    code: "PARSE_ERROR" as const,
    details: { format, input, reason },
  });
}

/**
 * Creates a JSON parse error.
 */
export function createJsonParseError(input: string, reason?: string): Error & { code: string } {
  return createParseError("JSON", input, reason ?? "Invalid JSON syntax");
}

/**
 * Creates an unknown error.
 */
export function createUnknownError(cause: unknown, fallbackMessage?: string): Error {
  if (cause instanceof Error) {
    return cause;
  }

  const message = fallbackMessage ?? `Unknown error: ${String(cause)}`;
  return createError(message, { cause: cause as Error });
}

/**
 * Creates an error from an HTTP response.
 */
export function createHttpError(statusCode: number, statusText: string, body?: string): Error & { code: string; statusCode: number } {
  const message = `HTTP ${statusCode} ${statusText}${body ? `: ${body}` : ""}`;

  return Object.assign(createError(message, { code: "HTTP_ERROR" }), {
    code: "HTTP_ERROR" as const,
    statusCode,
    details: { statusCode, statusText, body },
  });
}

/**
 * Creates a Playwright error.
 */
export function createPlaywrightError(action: string, message?: string): Error & { code: string } {
  return Object.assign(
    createError(message ?? `Playwright action '${action}' failed`, {
      code: "PLAYWRIGHT_ERROR",
    }),
    {
      code: "PLAYWRIGHT_ERROR" as const,
      details: { action },
    },
  );
}

/**
 * Error type constants.
 */
export const ErrorCodes = {
  TIMEOUT: "TIMEOUT",
  NOT_FOUND: "NOT_FOUND",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BROWSER_UNAVAILABLE: "BROWSER_UNAVAILABLE",
  ELEMENT_NOT_FOUND: "ELEMENT_NOT_FOUND",
  ELEMENT_NOT_VISIBLE: "ELEMENT_NOT_VISIBLE",
  CONNECTION_ERROR: "CONNECTION_ERROR",
  WEBSOCKET_ERROR: "WEBSOCKET_ERROR",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  FILE_SYSTEM_ERROR: "FILE_SYSTEM_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  PARSE_ERROR: "PARSE_ERROR",
  HTTP_ERROR: "HTTP_ERROR",
  PLAYWRIGHT_ERROR: "PLAYWRIGHT_ERROR",
  UNKNOWN: "UNKNOWN",
} as const;

/**
 * Checks if an error matches a specific error code.
 */
export function isErrorWithCode(error: unknown, code: string): error is Error & { code: string } {
  return error instanceof Error && (error as any).code === code;
}

/**
 * Checks if an error is a timeout error.
 */
export function isTimeoutError(error: unknown): boolean {
  return isErrorWithCode(error, ErrorCodes.TIMEOUT);
}

/**
 * Checks if an error is a not found error.
 */
export function isNotFoundError(error: unknown): boolean {
  return isErrorWithCode(error, ErrorCodes.NOT_FOUND);
}

/**
 * Checks if an error is a browser unavailable error.
 */
export function isBrowserUnavailableError(error: unknown): boolean {
  return isErrorWithCode(error, ErrorCodes.BROWSER_UNAVAILABLE);
}

/**
 * Checks if an error is an element not found error.
 */
export function isElementNotFoundError(error: unknown): boolean {
  return isErrorWithCode(error, ErrorCodes.ELEMENT_NOT_FOUND);
}

/**
 * Checks if an error is a validation error.
 */
export function isValidationError(error: unknown): boolean {
  return isErrorWithCode(error, ErrorCodes.VALIDATION_ERROR);
}
