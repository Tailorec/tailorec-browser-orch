import type { Request, Response, NextFunction } from 'express';
import { correlationMiddleware, getCorrelationId, getCorrelationIdFromResponse } from './correlation.middleware.js';
import { errorMiddleware, AppError, ValidationError, NotFoundError, TimeoutError, ConflictError, ForbiddenError, ServiceUnavailableError } from './error.middleware.js';
import { loggingMiddleware } from './logging.middleware.js';

/**
 * Middleware registry
 * Provides access to all middlewares for route registration
 */
export interface MiddlewareRegistry {
  correlation: (req: Request, res: Response, next: NextFunction) => void;
  logging: (req: Request, res: Response, next: NextFunction) => void;
  error: (err: Error, req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Create middleware registry
 */
export function createMiddlewareRegistry(): MiddlewareRegistry {
  return {
    correlation: correlationMiddleware,
    logging: loggingMiddleware,
    error: errorMiddleware,
  };
}

/**
 * Export all middlewares
 */
export {
  correlationMiddleware,
  errorMiddleware,
  loggingMiddleware,
  getCorrelationId,
  getCorrelationIdFromResponse,
};

/**
 * Export error classes
 */
export {
  AppError,
  ValidationError,
  NotFoundError,
  TimeoutError,
  ConflictError,
  ForbiddenError,
  ServiceUnavailableError,
};
