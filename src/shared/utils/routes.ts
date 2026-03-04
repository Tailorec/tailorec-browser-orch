/**
 * Route Utilities
 *
 * Helper functions for HTTP route handlers.
 * Migrated from src/browser/routes/utils.ts
 */

import type { Request, Response } from "express";
import { createSubsystemLogger } from "../logging/pino-logger.adapter.js";

const log = createSubsystemLogger("routes");

/**
 * Express request type
 */
export type ExpressRequest = Request;

/**
 * Express response type
 */
export type ExpressResponse = Response;

/**
 * Send JSON error response
 */
export function jsonError(res: ExpressResponse, status: number, messageOrError: unknown): void {
  const message =
    messageOrError instanceof Error
      ? messageOrError.message
      : typeof messageOrError === "string"
        ? messageOrError
        : String(messageOrError);

  if (status >= 500) {
    log.error(`HTTP ${status}: ${message}`);
  } else {
    log.warn(`HTTP ${status}: ${message}`);
  }

  res.status(status).json({ ok: false, error: message });
}

/**
 * Convert value to trimmed string, or empty string if not a string
 */
export function toStringOrEmpty(val: unknown): string {
  if (typeof val === "string") {
    return val.trim();
  }
  return "";
}

/**
 * Convert value to boolean, or undefined if not convertible
 */
export function toBoolean(val: unknown): boolean | undefined {
  if (typeof val === "boolean") {
    return val;
  }
  if (val === "true" || val === "1" || val === 1) {
    return true;
  }
  if (val === "false" || val === "0" || val === 0) {
    return false;
  }
  return undefined;
}

/**
 * Convert value to number, or undefined if not convertible
 */
export function toNumber(val: unknown): number | undefined {
  if (typeof val === "number") {
    return val;
  }
  if (typeof val === "string") {
    const n = Number(val);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

/**
 * Convert array to string array, or undefined if not an array
 */
export function toStringArray(val: unknown): string[] | undefined {
  if (Array.isArray(val)) {
    return val.map((v) => String(v));
  }
  return undefined;
}
