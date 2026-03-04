import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithCorrelationId, extractCorrelationIdFromHeaders, generateCorrelationId } from '../../logging/correlation.js';
import { createSubsystemLogger } from '../../logging/subsystem.js';

const log = createSubsystemLogger('correlation-middleware');

const CORRELATION_HEADER = process.env.CORRELATION_ID_HEADER ?? 'x-correlation-id';

/**
 * Correlation ID middleware
 * Extracts or generates correlation ID and sets it on response headers
 * Also stores it in async context for logging
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get correlation ID from headers
  let correlationId = extractCorrelationIdFromHeaders(req.headers);

  // Generate if not provided
  if (!correlationId) {
    correlationId = generateCorrelationId();
    log.debug('generated new correlation ID', { correlation_id: correlationId });
  } else {
    log.debug('using provided correlation ID', { correlation_id: correlationId });
  }

  // Set on response
  res.setHeader(CORRELATION_HEADER, correlationId);

  // Store in async context for logging
  runWithCorrelationId(correlationId, () => {
    next();
  });
}

/**
 * Get correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  const correlationId = req.headers[CORRELATION_HEADER.toLowerCase()] as string | undefined;
  return correlationId || 'unknown';
}

/**
 * Get correlation ID from response headers
 */
export function getCorrelationIdFromResponse(res: Response): string {
  return res.getHeader(CORRELATION_HEADER) as string || 'unknown';
}
