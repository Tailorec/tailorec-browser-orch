import type { Request, Response, NextFunction } from 'express';
import { getCorrelationIdFromResponse } from './correlation.middleware.js';
import { createSubsystemLogger } from '../../logging/subsystem.js';

const log = createSubsystemLogger('request-logging');

/**
 * Sensitive fields to redact from logs
 */
const sensitiveFields = ['password', 'pwd', 'secret', 'token', 'authorization', 'cookie', 'api_key', 'apikey'];

/**
 * Logging middleware
 * Logs request start and finish with correlation ID
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  const correlationId = getCorrelationIdFromResponse(res);

  log.info('request started', {
    correlation_id: correlationId,
    method: req.method,
    path: req.path,
    query: sanitizeObject(req.query),
    body: sanitizeBody(req.body),
    headers: sanitizeHeaders(req.headers),
  });

  res.on('finish', () => {
    const duration = Date.now() - started;
    log.info('request completed', {
      correlation_id: correlationId,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: duration,
      response_time_bucket: bucketResponseTime(duration),
    });
  });

  res.on('close', () => {
    const duration = Date.now() - started;
    log.debug('request closed', {
      correlation_id: correlationId,
      method: req.method,
      path: req.path,
      duration_ms: duration,
    });
  });

  next();
}

/**
 * Sanitize request body
 * Redacts sensitive fields
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

/**
 * Sanitize query parameters
 * Redacts sensitive fields
 */
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

/**
 * Sanitize headers
 * Redacts sensitive headers
 */
function sanitizeHeaders(headers: any): any {
  if (!headers || typeof headers !== 'object') return headers;

  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(f => lowerKey.includes(f))) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Bucket response time for metrics
 */
function bucketResponseTime(ms: number): string {
  if (ms < 50) return 'fast (<50ms)';
  if (ms < 100) return 'normal (50-100ms)';
  if (ms < 250) return 'slow (100-250ms)';
  if (ms < 500) return 'very_slow (250-500ms)';
  if (ms < 1000) return 'critical (500ms-1s)';
  return 'timeout_risk (>1s)';
}
