import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Simple logic to find Chrome
export type BrowserExecutable = {
  path: string;
  kind: "chrome" | "chromium" | "edge" | "brave";
};

function firstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findPlaywrightChromiumLinux(): BrowserExecutable | null {
  const explicitExecutable = process.env.CHROME_EXECUTABLE_PATH?.trim();
  if (explicitExecutable && fs.existsSync(explicitExecutable)) {
    return { path: explicitExecutable, kind: "chromium" };
  }

  const browserRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    "/ms-playwright",
    path.join(os.homedir(), ".cache", "ms-playwright"),
  ].filter((value): value is string => Boolean(value && value.trim()));

  for (const root of browserRoots) {
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      const chromiumDirs = entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"))
        .map((entry) => entry.name)
        .sort()
        .reverse();

      for (const dir of chromiumDirs) {
        const candidate = firstExisting([
          path.join(root, dir, "chrome-linux", "chrome"),
          path.join(root, dir, "chrome-linux", "headless_shell"),
        ]);
        if (candidate) {
          return { path: candidate, kind: "chromium" };
        }
      }
    } catch {
      // ignore missing or unreadable roots
    }
  }

  return null;
}

export function findChromeExecutableLinux(): BrowserExecutable | null {
  const paths = [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
  const systemBrowser = firstExisting(paths);
  if (systemBrowser) {
    return { path: systemBrowser, kind: "chrome" };
  }
  return findPlaywrightChromiumLinux();
}

export function findChromeExecutableMac(): BrowserExecutable | null {
  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  const browser = firstExisting(paths);
  if (browser) {
    return { path: browser, kind: "chrome" };
  }
  return null;
}

export function findChromeExecutableWindows(): BrowserExecutable | null {
  const suffixes = [
    "\\Google\\Chrome\\Application\\chrome.exe",
    "\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const prefixes = [
    process.env.LOCALAPPDATA,
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
  ].filter(Boolean) as string[];

  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      const p = path.join(prefix, suffix);
      if (fs.existsSync(p)) return { path: p, kind: "chrome" };
    }
  }
  return null;
}

export function resolveBrowserExecutableForPlatform(
  config: any,
  platform: string
): BrowserExecutable | null {
  if (platform === "linux") return findChromeExecutableLinux();
  if (platform === "darwin") return findChromeExecutableMac();
  if (platform === "win32") return findChromeExecutableWindows();
  return null;
}
