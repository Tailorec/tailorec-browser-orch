import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Represents a browser executable.
 */
export type BrowserExecutable = {
  path: string;
  kind: 'chrome' | 'chromium' | 'edge' | 'brave';
};

/**
 * ChromeExecutablesAdapter provides browser executable detection functionality.
 * 
 * This adapter extracts logic from chrome.executables.ts to provide:
 * - Platform-specific Chrome/Chromium detection
 * - Executable path resolution
 */
export class ChromeExecutablesAdapter {
  /**
   * Find Chrome executable on Linux.
   */
  findChromeExecutableLinux(): BrowserExecutable | null {
    const paths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        return { path: p, kind: 'chrome' };
      }
    }

    return null;
  }

  /**
   * Find Chrome executable on macOS.
   */
  findChromeExecutableMac(): BrowserExecutable | null {
    const paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        return { path: p, kind: 'chrome' };
      }
    }

    return null;
  }

  /**
   * Find Chrome executable on Windows.
   */
  findChromeExecutableWindows(): BrowserExecutable | null {
    const suffixes = [
      '\\Google\\Chrome\\Application\\chrome.exe',
      '\\Microsoft\\Edge\\Application\\msedge.exe',
    ];

    const prefixes = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)'],
    ].filter(Boolean) as string[];

    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        const p = path.join(prefix, suffix);
        if (fs.existsSync(p)) {
          return { path: p, kind: 'chrome' };
        }
      }
    }

    return null;
  }

  /**
   * Resolve browser executable for the current platform.
   */
  resolveBrowserExecutableForPlatform(platform: string): BrowserExecutable | null {
    if (platform === 'linux') {
      return this.findChromeExecutableLinux();
    }
    if (platform === 'darwin') {
      return this.findChromeExecutableMac();
    }
    if (platform === 'win32') {
      return this.findChromeExecutableWindows();
    }
    return null;
  }

  /**
   * Get the default Chrome executable path for the current platform.
   */
  getDefaultChromePath(): string | null {
    const exe = this.resolveBrowserExecutableForPlatform(process.platform);
    return exe?.path ?? null;
  }

  /**
   * Check if a Chrome executable exists at the given path.
   */
  exists(path: string): boolean {
    try {
      return fs.existsSync(path);
    } catch {
      return false;
    }
  }

  /**
   * Find any Chrome-based browser executable.
   * 
   * Searches for Chrome, Chromium, Edge, or Brave in order.
   */
  findAnyChromeBrowser(): BrowserExecutable | null {
    // Try platform-specific detection first
    const platformExe = this.resolveBrowserExecutableForPlatform(process.platform);
    if (platformExe) {
      return platformExe;
    }

    // Fallback: search common paths
    const commonPaths = [
      // Linux
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      // macOS
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      // Windows
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return { path: p, kind: 'chrome' };
      }
    }

    return null;
  }
}
