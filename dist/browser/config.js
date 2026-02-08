"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.resolveBrowserConfig = resolveBrowserConfig;
exports.resolveProfile = resolveProfile;
const subsystem_js_1 = require("../logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("browser-config");
const DEFAULT_CONFIG = {
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
function loadConfig() {
    // In a real app, load from file/env.
    const headless = process.env.HEADLESS === "true";
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
function resolveBrowserConfig(config, rootConfig) {
    log.debug("browser config resolved", {
        enabled: config.enabled,
        control_port: config.controlPort,
        profile_count: Object.keys(config.profiles).length,
    });
    return config;
}
function resolveProfile(config, name) {
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
