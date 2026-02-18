import os from "node:os";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("browser-config");

export interface BrowserConfig {
  enabled: boolean;
  controlPort: number;
  headless: boolean;
  noSandbox?: boolean;
  profiles: Record<string, BrowserProfileConfig>;
  evaluateEnabled: boolean; // Security flag
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

export function loadConfig(): { browser: BrowserConfig } {
  // In a real app, load from file/env.
  // Prefer BROWSER_HEADLESS; keep HEADLESS for backward compatibility.
  const headless = parseBooleanEnv(
    process.env.BROWSER_HEADLESS ?? process.env.HEADLESS,
    DEFAULT_CONFIG.headless,
  );
  const controlPort = Number(process.env.PORT) || 4000;
  const loaded = {
    browser: {
      ...DEFAULT_CONFIG,
      controlPort,
      headless
    }
  };
  log.info("browser config loaded", {
    control_port: loaded.browser.controlPort,
    headless: loaded.browser.headless,
    evaluate_enabled: loaded.browser.evaluateEnabled,
    profile_count: Object.keys(loaded.browser.profiles).length,
  });
  return loaded;
}

export function resolveBrowserConfig(config: BrowserConfig, rootConfig: any): ResolvedBrowserConfig {
  log.debug("browser config resolved", {
    enabled: config.enabled,
    control_port: config.controlPort,
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
