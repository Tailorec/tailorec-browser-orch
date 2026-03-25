import type { RequestHandler, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('express-middleware');

/**
 * Correlation ID options.
 */
export type CorrelationIdOptions = {
  headerName?: string;
  generateFn?: () => string;
};

/**
 * Request logger options.
 */
export type RequestLoggerOptions = {
  logBody?: boolean;
  logQuery?: boolean;
  logHeaders?: boolean;
  skipPaths?: string[];
};

/**
 * Error handler options.
 */
export type ErrorHandlerOptions = {
  includeStack?: boolean;
  customHandler?: (err: Error, req: Request, res: Response) => void;
};

/**
 * Timeout options.
 */
export type TimeoutOptions = {
  timeoutMs: number;
  message?: string;
};

/**
 * Rate limit options.
 */
export type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  message?: string;
};

/**
 * Create a correlation ID middleware.
 * 
 * Generates or extracts a correlation ID from request headers
 * and attaches it to the request for logging purposes.
 */
export function createCorrelationIdMiddleware(options: CorrelationIdOptions = {}): RequestHandler {
  const { headerName = 'x-correlation-id', generateFn = generateCorrelationId } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers[headerName.toLowerCase()] as string | undefined;
    const finalId = correlationId || generateFn();

    // Attach to request for use in handlers
    (req as Request & { correlationId?: string }).correlationId = finalId;

    // Set response header
    res.setHeader(headerName, finalId);

    next();
  };
}

/**
 * Create a request logger middleware.
 */
export function createRequestLoggerMiddleware(options: RequestLoggerOptions = {}): RequestHandler {
  const { logBody = false, logQuery = true, logHeaders = false, skipPaths = [] } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip logging for certain paths
    if (skipPaths.includes(req.path)) {
      return next();
    }

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData: Record<string, unknown> = {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: duration,
      };

      if (logQuery && req.query && Object.keys(req.query).length > 0) {
        logData.query = req.query;
      }

      if (logBody && req.body && typeof req.body === 'object') {
        logData.body = req.body;
      }

      if (logHeaders) {
        logData.headers = req.headers;
      }

      if (res.statusCode >= 500) {
        log.error('request failed', logData);
      } else if (res.statusCode >= 400) {
        log.warn('request client error', logData);
      } else {
        log.info('request completed', logData);
      }
    });

    next();
  };
}

/**
 * Create an error handler middleware.
 */
export function createErrorHandlerMiddleware(options: ErrorHandlerOptions = {}): ErrorRequestHandler {
  const { includeStack = false, customHandler } = options;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (customHandler) {
      customHandler(err, req, res);
      return;
    }

    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    const errorResponse: Record<string, unknown> = {
      error: err.message || 'Internal server error',
      status: statusCode,
    };

    if (includeStack && err.stack) {
      errorResponse.stack = err.stack;
    }

    log.exception('request error', err, {
      method: req.method,
      path: req.path,
      status_code: statusCode,
    });

    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Create a timeout middleware.
 */
export function createTimeoutMiddleware(options: TimeoutOptions): RequestHandler {
  const { timeoutMs, message = 'Request timeout' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: message });
      }
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
}

/**
 * Create a simple rate limiter middleware (in-memory).
 */
export function createRateLimiterMiddleware(options: RateLimitOptions): RequestHandler {
  const { windowMs, maxRequests, message = 'Too many requests' } = options;
  const requests = new Map<string, { count: number; resetTime: number }>();

  // Cleanup old entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < now) {
        requests.delete(key);
      }
    }
  }, windowMs);

  // Prevent cleanup from keeping process alive
  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = requests.get(ip);

    if (!record || record.resetTime < now) {
      record = { count: 1, resetTime: now + windowMs };
      requests.set(ip, record);
      next();
      return;
    }

    record.count += 1;

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

/**
 * Create a static file serving middleware.
 */
export function createStaticMiddleware(rootPath: string, options?: {
  index?: string;
  maxAge?: number;
}): RequestHandler {
  // Express static is used internally
  const express = require('express');
  return express.static(rootPath, {
    index: options?.index ?? 'index.html',
    maxAge: options?.maxAge ?? 0,
  });
}

/**
 * Create a body parser middleware for URL-encoded data.
 */
export function createUrlEncodedMiddleware(options?: {
  extended?: boolean;
  limit?: string;
}): RequestHandler {
  const express = require('express');
  return express.urlencoded({
    extended: options?.extended ?? true,
    limit: options?.limit ?? '1mb',
  });
}

/**
 * Create a JSON body parser middleware.
 */
export function createJsonParserMiddleware(options?: {
  limit?: string;
}): RequestHandler {
  const express = require('express');
  return express.json({
    limit: options?.limit ?? '50mb',
  });
}

/**
 * Generate a correlation ID.
 */
function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}`;
}

/**
 * Validate request body against a schema.
 */
export function createBodyValidatorMiddleware(
  schema: { [key: string]: (value: unknown) => boolean },
  options?: { strict?: boolean },
): RequestHandler {
  const { strict = false } = options ?? {};

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    const errors: string[] = [];

    for (const [field, validator] of Object.entries(schema)) {
      const value = (req.body as Record<string, unknown>)[field];

      if (strict && value === undefined) {
        errors.push(`Missing required field: ${field}`);
        continue;
      }

      if (value !== undefined && !validator(value)) {
        errors.push(`Invalid value for field: ${field}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    next();
  };
}

/**
 * Create a health check middleware.
 */
export function createHealthCheckMiddleware(options?: {
  path?: string;
  checks?: Array<() => Promise<boolean>>;
}): RequestHandler {
  const { path = '/health', checks = [] } = options ?? {};

  // This returns a handler that should be registered at the health path
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path !== path) {
      next();
      return;
    }

    Promise.all(checks.map((check) => check().catch(() => false)))
      .then((results) => {
        const allHealthy = results.every((r) => r);
        if (allHealthy) {
          res.json({ status: 'healthy' });
        } else {
          res.status(503).json({ status: 'unhealthy' });
        }
      })
      .catch(() => {
        res.status(503).json({ status: 'unhealthy' });
      });
  };
}
