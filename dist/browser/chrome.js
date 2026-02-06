"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOpenClawUserDataDir = resolveOpenClawUserDataDir;
exports.isChromeReachable = isChromeReachable;
exports.getChromeWebSocketUrl = getChromeWebSocketUrl;
exports.launchOpenClawChrome = launchOpenClawChrome;
exports.stopOpenClawChrome = stopOpenClawChrome;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const ports_js_1 = require("../infra/ports.js");
const utils_js_1 = require("../utils.js");
const cdp_helpers_js_1 = require("./cdp.helpers.js");
const chrome_executables_js_1 = require("./chrome.executables.js");
const chrome_profile_decoration_js_1 = require("./chrome.profile-decoration.js");
const constants_js_1 = require("./constants.js");
function exists(filePath) {
    try {
        return node_fs_1.default.existsSync(filePath);
    }
    catch {
        return false;
    }
}
function resolveBrowserExecutable(resolved) {
    return (0, chrome_executables_js_1.resolveBrowserExecutableForPlatform)(resolved, process.platform);
}
function resolveOpenClawUserDataDir(profileName = constants_js_1.DEFAULT_OPENCLAW_BROWSER_PROFILE_NAME) {
    return node_path_1.default.join(utils_js_1.CONFIG_DIR, "browser", profileName, "user-data");
}
function cdpUrlForPort(cdpPort) {
    return `http://127.0.0.1:${cdpPort}`;
}
async function isChromeReachable(cdpUrl, timeoutMs = 500) {
    const version = await fetchChromeVersion(cdpUrl, timeoutMs);
    return Boolean(version);
}
async function fetchChromeVersion(cdpUrl, timeoutMs = 500) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const versionUrl = (0, cdp_helpers_js_1.appendCdpPath)(cdpUrl, "/json/version");
        const res = await fetch(versionUrl, {
            signal: ctrl.signal,
            headers: (0, cdp_helpers_js_1.getHeadersWithAuth)(versionUrl),
        });
        if (!res.ok) {
            return null;
        }
        const data = (await res.json());
        if (!data || typeof data !== "object") {
            return null;
        }
        return data;
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(t);
    }
}
async function getChromeWebSocketUrl(cdpUrl, timeoutMs = 500) {
    const version = await fetchChromeVersion(cdpUrl, timeoutMs);
    const wsUrl = String(version?.webSocketDebuggerUrl ?? "").trim();
    if (!wsUrl) {
        return null;
    }
    return wsUrl; // In OpenClaw this used normalizeCdpWsUrl but we can probably trust it for now or implement full normalization if needed
}
async function launchOpenClawChrome(resolved, profile) {
    if (!profile.cdpIsLoopback) {
        throw new Error(`Profile "${profile.name}" is remote; cannot launch local Chrome.`);
    }
    await (0, ports_js_1.ensurePortAvailable)(profile.cdpPort);
    const exe = resolveBrowserExecutable(resolved);
    if (!exe) {
        throw new Error("No supported browser found (Chrome/Brave/Edge/Chromium on macOS, Linux, or Windows).");
    }
    const userDataDir = resolveOpenClawUserDataDir(profile.name);
    node_fs_1.default.mkdirSync(userDataDir, { recursive: true });
    const needsDecorate = !(0, chrome_profile_decoration_js_1.isProfileDecorated)(userDataDir, profile.name, (profile.color ?? constants_js_1.DEFAULT_OPENCLAW_BROWSER_COLOR).toUpperCase());
    // First launch to create preference files if missing, then decorate and relaunch.
    const spawnOnce = () => {
        const args = [
            `--remote-debugging-port=${profile.cdpPort}`,
            `--user-data-dir=${userDataDir}`,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-sync",
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-features=Translate,MediaRouter",
            "--disable-session-crashed-bubble",
            "--hide-crash-restore-bubble",
            "--password-store=basic",
        ];
        if (resolved.headless) {
            // Best-effort; older Chromes may ignore.
            args.push("--headless=new");
            args.push("--disable-gpu");
        }
        if (resolved.noSandbox) {
            args.push("--no-sandbox");
            args.push("--disable-setuid-sandbox");
        }
        if (process.platform === "linux") {
            args.push("--disable-dev-shm-usage");
        }
        // Always open a blank tab to ensure a target exists.
        args.push("about:blank");
        return (0, node_child_process_1.spawn)(exe.path, args, {
            stdio: "pipe",
            env: {
                ...process.env,
                // Reduce accidental sharing with the user's env.
                HOME: node_os_1.default.homedir(),
            },
        });
    };
    const startedAt = Date.now();
    const localStatePath = node_path_1.default.join(userDataDir, "Local State");
    const preferencesPath = node_path_1.default.join(userDataDir, "Default", "Preferences");
    const needsBootstrap = !exists(localStatePath) || !exists(preferencesPath);
    // If the profile doesn't exist yet, bootstrap it once so Chrome creates defaults.
    // Then decorate (if needed) before the "real" run.
    if (needsBootstrap) {
        const bootstrap = spawnOnce();
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
            if (exists(localStatePath) && exists(preferencesPath)) {
                break;
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        try {
            bootstrap.kill("SIGTERM");
        }
        catch {
            // ignore
        }
        const exitDeadline = Date.now() + 5000;
        while (Date.now() < exitDeadline) {
            if (bootstrap.exitCode != null) {
                break;
            }
            await new Promise((r) => setTimeout(r, 50));
        }
    }
    if (needsDecorate) {
        try {
            (0, chrome_profile_decoration_js_1.decorateOpenClawProfile)(userDataDir, {
                name: profile.name,
                color: profile.color,
            });
        }
        catch (err) {
            // ignore log
        }
    }
    try {
        (0, chrome_profile_decoration_js_1.ensureProfileCleanExit)(userDataDir);
    }
    catch (err) {
        // ignore log
    }
    const proc = spawnOnce();
    // Wait for CDP to come up.
    const readyDeadline = Date.now() + 15_000;
    while (Date.now() < readyDeadline) {
        if (await isChromeReachable(profile.cdpUrl, 500)) {
            break;
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    if (!(await isChromeReachable(profile.cdpUrl, 500))) {
        try {
            proc.kill("SIGKILL");
        }
        catch {
            // ignore
        }
        throw new Error(`Failed to start Chrome CDP on port ${profile.cdpPort} for profile "${profile.name}".`);
    }
    const pid = proc.pid ?? -1;
    return {
        pid,
        exe,
        userDataDir,
        cdpPort: profile.cdpPort,
        startedAt,
        proc,
    };
}
async function stopOpenClawChrome(running, timeoutMs = 2500) {
    const proc = running.proc;
    if (proc.killed) {
        return;
    }
    try {
        proc.kill("SIGTERM");
    }
    catch {
        // ignore
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (!proc.exitCode && proc.killed) {
            break;
        }
        if (!(await isChromeReachable(cdpUrlForPort(running.cdpPort), 200))) {
            return;
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    try {
        proc.kill("SIGKILL");
    }
    catch {
        // ignore
    }
}
