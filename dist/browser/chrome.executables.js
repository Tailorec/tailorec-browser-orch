"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findChromeExecutableLinux = findChromeExecutableLinux;
exports.findChromeExecutableMac = findChromeExecutableMac;
exports.findChromeExecutableWindows = findChromeExecutableWindows;
exports.resolveBrowserExecutableForPlatform = resolveBrowserExecutableForPlatform;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function findChromeExecutableLinux() {
    const paths = [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
    ];
    for (const p of paths) {
        if (node_fs_1.default.existsSync(p))
            return { path: p, kind: "chrome" };
    }
    return null;
}
function findChromeExecutableMac() {
    const paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    for (const p of paths) {
        if (node_fs_1.default.existsSync(p))
            return { path: p, kind: "chrome" };
    }
    return null;
}
function findChromeExecutableWindows() {
    const suffixes = [
        "\\Google\\Chrome\\Application\\chrome.exe",
        "\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    const prefixes = [
        process.env.LOCALAPPDATA,
        process.env.PROGRAMFILES,
        process.env["PROGRAMFILES(X86)"],
    ].filter(Boolean);
    for (const prefix of prefixes) {
        for (const suffix of suffixes) {
            const p = node_path_1.default.join(prefix, suffix);
            if (node_fs_1.default.existsSync(p))
                return { path: p, kind: "chrome" };
        }
    }
    return null;
}
function resolveBrowserExecutableForPlatform(config, platform) {
    if (platform === "linux")
        return findChromeExecutableLinux();
    if (platform === "darwin")
        return findChromeExecutableMac();
    if (platform === "win32")
        return findChromeExecutableWindows();
    return null;
}
