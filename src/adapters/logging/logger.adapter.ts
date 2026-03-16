import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  extractCorrelationIdFromHeaders,
  generateCorrelationId,
  getCorrelationId,
  runWithCorrelationId,
} from '../../shared/utils/correlation.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFormat = 'json' | 'console';

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  exception(message: string, err: unknown, extra?: Record<string, unknown>): void;
}

export type LoggerConfig = {
  level?: LogLevel;
  format?: LogFormat;
  logToFile?: boolean;
  logFilePath?: string;
  logMaxBytes?: number;
  logBackupCount?: number;
};

type LogRecord = {
  timestamp: string;
  level: LogLevel;
  logger: string;
  message: string;
  correlation_id?: string;
  module?: string;
  function?: string;
  line_number?: number;
  [key: string]: unknown;
};

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

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
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
];

const redactedValue = '***REDACTED***';

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

const queue = new AsyncLogQueue();

let initialized = false;
let activeConfig: Required<LoggerConfig> = {
  level: 'info',
  format: 'json',
  logToFile: false,
  logFilePath: 'logs/app.log',
  logMaxBytes: 10 * 1024 * 1024,
  logBackupCount: 5,
};

function parseLevel(raw: string | undefined): LogLevel {
  switch ((raw ?? '').toLowerCase()) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      return raw!.toLowerCase() as LogLevel;
    default:
      return 'info';
  }
}

function parseFormat(raw: string | undefined): LogFormat {
  return raw === 'console' ? 'console' : 'json';
}

function initializeLogger(cfg: LoggerConfig = {}): void {
  const nextConfig: Required<LoggerConfig> = {
    level: cfg.level ?? (initialized ? activeConfig.level : parseLevel(process.env.LOG_LEVEL)),
    format: cfg.format ?? (initialized ? activeConfig.format : parseFormat(process.env.LOG_FORMAT)),
    logToFile: cfg.logToFile ?? (initialized ? activeConfig.logToFile : process.env.LOG_TO_FILE === 'true'),
    logFilePath: cfg.logFilePath ?? (initialized ? activeConfig.logFilePath : process.env.LOG_FILE_PATH || 'logs/app.log'),
    logMaxBytes: cfg.logMaxBytes ?? (
      initialized ? activeConfig.logMaxBytes : Number(process.env.LOG_MAX_BYTES || 10 * 1024 * 1024)
    ),
    logBackupCount: cfg.logBackupCount ?? (
      initialized ? activeConfig.logBackupCount : Number(process.env.LOG_BACKUP_COUNT || 5)
    ),
  };

  activeConfig = nextConfig;

  if (initialized) {
    return;
  }

  initialized = true;
  emit({
    timestamp: new Date().toISOString(),
    level: 'info',
    logger: 'logging',
    message: 'logging initialized',
    log_level: activeConfig.level,
    log_format: activeConfig.format,
    log_to_file: activeConfig.logToFile,
    log_file_path: activeConfig.logFilePath,
  });
}

function shouldLog(level: LogLevel): boolean {
  if (!initialized) {
    initializeLogger();
  }

  return levelWeights[level] >= levelWeights[activeConfig.level];
}

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
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      const sensitiveKey = sensitiveKeyPatterns.some((pattern) => lower.includes(pattern));
      result[key] = sensitiveKey ? redactedValue : redactValue(nestedValue);
    }
    return result;
  }

  return value;
}

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

function formatConsole(record: LogRecord): string {
  const location = record.module && record.line_number
    ? `${record.module}:${record.line_number}`
    : record.logger;
  const correlation = record.correlation_id ? ` [cid=${record.correlation_id}]` : '';
  return `${record.timestamp} ${record.level.toUpperCase()} ${location}${correlation} ${record.message}\n`;
}

function rotateIfNeeded(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const stats = fs.statSync(filePath);
  if (stats.size < activeConfig.logMaxBytes) {
    return;
  }

  for (let i = activeConfig.logBackupCount - 1; i >= 1; i -= 1) {
    const src = `${filePath}.${i}`;
    const dest = `${filePath}.${i + 1}`;
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
    }
  }

  fs.renameSync(filePath, `${filePath}.1`);
}

function writeToFile(line: string): void {
  try {
    const dir = path.dirname(activeConfig.logFilePath);
    fs.mkdirSync(dir, { recursive: true });
    rotateIfNeeded(activeConfig.logFilePath);
    fs.appendFileSync(activeConfig.logFilePath, line, { encoding: 'utf8' });
  } catch {
    // Swallow file write errors to avoid breaking service execution.
  }
}

function emit(record: LogRecord): void {
  const jsonLine = `${JSON.stringify(record)}\n`;
  const output = activeConfig.format === 'console' ? formatConsole(record) : jsonLine;
  queue.push(output);

  if (activeConfig.logToFile) {
    writeToFile(jsonLine);
  }
}

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

export function createSubsystemLogger(name: string): Logger {
  if (!initialized) {
    initializeLogger();
  }

  const logInternal = (
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>,
  ): void => {
    if (!shouldLog(level)) {
      return;
    }

    const correlationId = getCorrelationId();
    const location = getCallerLocation();
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      logger: name,
      message: String(redactValue(message)),
      ...location,
    };

    if (correlationId) {
      record.correlation_id = correlationId;
    }

    if (extra) {
      Object.assign(record, redactValue(extra) as Record<string, unknown>);
    }

    emit(record);
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

export function initializeLogging(cfg: LoggerConfig): void {
  initializeLogger(cfg);
}

export function getOrCreateCorrelationIdFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string {
  return extractCorrelationIdFromHeaders(headers) || generateCorrelationId();
}

export async function flushLogs(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export async function shutdownLogger(): Promise<void> {
  await flushLogs();
  initialized = false;
}

export type SubsystemLogger = Logger;

export { generateCorrelationId, getCorrelationId, runWithCorrelationId };
export { runWithCorrelationId as withCorrelationId };
