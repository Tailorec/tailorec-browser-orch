import type { BrowserRequest, BrowserResponse } from "./types.js";
import { createSubsystemLogger } from "../../adapters/logging/pino-logger.adapter.js";
import type { BrowserRouteContext, ProfileContext } from "../server-context.js";

const log = createSubsystemLogger("browser-routes");

export function jsonError(res: BrowserResponse, status: number, messageOrError: unknown) {
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

export function toStringOrEmpty(val: unknown): string {
  if (typeof val === "string") {
    return val.trim();
  }
  return "";
}

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

export function toStringArray(val: unknown): string[] | undefined {
  if (Array.isArray(val)) {
    return val.map((v) => String(v));
  }
  return undefined;
}

export function getProfileContext(
  req: BrowserRequest,
  ctx: BrowserRouteContext,
): ProfileContext | { status: number; error: string } {
  // In OpenClaw, profile is passed in query or defaults to "default"
  // Tailorec will likely use "default" or separate profiles per job/worker
  const profileName = toStringOrEmpty(req.query.profile) || "default";
  try {
    return ctx.forProfile(profileName);
  } catch (err) {
    return { status: 404, error: String(err) };
  }
}
