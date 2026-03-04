import type { Request, Response, NextFunction } from 'express';
import { getCorrelationIdFromResponse } from './correlation.middleware.js';
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('error-middleware');

/**
 * Error types mapped to HTTP status codes
 */
const errorStatusMap: Record<string, number> = {
  // Validation errors
  ValidationError: 400,
  SnapshotValidationError: 400,
  ActionValidationError: 400,
  
  // Not found errors
  NotFoundError: 404,
  TabNotFoundError: 404,
  ProfileNotFoundError: 404,
  
  // Timeout errors
  TimeoutError: 408,
  Timeout: 408,
  
  // Conflict errors
  ConflictError: 409,
  
  // Forbidden errors
  ForbiddenError: 403,
  
  // Service unavailable
  ServiceUnavailableError: 503,
  
  // Internal errors
  InternalError: 500,
  BrowserError: 500,
};

/**
 * Error middleware
 * Handles all errors and returns consistent error responses
 */
export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = getCorrelationIdFromResponse(res);

  log.exception('request failed', err, {
    correlation_id: correlationId,
    path: req.path,
    method: req.method,
  });

  // Map error to HTTP status
  const status = mapErrorToStatus(err);
  const message = mapErrorToMessage(err, status);

  res.status(status).json({
    ok: false,
    error: {
      type: err.name,
      message,
      correlation_id: correlationId,
    },
  });
}

/**
 * Map error to HTTP status code
 */
function mapErrorToStatus(err: Error): number {
  // Check direct match
  if (err.name in errorStatusMap) {
    return errorStatusMap[err.name];
  }

  // Check if error message contains known patterns
  const message = err.message.toLowerCase();
  
  if (message.includes('validation')) return 400;
  if (message.includes('not found')) return 404;
  if (message.includes('timeout')) return 408;
  if (message.includes('conflict')) return 409;
  if (message.includes('forbidden') || message.includes('disabled')) return 403;
  if (message.includes('unavailable')) return 503;
  
  // Default to 500
  return 500;
}

/**
 * Map error to message
 * Don't expose internal errors in production
 */
function mapErrorToMessage(err: Error, status: number): string {
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production') {
    if (status >= 500) {
      return 'An internal error occurred';
    }
  }
  
  return err.message;
}

/**
 * Custom error classes for common scenarios
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = 'Request timed out') {
    super(message, 408, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}
