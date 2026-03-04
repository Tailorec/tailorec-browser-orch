import os from "node:os";
import path from "node:path";
import { createSubsystemLogger } from "../adapters/logging/pino-logger.adapter.js";

const log = createSubsystemLogger("browser-config");

export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserConfig {
  enabled: boolean;
  controlPort: number;
  headless: boolean;
  noSandbox?: boolean;
  profiles: Record<string, BrowserProfileConfig>;
  evaluateEnabled: boolean; // Security flag
  viewport: BrowserViewport;
}

export interface BrowserProfileConfig {
  cdpPort?: number;
  cdpUrl?: string;
  driver?: "chrome" | "extension"; // Only support chrome for now
  color?: string;
}

export interface ResolvedBrowserConfig extends BrowserConfig {
  // Same structure for now
}

export interface ResolvedBrowserProfile {
  name: string;
  cdpPort: number;
  cdpUrl: string;
  cdpIsLoopback: boolean;
  driver: "chrome" | "extension";
  color: string;
}

const DEFAULT_CONFIG: BrowserConfig = {
  enabled: true,
  controlPort: 4000,
  headless: false, // Default to visible for debugging, can override via env
  evaluateEnabled: true,
  viewport: { width: 1280, height: 720 },
  profiles: {
    default: {
      cdpPort: 9222,
      driver: "chrome",
      color: "blue"
    }
  }
};

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseViewportEnv(value: string | undefined, fallback: BrowserViewport): BrowserViewport {
  if (!value) {
    return fallback;
  }

  const match = value.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return fallback;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return fallback;
  }

  return {
    width: Math.floor(width),
    height: Math.floor(height),
  };
}

export function getConfiguredViewport(): BrowserViewport {
  return parseViewportEnv(process.env.BROWSER_VIEWPORT, DEFAULT_CONFIG.viewport);
}

export function loadConfig(): { browser: BrowserConfig } {
  // In a real app, load from file/env.
  // Prefer BROWSER_HEADLESS; keep HEADLESS for backward compatibility.
  const headless = parseBooleanEnv(
    process.env.BROWSER_HEADLESS ?? process.env.HEADLESS,
    DEFAULT_CONFIG.headless,
  );
  const controlPort = Number(process.env.PORT) || 4000;
  const viewport = getConfiguredViewport();
  const loaded = {
    browser: {
      ...DEFAULT_CONFIG,
      controlPort,
      headless,
      viewport,
    }
  };
  log.info("browser config loaded", {
    control_port: loaded.browser.controlPort,
    headless: loaded.browser.headless,
    evaluate_enabled: loaded.browser.evaluateEnabled,
    viewport: `${loaded.browser.viewport.width}x${loaded.browser.viewport.height}`,
    profile_count: Object.keys(loaded.browser.profiles).length,
  });
  return loaded;
}

export function resolveBrowserConfig(config: BrowserConfig, rootConfig: any): ResolvedBrowserConfig {
  log.debug("browser config resolved", {
    enabled: config.enabled,
    control_port: config.controlPort,
    viewport: `${config.viewport.width}x${config.viewport.height}`,
    profile_count: Object.keys(config.profiles).length,
  });
  return config;
}

export function resolveProfile(config: ResolvedBrowserConfig, name: string): ResolvedBrowserProfile | null {
  const profile = config.profiles[name];
  if (!profile) {
    log.warn("profile resolution failed", { profile: name });
    return null;
  }
  
  const cdpPort = profile.cdpPort || 9222;
  const cdpUrl = profile.cdpUrl || `http://127.0.0.1:${cdpPort}`;
  
  const resolved = {
    name,
    cdpPort,
    cdpUrl,
    cdpIsLoopback: cdpUrl.includes("127.0.0.1") || cdpUrl.includes("localhost"),
    driver: profile.driver || "chrome",
    color: profile.color || "blue"
  };
  log.debug("profile resolved", {
    profile: name,
    cdp_url: resolved.cdpUrl,
    cdp_port: resolved.cdpPort,
    cdp_is_loopback: resolved.cdpIsLoopback,
    driver: resolved.driver,
  });
  return resolved;
}
