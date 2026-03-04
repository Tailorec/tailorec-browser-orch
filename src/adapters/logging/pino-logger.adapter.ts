import pino from 'pino';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Log level type.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log format type.
 */
export type LogFormat = 'json' | 'console';

/**
 * Logger interface for subsystem loggers.
 */
export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  exception(message: string, err: unknown, extra?: Record<string, unknown>): void;
}

/**
 * Logger configuration.
 */
export type LoggerConfig = {
  level?: LogLevel;
  format?: LogFormat;
  logToFile?: boolean;
  logFilePath?: string;
  logMaxBytes?: number;
  logBackupCount?: number;
  correlationId?: string | (() => string | undefined);
};

/**
 * Redaction patterns for sensitive data.
 */
const sensitiveKeyPatterns = [
  'password',
  'pwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'api_key',
  'apikey',
  'ssn',
  'social',
  'card',
];

const sensitivePatterns = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
];

const redactedValue = '***REDACTED***';

/**
 * Async log queue for non-blocking logging.
 */
class AsyncLogQueue {
  private queue: string[] = [];
  private flushing = false;
  private readonly maxSize = 10000;

  public push(line: string): void {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }
    this.queue.push(line);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    setImmediate(() => this.flush());
  }

  private flush(): void {
    try {
      while (this.queue.length) {
        const line = this.queue.shift();
        if (line) {
          process.stdout.write(line);
        }
      }
    } finally {
      this.flushing = false;
      if (this.queue.length) {
        this.scheduleFlush();
      }
    }
  }
}

/**
 * Global logger state.
 */
let pinoLogger: pino.Logger | null = null;
let config: LoggerConfig | null = null;
let initialized = false;
const queue = new AsyncLogQueue();

/**
 * Redact sensitive values in an object.
 */
function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let redacted = value;
    for (const pattern of sensitivePatterns) {
      redacted = redacted.replace(pattern, redactedValue);
    }
    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      const sensitiveKey = sensitiveKeyPatterns.some((pattern) => lower.includes(pattern));
      result[k] = sensitiveKey ? redactedValue : redactValue(v);
    }
    return result;
  }

  return value;
}

/**
 * Rotate log file if needed.
 */
function rotateIfNeeded(filePath: string, maxBytes: number, backupCount: number): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const stats = fs.statSync(filePath);
  if (stats.size < maxBytes) {
    return;
  }

  for (let i = backupCount - 1; i >= 1; i -= 1) {
    const src = `${filePath}.${i}`;
    const dest = `${filePath}.${i + 1}`;
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
    }
  }

  fs.renameSync(filePath, `${filePath}.1`);
}

/**
 * Write a log line to file.
 */
function writeToFile(filePath: string, line: string, maxBytes: number, backupCount: number): void {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    rotateIfNeeded(filePath, maxBytes, backupCount);
    fs.appendFileSync(filePath, line, { encoding: 'utf8' });
  } catch {
    // Swallow file write errors to avoid breaking service execution
  }
}

/**
 * Get caller location for enhanced logging.
 */
function getCallerLocation(): { module?: string; function?: string; line_number?: number } {
  const stack = new Error().stack?.split('\n') || [];
  const line = stack.find((entry) => entry.includes('/src/') || entry.includes('\\src\\'));

  if (!line) {
    return {};
  }

  const fnMatch = line.match(/at\s+(.+?)\s+\(/);
  const fileMatch = line.match(/(?:\/|\\)([^/\\]+)\.(ts|js):(\d+):\d+\)?$/);

  return {
    function: fnMatch?.[1],
    module: fileMatch?.[1],
    line_number: fileMatch?.[3] ? Number(fileMatch[3]) : undefined,
  };
}

/**
 * Initialize the logger.
 */
function initializeLogger(cfg: LoggerConfig = {}): void {
  if (initialized) {
    return;
  }

  initialized = true;
  config = cfg;

  const level = cfg.level ?? 'info';
  const format = cfg.format ?? 'json';
  const logToFile = cfg.logToFile ?? false;
  const logFilePath = cfg.logFilePath ?? 'logs/app.log';
  const logMaxBytes = cfg.logMaxBytes ?? 10 * 1024 * 1024;
  const logBackupCount = cfg.logBackupCount ?? 5;

  // Create Pino logger
  const pinoOptions: pino.LoggerOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: () => ({}),
    },
  };

  if (format === 'console') {
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    };
  }

  pinoLogger = pino(pinoOptions);

  // Log initialization
  const initLogger = createSubsystemLogger('logging');
  initLogger.info('logging initialized', {
    log_level: level,
    log_format: format,
    log_to_file: logToFile,
    log_file_path: logFilePath,
  });
}

/**
 * Convert error to details object.
 */
function toErrorDetails(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      error_name: err.name,
      error_message: err.message,
      stack: err.stack,
    };
  }
  return { error: String(err) };
}

/**
 * Get correlation ID from config (internal use).
 */
function getInternalCorrelationId(): string | undefined {
  if (!config) {
    return undefined;
  }

  if (typeof config.correlationId === 'function') {
    return config.correlationId();
  }

  return config.correlationId;
}

/**
 * Create a subsystem logger.
 */
export function createSubsystemLogger(name: string): Logger {
  if (!initialized) {
    initializeLogger();
  }

  const logInternal = (
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>,
  ): void => {
    if (!pinoLogger) {
      return;
    }

    const correlationId = getInternalCorrelationId();
    const location = getCallerLocation();

    const logRecord: Record<string, unknown> = {
      logger: name,
      message: String(redactValue(message)),
      ...location,
    };

    // Add redacted extra fields
    const redactedExtra = redactValue(extra ?? {}) as Record<string, unknown>;
    Object.assign(logRecord, redactedExtra);

    if (correlationId) {
      logRecord.correlation_id = correlationId;
    }

    const loggerWithContext = pinoLogger.child({ logger: name });

    switch (level) {
      case 'debug':
        loggerWithContext.debug(logRecord);
        break;
      case 'info':
        loggerWithContext.info(logRecord);
        break;
      case 'warn':
        loggerWithContext.warn(logRecord);
        break;
      case 'error':
        loggerWithContext.error(logRecord);
        break;
    }
  };

  return {
    debug: (message, extra) => logInternal('debug', message, extra),
    info: (message, extra) => logInternal('info', message, extra),
    warn: (message, extra) => logInternal('warn', message, extra),
    error: (message, extra) => logInternal('error', message, extra),
    exception: (message, err, extra) =>
      logInternal('error', message, { ...toErrorDetails(err), ...(extra ?? {}) }),
  };
}

/**
 * Initialize logging with custom configuration.
 */
export function initializeLogging(cfg: LoggerConfig): void {
  initializeLogger(cfg);
}

/**
 * Get or create a correlation ID from headers.
 */
export function getOrCreateCorrelationIdFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string {
  const headerName = (process.env.CORRELATION_ID_HEADER || 'x-correlation-id').toLowerCase();
  const headerValue = headers[headerName];

  if (headerValue) {
    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }

  return generateCorrelationId();
}

/**
 * Generate a new correlation ID.
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}`;
}

/**
 * Run a function with a correlation ID.
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  const originalConfig = config;
  try {
    config = { ...originalConfig, correlationId };
    return fn();
  } finally {
    config = originalConfig;
  }
}

/**
 * Get the current correlation ID.
 */
export function getCorrelationId(): string | undefined {
  return config?.correlationId
    ? typeof config.correlationId === 'function'
      ? config.correlationId()
      : config.correlationId
    : undefined;
}

/**
 * Flush all pending logs.
 */
export async function flushLogs(): Promise<void> {
  return new Promise((resolve) => {
    if (pinoLogger) {
      pinoLogger.flush();
    }
    setImmediate(resolve);
  });
}

/**
 * Shutdown the logger gracefully.
 */
export async function shutdownLogger(): Promise<void> {
  await flushLogs();
  initialized = false;
  pinoLogger = null;
  config = null;
}

/**
 * Type alias for backward compatibility
 */
export type SubsystemLogger = Logger;
