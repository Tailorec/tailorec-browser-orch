"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.resolveBrowserConfig = resolveBrowserConfig;
exports.resolveProfile = resolveProfile;
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
    return {
        browser: {
            ...DEFAULT_CONFIG,
            controlPort,
            headless
        }
    };
}
function resolveBrowserConfig(config, rootConfig) {
    return config;
}
function resolveProfile(config, name) {
    const profile = config.profiles[name];
    if (!profile)
        return null;
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
