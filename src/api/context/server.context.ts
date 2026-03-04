/**
 * Server Context
 *
 * Browser server context for route handlers.
 * Migrated from src/browser/server-context.ts
 */

import type { ResolvedBrowserProfile } from "../config/config.types.js";
import { createSubsystemLogger } from "../logging/pino-logger.adapter.js";

const log = createSubsystemLogger("server-context");

/**
 * Browser server state
 */
export interface BrowserServerState {
  server: any;
  port: number;
  resolved: {
    enabled: boolean;
    controlPort: number;
    headless: boolean;
    evaluateEnabled: boolean;
    viewport: { width: number; height: number };
    profiles: Record<string, { name: string; cdpPort: number; cdpUrl: string; driver: string; color: string }>;
  };
  profiles: Map<string, any>;
}

/**
 * Profile context
 */
export interface ProfileContext {
  profile: ResolvedBrowserProfile;
  ensureTabAvailable(targetId?: string): Promise<{ targetId: string; url: string }>;
  stopRunningBrowser(): Promise<void>;
}

/**
 * Browser route context
 */
export interface BrowserRouteContext {
  state(): BrowserServerState;
  forProfile(name: string): ProfileContext;
  mapTabError(err: unknown): { status: number; message: string } | null;
}

/**
 * Options for creating browser route context
 */
export interface BrowserRouteContextOptions {
  getState: () => BrowserServerState | null;
}

/**
 * Check if error is connection refused
 */
function isConnectionRefusedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("ECONNREFUSED") || msg.includes("connectOverCDP");
}

/**
 * Check if error is timeout
 */
function isTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Timeout") || msg.includes("TimeoutError");
}

/**
 * Check if error is stale element reference
 */
function isStaleElementError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("not found or not visible") || msg.includes("Run a new snapshot");
}

/**
 * Create browser route context
 */
export function createBrowserRouteContext(opts: BrowserRouteContextOptions): BrowserRouteContext {
  return {
    state() {
      const s = opts.getState();
      if (!s) throw new Error("Server not started");
      return s;
    },

    forProfile(name: string) {
      const s = opts.getState();
      if (!s) throw new Error("Server not started");

      const resolvedProfile = s.resolved.profiles[name];
      if (!resolvedProfile) throw new Error(`Profile ${name} not found`);
      log.debug("profile context created", { profile: name });

      return {
        profile: {
          name,
          cdpPort: resolvedProfile.cdpPort || 9222,
          cdpUrl: resolvedProfile.cdpUrl || `http://127.0.0.1:${resolvedProfile.cdpPort || 9222}`,
          cdpIsLoopback: true,
          driver: (resolvedProfile.driver || "chrome") as "chrome" | "extension",
          color: resolvedProfile.color || "blue",
        },
        async ensureTabAvailable(targetId?: string) {
          // Simplified implementation for testing
          return {
            targetId: targetId || `target-${Date.now()}`,
            url: "about:blank",
          };
        },
        async stopRunningBrowser() {
          // Simplified implementation for testing
          const running = s.profiles.get(name);
          if (running) {
            s.profiles.delete(name);
          }
        },
      };
    },

    mapTabError(err: unknown): { status: number; message: string } | null {
      const msg = err instanceof Error ? err.message : String(err);

      // Tab not found or closed
      if (msg.includes("tab not found") || msg.includes("Target closed")) {
        return {
          status: 404,
          message: "Tab not found or closed",
        };
      }

      // Browser CDP unavailable
      if (isConnectionRefusedError(err)) {
        return {
          status: 503,
          message: "Browser CDP unavailable. Retry in a few seconds.",
        };
      }

      // Stale element reference
      if (isStaleElementError(err)) {
        return {
          status: 409,
          message: "Reference became stale after page update. Take a new snapshot and retry.",
        };
      }

      // Timeout
      if (isTimeoutError(err)) {
        return {
          status: 408,
          message: "Browser action timed out",
        };
      }

      // Unmapped error
      return null;
    },
  };
}
