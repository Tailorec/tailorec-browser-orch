import type { ResolvedBrowserProfile } from '../../config/config.types.js';

export type RunningBrowserRuntime = {
  provider: ResolvedBrowserProfile['provider'];
  startedAt: number;
  pid?: number;
  userDataDir?: string;
  browserPort?: number;
};

/**
 * Browser runtime lifecycle abstraction.
 *
 * This boundary owns browser availability and release semantics for each
 * provider while keeping page automation concerns in the browser driver.
 */
export interface IBrowserRuntime {
  isAvailable(
    profile: ResolvedBrowserProfile,
    running?: RunningBrowserRuntime,
  ): Promise<boolean>;

  ensureBrowser(profile: ResolvedBrowserProfile): Promise<RunningBrowserRuntime>;

  releaseBrowser(
    profile: ResolvedBrowserProfile,
    running?: RunningBrowserRuntime,
  ): Promise<void>;
}
