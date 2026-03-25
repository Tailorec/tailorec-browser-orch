/**
 * Application Constants
 *
 * Centralized constants for the browser service.
 */

/**
 * Default browser profile name
 */
export const DEFAULT_OPENCLAW_BROWSER_PROFILE_NAME = "default";

/**
 * Default browser profile color
 */
export const DEFAULT_OPENCLAW_BROWSER_COLOR = "blue";

/**
 * Default CDP port for Chrome DevTools Protocol
 */
export const DEFAULT_CDP_PORT = 9222;

/**
 * Default HTTP port for the browser service
 */
export const DEFAULT_SERVICE_PORT = 4000;

/**
 * Default service host
 */
export const DEFAULT_SERVICE_HOST = "127.0.0.1";

/**
 * Default viewport dimensions
 */
export const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 720,
} as const;

/**
 * Default timeout for browser operations (ms)
 */
export const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Maximum retry attempts for transient failures
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Default delay between retries (ms)
 */
export const RETRY_DELAY_MS = 1000;

/**
 * Correlation ID header name
 */
export const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Maximum snapshot character limit
 */
export const MAX_SNAPSHOT_CHARS = 50000;

/**
 * Default log level
 */
export const DEFAULT_LOG_LEVEL = "info";

/**
 * Default log format
 */
export const DEFAULT_LOG_FORMAT = "json";
