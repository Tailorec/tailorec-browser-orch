import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Simple logic to find Chrome
export type BrowserExecutable = {
  path: string;
  kind: "chrome" | "chromium" | "edge" | "brave";
};

export function findChromeExecutableLinux(): BrowserExecutable | null {
  const paths = [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return { path: p, kind: "chrome" };
  }
  return null;
}

export function findChromeExecutableMac(): BrowserExecutable | null {
  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return { path: p, kind: "chrome" };
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
