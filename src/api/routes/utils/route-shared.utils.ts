/**
 * Route Shared Utilities
 * 
 * Common utilities for API route handlers.
 * Extracted from: src/browser/routes/agent.shared.ts and utils.ts
 */

import type { BrowserRouteContext } from '../../context/browser.context.js';

/**
 * Error response for JSON APIs
 */
export function jsonError(message: string, status: number = 500): { error: string; status: number } {
  return { error: message, status };
}

/**
 * Handle route errors with proper mapping
 */
export function handleRouteError(
  ctx: BrowserRouteContext,
  err: unknown,
  defaultMessage: string = 'Operation failed',
): { status: number; message: string } {
  // Try to map tab-specific errors
  const mapped = ctx.mapTabError(err);
  if (mapped) {
    return mapped;
  }

  // Handle common error types
  if (err instanceof Error) {
    const msg = err.message;

    if (msg.includes('not found') || msg.includes('Target not found')) {
      return { status: 404, message: 'Resource not found' };
    }

    if (msg.includes('unauthorized') || msg.includes('authentication')) {
      return { status: 401, message: 'Authentication required' };
    }

    if (msg.includes('forbidden') || msg.includes('not allowed')) {
      return { status: 403, message: 'Operation not allowed' };
    }

    if (msg.includes('timeout') || msg.includes('timed out')) {
      return { status: 504, message: 'Operation timed out' };
    }

    if (msg.includes('connection') || msg.includes('network')) {
      return { status: 503, message: 'Service unavailable' };
    }
  }

  return { status: 500, message: defaultMessage };
}

/**
 * Read and parse request body
 */
export async function readBody<T>(request: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
    request.on('error', reject);
  });
}

/**
 * Resolve profile context from request
 */
export function resolveProfileContext(
  ctx: BrowserRouteContext,
  profileName?: string,
): { profileCtx: any; error?: { status: number; message: string } } {
  try {
    const name = profileName || 'default';
    const profileCtx = ctx.forProfile(name);
    return { profileCtx };
  } catch (err) {
    const error = handleRouteError(ctx, err, 'Profile not available');
    return { profileCtx: null, error };
  }
}

/**
 * Type conversion utilities
 */
export function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function toString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function toStringOrEmpty(value: unknown): string {
  return toString(value, '');
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim());
  }
  return [];
}

/**
 * Common error messages
 */
export const SELECTOR_UNSUPPORTED_MESSAGE =
  'CSS selectors are not supported. Use role-based refs (e.g., e1, e2) from snapshots.';
