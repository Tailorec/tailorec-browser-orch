/**
 * Correlation ID Utilities
 *
 * Async context management for correlation IDs.
 * Migrated from src/logging/correlation.ts
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingHttpHeaders } from "node:http";
import { randomUUID } from "node:crypto";

const store = new AsyncLocalStorage<{ correlationId?: string }>();
const correlationHeaderName = (process.env.CORRELATION_ID_HEADER || "x-correlation-id").toLowerCase();

/**
 * Get current correlation ID from async context
 */
export function getCorrelationId(): string | undefined {
  return store.getStore()?.correlationId;
}

/**
 * Run function with correlation ID in async context
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return store.run({ correlationId }, fn);
}

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Extract correlation ID from HTTP headers
 */
export function extractCorrelationIdFromHeaders(
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>,
): string | undefined {
  const direct = headers[correlationHeaderName];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  if (Array.isArray(direct) && direct.length && direct[0]?.trim()) {
    return direct[0].trim();
  }
  for (const key of ["x-correlation-id", "x-request-id", "x-trace-id"]) {
    const val = headers[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
    if (Array.isArray(val) && val.length && val[0]?.trim()) {
      return val[0].trim();
    }
  }
  return undefined;
}

/**
 * Get or create correlation ID from headers
 */
export function getOrCreateCorrelationIdFromHeaders(
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>,
): string {
  return extractCorrelationIdFromHeaders(headers) || generateCorrelationId();
}
