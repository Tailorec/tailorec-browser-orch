/**
 * Browser Context for API Routes
 * 
 * Provides context for browser route handlers including profile management
 * and tab lifecycle operations.
 * 
 * Extracted from: src/browser/server-context.ts
 */

import type { Server } from 'node:http';
import type { ResolvedBrowserProfile } from '../../config/config.types.js';
import type { RunningBrowserRuntime } from '../../core/ports/browser-runtime.port.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { redactBrowserEndpoint } from '../../shared/utils/browser-endpoint.utils.js';

const log = createSubsystemLogger('browser-context');

/**
 * Browser server state
 */
export type BrowserServerState = {
  server: Server;
  port: number;
  configuredProfiles: Map<string, ResolvedBrowserProfile>;
  profiles: Map<string, RunningProfile>;
};

/**
 * Running profile runtime state
 */
export type RunningProfile = {
  name: string;
  config: ResolvedBrowserProfile;
  runtime?: RunningBrowserRuntime;
};

/**
 * Profile context for route handlers
 */
export interface ProfileContext {
  profile: ResolvedBrowserProfile;
  ensureTabAvailable(
    targetId?: string,
    options?: { createNewTab?: boolean },
  ): Promise<{ targetId: string; url: string }>;
  stopRunningBrowser(): Promise<void>;
}

/**
 * Browser route context
 */
export interface BrowserRouteContext {
  state(): BrowserServerState;
  forProfile(name: string): ProfileContext;
  mapTabError(err: unknown): { status: number; message: string } | null;
}

/**
 * Check if error is connection refused
 */
function isConnectionRefusedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('ECONNREFUSED') || msg.includes('connectOverCDP');
}

/**
 * Create browser route context
 */
export function createBrowserRouteContext(opts: {
  getState: () => BrowserServerState | null;
  isBrowserAvailable: (
    profile: ResolvedBrowserProfile,
    running?: RunningProfile['runtime'],
  ) => Promise<boolean>;
  ensureBrowser: (profile: ResolvedBrowserProfile) => Promise<RunningProfile['runtime']>;
  releaseBrowser: (
    profile: ResolvedBrowserProfile,
    running?: RunningProfile['runtime'],
  ) => Promise<void>;
  listPages: (browserEndpoint: string) => Promise<Array<{ targetId: string; url: string; title?: string }>>;
  focusPage: (browserEndpoint: string, targetId: string) => Promise<void>;
  createPage: (browserEndpoint: string, url?: string) => Promise<{ targetId: string; url: string }>;
}): BrowserRouteContext {
  const ensureInFlight = new Map<string, Promise<RunningProfile['runtime']>>();

  return {
    state() {
      const s = opts.getState();
      if (!s) throw new Error('Server not started');
      return s;
    },

    forProfile(name: string) {
      const s = opts.getState();
      if (!s) throw new Error('Server not started');

      const resolvedProfile = s.configuredProfiles.get(name);
      if (!resolvedProfile) {
        throw new Error(`Profile ${name} not found`);
      }

      log.debug('profile context created', { profile: name });

      return {
        profile: resolvedProfile,

        async ensureTabAvailable(targetId?: string, options?: { createNewTab?: boolean }) {
          const ensureBrowserRunning = async () => {
            let running = s.profiles.get(name);
            const available = await opts.isBrowserAvailable(resolvedProfile, running?.runtime);

            if (running?.runtime && !available) {
              try {
                await opts.releaseBrowser(resolvedProfile, running.runtime);
              } catch {
                // Ignore stop errors
              }
              running.runtime = undefined;
            }

            if (!running || !running.runtime) {
              let ensurePromise = ensureInFlight.get(name);
              if (!ensurePromise) {
                ensurePromise = opts.ensureBrowser(resolvedProfile).finally(() => {
                  ensureInFlight.delete(name);
                });
                ensureInFlight.set(name, ensurePromise);
              }

              const runtime = await ensurePromise;
              running = { name, config: resolvedProfile, runtime };
              s.profiles.set(name, running);
              log.info('browser available on demand', {
                profile: name,
                provider: resolvedProfile.provider,
                browser_endpoint: redactBrowserEndpoint(resolvedProfile.browserEndpoint),
                browser_port: runtime?.browserPort ?? resolvedProfile.browserPort,
              });
            }
          };

          const getOrCreateTab = async () => {
            const startedAt = Date.now();

            if (targetId) {
              const pages = await opts.listPages(resolvedProfile.browserEndpoint);
              const found = pages.find((p) => p.targetId === targetId);
              if (found) {
                await opts.focusPage(resolvedProfile.browserEndpoint, targetId);
                log.info('target focused', {
                  profile: name,
                  target_id: targetId,
                  url: found.url,
                  duration_ms: Date.now() - startedAt,
                });
                return { targetId, url: found.url };
              }
              throw new Error(`Target ${targetId} not found`);
            }

            if (options?.createNewTab) {
              const result = await opts.createPage(resolvedProfile.browserEndpoint);
              log.info('new tab created', {
                profile: name,
                target_id: result.targetId,
                url: result.url,
                duration_ms: Date.now() - startedAt,
              });
              return result;
            }

            // Reuse an existing tab when no targetId is provided.
            const pages = await opts.listPages(resolvedProfile.browserEndpoint);
            if (pages.length > 0) {
              const first = pages[0];
              await opts.focusPage(resolvedProfile.browserEndpoint, first.targetId);
              log.debug('reusing existing tab', {
                profile: name,
                target_id: first.targetId,
                url: first.url,
                duration_ms: Date.now() - startedAt,
              });
              return { targetId: first.targetId, url: first.url };
            }

            const result = await opts.createPage(resolvedProfile.browserEndpoint);
            log.info('new tab created', {
              profile: name,
              target_id: result.targetId,
              url: result.url,
              duration_ms: Date.now() - startedAt,
            });
            return result;
          };

          try {
            await ensureBrowserRunning();
            return await getOrCreateTab();
          } catch (err) {
            if (isConnectionRefusedError(err)) {
              log.warn('browser connection refused, retrying', {
                profile: name,
                provider: resolvedProfile.provider,
                browser_endpoint: redactBrowserEndpoint(resolvedProfile.browserEndpoint),
              });
              await ensureBrowserRunning();
              return await getOrCreateTab();
            }
            throw err;
          }
        },

        async stopRunningBrowser() {
          ensureInFlight.delete(name);
          const running = s.profiles.get(name);
          if (running?.runtime) {
            try {
              await opts.releaseBrowser(resolvedProfile, running.runtime);
              log.info('browser stopped', {
                profile: name,
                provider: resolvedProfile.provider,
                browser_endpoint: redactBrowserEndpoint(resolvedProfile.browserEndpoint),
                browser_port: running.config.browserPort,
              });
            } catch (err) {
              log.warn('browser stop failed', {
                profile: name,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            running.runtime = undefined;
          }
        },
      };
    },

    mapTabError(err: unknown): { status: number; message: string } | null {
      if (err instanceof Error) {
        const msg = err.message;
        if (msg.includes('tab not found') || msg.includes('Target closed')) {
          return { status: 404, message: 'Tab not found or closed' };
        }
        if (isConnectionRefusedError(err)) {
          return { status: 503, message: 'Browser endpoint unavailable. Retry in a few seconds.' };
        }
        if (
          msg.includes('not found or not visible') ||
          msg.includes('Run a new snapshot to see current page elements')
        ) {
          return {
            status: 409,
            message: 'Reference became stale after page update. Take a new snapshot and retry.',
          };
        }
        if (msg.includes('Timeout') || msg.includes('TimeoutError')) {
          return { status: 408, message: 'Browser action timed out' };
        }
      }
      return null;
    },
  };
}
