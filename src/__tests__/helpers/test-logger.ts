/**
 * Test Logger Helper
 * 
 * Provides mock logger implementations for testing.
 */

/**
 * Mock logger interface for tests
 */
export interface TestLogger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  exception: (message: string, error: unknown, ...args: any[]) => void;
}

/**
 * Create a mock logger for testing
 * All methods are no-ops by default but can be spied on with vitest
 */
export function createTestLogger(): TestLogger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    exception: () => {},
  };
}

/**
 * Create a logger that logs to console (useful for debugging tests)
 */
export function createConsoleTestLogger(): TestLogger {
  return {
    debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args),
    info: (message, ...args) => console.info(`[INFO] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
    exception: (message, error, ...args) => {
      console.error(`[EXCEPTION] ${message}`, error, ...args);
    },
  };
}

/**
 * Create a logger that collects all messages for assertion
 */
export function createCollectingTestLogger() {
  const messages: Array<{
    level: string;
    message: string;
    args: any[];
    timestamp: Date;
  }> = [];

  const logger: TestLogger = {
    debug: (message, ...args) => {
      messages.push({ level: 'debug', message, args, timestamp: new Date() });
    },
    info: (message, ...args) => {
      messages.push({ level: 'info', message, args, timestamp: new Date() });
    },
    warn: (message, ...args) => {
      messages.push({ level: 'warn', message, args, timestamp: new Date() });
    },
    error: (message, ...args) => {
      messages.push({ level: 'error', message, args, timestamp: new Date() });
    },
    exception: (message, error, ...args) => {
      messages.push({ level: 'exception', message: `${message} ${error}`, args, timestamp: new Date() });
    },
  };

  return {
    logger,
    messages,
    getMessages(level?: string) {
      if (level) {
        return messages.filter(m => m.level === level);
      }
      return messages;
    },
    clear() {
      messages.length = 0;
    },
  };
}
