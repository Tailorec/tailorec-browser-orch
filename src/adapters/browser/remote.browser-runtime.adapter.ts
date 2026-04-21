import type { ResolvedBrowserProfile } from '../../config/config.types.js';
import type { IBrowserRuntime, RunningBrowserRuntime } from '../../core/ports/browser-runtime.port.js';

export class RemoteBrowserRuntimeAdapter implements IBrowserRuntime {
  async isAvailable(
    _profile: ResolvedBrowserProfile,
    _running?: RunningBrowserRuntime,
  ): Promise<boolean> {
    return true;
  }

  async ensureBrowser(profile: ResolvedBrowserProfile): Promise<RunningBrowserRuntime> {
    return {
      provider: profile.provider,
      startedAt: Date.now(),
    };
  }

  async releaseBrowser(
    _profile: ResolvedBrowserProfile,
    _running?: RunningBrowserRuntime,
  ): Promise<void> {
    // Remote providers are not launched locally.
  }
}
