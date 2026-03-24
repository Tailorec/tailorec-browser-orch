import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('chrome-launcher');

/**
 * Represents a running Chrome instance.
 */
export type RunningChrome = {
  pid: number;
  cdpPort: number;
  process: ChildProcess;
  userDataDir: string;
  startedAt: number;
};

/**
 * Options for launching Chrome.
 */
export type ChromeLaunchOptions = {
  cdpPort: number;
  headless: boolean;
  userDataDir: string;
  viewport?: { width: number; height: number };
  noSandbox?: boolean;
};

/**
 * ChromeLauncherAdapter provides Chrome launching and stopping functionality.
 * 
 * This adapter extracts logic from chrome.ts to provide:
 * - Chrome process spawning
 * - CDP readiness checking
 * - Graceful shutdown
 */
export class ChromeLauncherAdapter {
  private running = new Map<number, RunningChrome>();

  /**
   * Launch a Chrome instance.
   */
  async launch(options: ChromeLaunchOptions): Promise<RunningChrome> {
    const { cdpPort, headless, userDataDir, viewport, noSandbox } = options;

    log.info('launching Chrome', {
      cdpPort,
      headless,
      userDataDir,
      viewport: viewport ? `${viewport.width}x${viewport.height}` : 'default',
    });

    const args = this.buildChromeArgs(options);
    const chromePath = await this.findChromeExecutable();

    const proc = spawn(chromePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: {
        ...globalThis.process.env,
        HOME: os.homedir(),
      },
    });

    proc.stderr?.on('data', (data) => {
      log.debug('chrome stderr', { message: data.toString().trim() });
    });

    const startedAt = Date.now();
    const running: RunningChrome = {
      pid: proc.pid!,
      cdpPort,
      process: proc,
      userDataDir,
      startedAt,
    };

    this.running.set(cdpPort, running);

    // Wait for Chrome to be ready
    const cdpUrl = `http://127.0.0.1:${cdpPort}`;
    await this.waitForChromeReady(cdpUrl);

    log.info('Chrome launched successfully', { pid: process.pid, cdpPort });
    return running;
  }

  /**
   * Stop a running Chrome instance.
   */
  async stop(chrome: RunningChrome, timeoutMs: number = 2500): Promise<void> {
    log.info('stopping Chrome', { pid: chrome.pid, cdpPort: chrome.cdpPort });

    const process = chrome.process;

    if (process.killed) {
      log.debug('Chrome already killed', { pid: chrome.pid });
      return;
    }

    try {
      process.kill('SIGTERM');
    } catch {
      // Ignore kill errors
    }

    // Wait for process to exit
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!process.exitCode && process.killed) {
        break;
      }

      const reachable = await this.isReachable(`http://127.0.0.1:${chrome.cdpPort}`, 200);
      if (!reachable) {
        log.info('Chrome stopped gracefully', { pid: chrome.pid, cdpPort: chrome.cdpPort });
        this.running.delete(chrome.cdpPort);
        return;
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    // Force kill if still running
    try {
      process.kill('SIGKILL');
      log.warn('Chrome force-killed', { pid: chrome.pid, cdpPort: chrome.cdpPort });
    } catch {
      // Ignore
    }

    this.running.delete(chrome.cdpPort);
  }

  /**
   * Check if Chrome CDP is reachable.
   */
  async isReachable(cdpUrl: string, timeoutMs: number = 500): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${cdpUrl}/json/version`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return response.ok;
      } catch {
        clearTimeout(timeout);
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get a running Chrome instance by port.
   */
  getRunning(port: number): RunningChrome | undefined {
    return this.running.get(port);
  }

  /**
   * Get all running Chrome instances.
   */
  getAllRunning(): RunningChrome[] {
    return Array.from(this.running.values());
  }

  private buildChromeArgs(options: ChromeLaunchOptions): string[] {
    const { cdpPort, headless, userDataDir, viewport, noSandbox } = options;

    const args = [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble',
      '--password-store=basic',
      'about:blank',
    ];

    if (headless) {
      args.push('--headless=new');
      args.push('--disable-gpu');
    }

    if (viewport) {
      args.push(`--window-size=${viewport.width},${viewport.height}`);
    }

    if (noSandbox) {
      args.push('--no-sandbox');
      args.push('--disable-setuid-sandbox');
    }

    if (process.platform === 'linux') {
      args.push('--disable-dev-shm-usage');
    }

    return args;
  }

  private async findChromeExecutable(): Promise<string> {
    const platforms: Record<NodeJS.Platform, string> = {
      linux: '/usr/bin/google-chrome',
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      aix: '/usr/bin/google-chrome',
      freebsd: '/usr/bin/google-chrome',
      openbsd: '/usr/bin/google-chrome',
      sunos: '/usr/bin/google-chrome',
      android: '/usr/bin/google-chrome',
      cygwin: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      netbsd: '/usr/bin/google-chrome',
      haiku: '/usr/bin/google-chrome',
    };

    const platform = process.platform;
    const defaultPath = platforms[platform] ?? 'google-chrome';

    // Check if the default path exists
    if (fs.existsSync(defaultPath)) {
      return defaultPath;
    }

    // Try to find Chrome in PATH
    const paths = process.env.PATH?.split(path.delimiter) ?? [];
    const chromeNames = ['google-chrome', 'chrome', 'chromium', 'google-chrome-stable'];

    for (const dir of paths) {
      for (const name of chromeNames) {
        const fullPath = path.join(dir, name);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }

    const playwrightChromium = this.findPlaywrightChromiumLinux();
    if (playwrightChromium) {
      return playwrightChromium;
    }

    return defaultPath;
  }

  private firstExisting(paths: string[]): string | null {
    for (const candidate of paths) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private findPlaywrightChromiumLinux(): string | null {
    if (process.platform !== 'linux') {
      return null;
    }

    const explicitExecutable = process.env.CHROME_EXECUTABLE_PATH?.trim();
    if (explicitExecutable && fs.existsSync(explicitExecutable)) {
      return explicitExecutable;
    }

    const browserRoots = [
      process.env.PLAYWRIGHT_BROWSERS_PATH,
      '/ms-playwright',
      path.join(os.homedir(), '.cache', 'ms-playwright'),
    ].filter((value): value is string => Boolean(value && value.trim()));

    for (const root of browserRoots) {
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        const chromiumDirs = entries
          .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium-'))
          .map((entry) => entry.name)
          .sort()
          .reverse();

        for (const dir of chromiumDirs) {
          const candidate = this.firstExisting([
            path.join(root, dir, 'chrome-linux', 'chrome'),
            path.join(root, dir, 'chrome-linux', 'headless_shell'),
          ]);
          if (candidate) {
            return candidate;
          }
        }
      } catch {
        // Ignore missing or unreadable browser roots.
      }
    }

    return null;
  }

  private async waitForChromeReady(
    cdpUrl: string,
    maxAttempts: number = 30,
    intervalMs: number = 500,
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const reachable = await this.isReachable(cdpUrl, 500);
      if (reachable) {
        return;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(`Chrome failed to start at ${cdpUrl}`);
  }
}
