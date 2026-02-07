"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubsystemLogger = createSubsystemLogger;
exports.getOrCreateCorrelationIdFromHeaders = getOrCreateCorrelationIdFromHeaders;
exports.withCorrelationId = withCorrelationId;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const correlation_js_1 = require("./correlation.js");
const levelWeights = {
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
    queue = [];
    flushing = false;
    maxSize = 10000;
    push(line) {
        if (this.queue.length >= this.maxSize) {
            this.queue.shift();
        }
        this.queue.push(line);
        this.scheduleFlush();
    }
    scheduleFlush() {
        if (this.flushing) {
            return;
        }
        this.flushing = true;
        setImmediate(() => this.flush());
    }
    flush() {
        try {
            while (this.queue.length) {
                const line = this.queue.shift();
                if (line) {
                    process.stdout.write(line);
                }
            }
        }
        finally {
            this.flushing = false;
            if (this.queue.length) {
                this.scheduleFlush();
            }
        }
    }
}
const queue = new AsyncLogQueue();
const currentLevel = parseLevel(process.env.LOG_LEVEL);
const format = process.env.LOG_FORMAT === "console" ? "console" : "json";
const logToFile = process.env.LOG_TO_FILE === "true";
const logFilePath = process.env.LOG_FILE_PATH || "logs/app.log";
const logMaxBytes = Number(process.env.LOG_MAX_BYTES || 10 * 1024 * 1024);
const logBackupCount = Number(process.env.LOG_BACKUP_COUNT || 5);
let initialized = false;
function parseLevel(levelRaw) {
    const value = (levelRaw || "info").toLowerCase();
    if (value === "debug" || value === "info" || value === "warn" || value === "error") {
        return value;
    }
    return "info";
}
function shouldLog(level) {
    return levelWeights[level] >= levelWeights[currentLevel];
}
function redactValue(value) {
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
        const result = {};
        for (const [k, v] of Object.entries(value)) {
            const lower = k.toLowerCase();
            const sensitiveKey = sensitiveKeyPatterns.some((pattern) => lower.includes(pattern));
            result[k] = sensitiveKey ? redactedValue : redactValue(v);
        }
        return result;
    }
    return value;
}
function getCallerLocation() {
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
function formatConsole(record) {
    const location = record.module && record.line_number ? `${record.module}:${record.line_number}` : record.logger;
    const correlation = record.correlation_id ? ` [cid=${record.correlation_id}]` : "";
    return `${record.timestamp} ${record.level.toUpperCase()} ${location}${correlation} ${record.message}\n`;
}
function rotateIfNeeded(filePath) {
    if (!node_fs_1.default.existsSync(filePath)) {
        return;
    }
    const stats = node_fs_1.default.statSync(filePath);
    if (stats.size < logMaxBytes) {
        return;
    }
    for (let i = logBackupCount - 1; i >= 1; i -= 1) {
        const src = `${filePath}.${i}`;
        const dest = `${filePath}.${i + 1}`;
        if (node_fs_1.default.existsSync(src)) {
            node_fs_1.default.renameSync(src, dest);
        }
    }
    node_fs_1.default.renameSync(filePath, `${filePath}.1`);
}
function writeToFile(line) {
    if (!logToFile) {
        return;
    }
    const dir = node_path_1.default.dirname(logFilePath);
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    rotateIfNeeded(logFilePath);
    node_fs_1.default.appendFileSync(logFilePath, line, { encoding: "utf8" });
}
function emit(record) {
    const output = format === "console" ? formatConsole(record) : `${JSON.stringify(record)}\n`;
    queue.push(output);
    if (logToFile) {
        try {
            writeToFile(`${JSON.stringify(record)}\n`);
        }
        catch {
            // swallow file write failures to avoid breaking service execution
        }
    }
}
function setupLogging() {
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
function toErrorDetails(err) {
    if (err instanceof Error) {
        return {
            error_name: err.name,
            error_message: err.message,
            stack: err.stack,
        };
    }
    return { error: String(err) };
}
function createSubsystemLogger(name) {
    setupLogging();
    const logInternal = (level, message, extra) => {
        if (!shouldLog(level)) {
            return;
        }
        const correlationId = (0, correlation_js_1.getCorrelationId)();
        const location = getCallerLocation();
        const record = {
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
            Object.assign(record, redactValue(extra));
        }
        emit(record);
    };
    return {
        debug: (message, extra) => logInternal("debug", message, extra),
        info: (message, extra) => logInternal("info", message, extra),
        warn: (message, extra) => logInternal("warn", message, extra),
        error: (message, extra) => logInternal("error", message, extra),
        exception: (message, err, extra) => logInternal("error", message, { ...toErrorDetails(err), ...(extra || {}) }),
    };
}
function getOrCreateCorrelationIdFromHeaders(headers) {
    const fromHeader = (0, correlation_js_1.extractCorrelationIdFromHeaders)(headers);
    return fromHeader || (0, correlation_js_1.generateCorrelationId)();
}
function withCorrelationId(correlationId, fn) {
    return (0, correlation_js_1.runWithCorrelationId)(correlationId, fn);
}
