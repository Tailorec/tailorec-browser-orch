import os from 'node:os';
import path from 'node:path';
import type { ResolvedBrowserProfile } from '../../config/config.types.js';
import type { IBrowserRuntime, RunningBrowserRuntime } from '../../core/ports/browser-runtime.port.js';
import { ChromeLauncherAdapter } from '../chrome/chrome-launcher.adapter.js';

type LocalBrowserRuntimeOptions = {
  headless: boolean;
  noSandbox?: boolean;
  viewport?: { width: number; height: number };
};

export class LocalBrowserRuntimeAdapter implements IBrowserRuntime {
  constructor(
    private chromeLauncher: ChromeLauncherAdapter,
    private options: LocalBrowserRuntimeOptions,
  ) {}

  async isAvailable(
    profile: ResolvedBrowserProfile,
    _running?: RunningBrowserRuntime,
  ): Promise<boolean> {
    return this.chromeLauncher.isReachable(profile.browserEndpoint, 500);
  }

  async ensureBrowser(profile: ResolvedBrowserProfile): Promise<RunningBrowserRuntime> {
    const browserPort = profile.browserPort ?? 9222;
    const userDataDir = path.join(os.tmpdir(), `openclaw-browser-${profile.name}-${browserPort}`);
    const chrome = await this.chromeLauncher.launch({
      cdpPort: browserPort,
      headless: this.options.headless,
      noSandbox: this.options.noSandbox,
      viewport: this.options.viewport,
      userDataDir,
    });

    return {
      provider: 'local',
      pid: chrome.pid,
      userDataDir: chrome.userDataDir,
      browserPort: chrome.cdpPort,
      startedAt: chrome.startedAt,
    };
  }

  async releaseBrowser(
    _profile: ResolvedBrowserProfile,
    running?: RunningBrowserRuntime,
  ): Promise<void> {
    if (running?.browserPort == null) {
      return;
    }

    const active = this.chromeLauncher.getRunning(running.browserPort);
    if (active) {
      await this.chromeLauncher.stop(active);
    }
  }
}
