import fs from "node:fs";
import path from "node:path";
import { extractCorrelationIdFromHeaders, generateCorrelationId, getCorrelationId, runWithCorrelationId } from "./correlation.js";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFormat = "json" | "console";

interface LogRecord {
  timestamp: string;
  level: LogLevel;
  logger: string;
  message: string;
  correlation_id?: string;
  module?: string;
  function?: string;
  line_number?: number;
  [key: string]: unknown;
}

interface SubsystemLogger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  exception(message: string, err: unknown, extra?: Record<string, unknown>): void;
}

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const redactedValue = "***REDACTED***";
const sensitivePatterns = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
];
const sensitiveKeyPatterns = ["password", "pwd", "secret", "token", "authorization", "cookie", "api_key", "apikey", "ssn", "social", "card"];

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
const currentLevel = parseLevel(process.env.LOG_LEVEL);
const format: LogFormat = process.env.LOG_FORMAT === "console" ? "console" : "json";
const logToFile = process.env.LOG_TO_FILE === "true";
const logFilePath = process.env.LOG_FILE_PATH || "logs/app.log";
const logMaxBytes = Number(process.env.LOG_MAX_BYTES || 10 * 1024 * 1024);
const logBackupCount = Number(process.env.LOG_BACKUP_COUNT || 5);
let initialized = false;

function parseLevel(levelRaw: string | undefined): LogLevel {
  const value = (levelRaw || "info").toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return levelWeights[level] >= levelWeights[currentLevel];
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    let redacted = value;
    for (const pattern of sensitivePatterns) {
      redacted = redacted.replace(pattern, redactedValue);
    }
    return redacted;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
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

function getCallerLocation(): { module?: string; function?: string; line_number?: number } {
  const stack = new Error().stack?.split("\n") || [];
  const line = stack.find((entry) => entry.includes("/src/") || entry.includes("\\src\\"));
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
  const location = record.module && record.line_number ? `${record.module}:${record.line_number}` : record.logger;
  const correlation = record.correlation_id ? ` [cid=${record.correlation_id}]` : "";
  return `${record.timestamp} ${record.level.toUpperCase()} ${location}${correlation} ${record.message}\n`;
}

function rotateIfNeeded(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const stats = fs.statSync(filePath);
  if (stats.size < logMaxBytes) {
    return;
  }
  for (let i = logBackupCount - 1; i >= 1; i -= 1) {
    const src = `${filePath}.${i}`;
    const dest = `${filePath}.${i + 1}`;
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
    }
  }
  fs.renameSync(filePath, `${filePath}.1`);
}

function writeToFile(line: string): void {
  if (!logToFile) {
    return;
  }
  const dir = path.dirname(logFilePath);
  fs.mkdirSync(dir, { recursive: true });
  rotateIfNeeded(logFilePath);
  fs.appendFileSync(logFilePath, line, { encoding: "utf8" });
}

function emit(record: LogRecord): void {
  const output = format === "console" ? formatConsole(record) : `${JSON.stringify(record)}\n`;
  queue.push(output);
  if (logToFile) {
    try {
      writeToFile(`${JSON.stringify(record)}\n`);
    } catch {
      // swallow file write failures to avoid breaking service execution
    }
  }
}

function setupLogging(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  const logger = createSubsystemLogger("logging");
  logger.info("logging initialized", {
    log_level: currentLevel,
    log_format: format,
    log_to_file: logToFile,
    log_file_path: logFilePath,
  });
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

export function createSubsystemLogger(name: string): SubsystemLogger {
  setupLogging();

  const logInternal = (level: LogLevel, message: string, extra?: Record<string, unknown>): void => {
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
    debug: (message, extra) => logInternal("debug", message, extra),
    info: (message, extra) => logInternal("info", message, extra),
    warn: (message, extra) => logInternal("warn", message, extra),
    error: (message, extra) => logInternal("error", message, extra),
    exception: (message, err, extra) =>
      logInternal("error", message, { ...toErrorDetails(err), ...(extra || {}) }),
  };
}

export function getOrCreateCorrelationIdFromHeaders(headers: Record<string, string | string[] | undefined>): string {
  const fromHeader = extractCorrelationIdFromHeaders(headers);
  return fromHeader || generateCorrelationId();
}

export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return runWithCorrelationId(correlationId, fn);
}
