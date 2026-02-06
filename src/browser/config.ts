import os from "node:os";
import path from "node:path";

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

export function loadConfig(): { browser: BrowserConfig } {
  // In a real app, load from file/env.
  const headless = process.env.HEADLESS === "true";
  const controlPort = Number(process.env.PORT) || 4000;
  
  return {
    browser: {
      ...DEFAULT_CONFIG,
      controlPort,
      headless
    }
  };
}

export function resolveBrowserConfig(config: BrowserConfig, rootConfig: any): ResolvedBrowserConfig {
  return config;
}

export function resolveProfile(config: ResolvedBrowserConfig, name: string): ResolvedBrowserProfile | null {
  const profile = config.profiles[name];
  if (!profile) return null;
  
  const cdpPort = profile.cdpPort || 9222;
  const cdpUrl = profile.cdpUrl || `http://127.0.0.1:${cdpPort}`;
  
  return {
    name,
    cdpPort,
    cdpUrl,
    cdpIsLoopback: cdpUrl.includes("127.0.0.1") || cdpUrl.includes("localhost"),
    driver: profile.driver || "chrome",
    color: profile.color || "blue"
  };
}
