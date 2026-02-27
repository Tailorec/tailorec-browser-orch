import { afterEach, describe, expect, it } from "vitest";
import {
  getConfiguredViewport,
  loadConfig,
  resolveProfile,
} from "../../browser/config.js";

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
});

describe("browser config", () => {
  it("loads defaults and env overrides", () => {
    process.env.PORT = "4555";
    process.env.BROWSER_HEADLESS = "true";
    process.env.BROWSER_VIEWPORT = "1440x900";

    const cfg = loadConfig();
    expect(cfg.browser.controlPort).toBe(4555);
    expect(cfg.browser.headless).toBe(true);
    expect(cfg.browser.viewport).toEqual({ width: 1440, height: 900 });
  });

  it("falls back to defaults for invalid viewport", () => {
    process.env.BROWSER_VIEWPORT = "not-a-size";
    expect(getConfiguredViewport()).toEqual({ width: 1280, height: 720 });
  });

  it("resolves profile and returns null for unknown profile", () => {
    const cfg = loadConfig().browser;
    const resolved = resolveProfile(cfg, "default");
    expect(resolved?.cdpUrl).toContain("127.0.0.1");
    expect(resolveProfile(cfg, "missing")).toBeNull();
  });
});
