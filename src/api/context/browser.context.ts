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
import { createSubsystemLogger } from '../../adapters/logging/pino-logger.adapter.js';

const log = createSubsystemLogger('browser-context');

/**
 * Browser server state
 */
export type BrowserServerState = {
  server: Server;
  port: number;
  profiles: Map<string, RunningProfile>;
};

/**
 * Running profile with Chrome instance
 */
export type RunningProfile = {
  name: string;
  config: ResolvedBrowserProfile;
  chrome?: {
    pid: number;
    userDataDir: string;
    cdpPort: number;
    startedAt: number;
  };
};

/**
 * Profile context for route handlers
 */
export interface ProfileContext {
  profile: ResolvedBrowserProfile;
  ensureTabAvailable(targetId?: string): Promise<{ targetId: string; url: string }>;
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
  isChromeReachable: (cdpUrl: string, timeoutMs?: number) => Promise<boolean>;
  launchChrome: (profile: ResolvedBrowserProfile) => Promise<RunningProfile['chrome']>;
  stopChrome: (chrome: RunningProfile['chrome']) => Promise<void>;
  listPages: (cdpUrl: string) => Promise<Array<{ targetId: string; url: string; title?: string }>>;
  focusPage: (cdpUrl: string, targetId: string) => Promise<void>;
  createPage: (cdpUrl: string, url?: string) => Promise<{ targetId: string; url: string }>;
}): BrowserRouteContext {
  return {
    state() {
      const s = opts.getState();
      if (!s) throw new Error('Server not started');
      return s;
    },

    forProfile(name: string) {
      const s = opts.getState();
      if (!s) throw new Error('Server not started');

      const resolvedProfile = s.profiles.get(name)?.config;
      if (!resolvedProfile) {
        throw new Error(`Profile ${name} not found`);
      }

      log.debug('profile context created', { profile: name });

      return {
        profile: resolvedProfile,

        async ensureTabAvailable(targetId?: string) {
          const ensureBrowserRunning = async () => {
            let running = s.profiles.get(name);
            const reachable = await opts.isChromeReachable(resolvedProfile.cdpUrl, 500);

            if (running?.chrome && !reachable) {
              try {
                await opts.stopChrome(running.chrome);
              } catch {
                // Ignore stop errors
              }
              running.chrome = undefined;
            }

            if (!running || !running.chrome) {
              const chrome = await opts.launchChrome(resolvedProfile);
              running = { name, config: resolvedProfile, chrome };
              s.profiles.set(name, running);
              log.info('browser launched on demand', {
                profile: name,
                cdp_url: resolvedProfile.cdpUrl,
                cdp_port: resolvedProfile.cdpPort,
              });
            }
          };

          const getOrCreateTab = async () => {
            const startedAt = Date.now();

            if (targetId) {
              const pages = await opts.listPages(resolvedProfile.cdpUrl);
              const found = pages.find((p) => p.targetId === targetId);
              if (found) {
                await opts.focusPage(resolvedProfile.cdpUrl, targetId);
                log.info('target focused', {
                  profile: name,
                  target_id: targetId,
                  url: found.url,
                  duration_ms: Date.now() - startedAt,
                });
                return { targetId, url: found.url };
              }
            }

            // Create new tab
            const result = await opts.createPage(resolvedProfile.cdpUrl);
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
                cdp_url: resolvedProfile.cdpUrl,
              });
              await ensureBrowserRunning();
              return await getOrCreateTab();
            }
            throw err;
          }
        },

        async stopRunningBrowser() {
          const running = s.profiles.get(name);
          if (running?.chrome) {
            try {
              await opts.stopChrome(running.chrome);
              log.info('browser stopped', {
                profile: name,
                cdp_port: running.config.cdpPort,
              });
            } catch (err) {
              log.warn('browser stop failed', {
                profile: name,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            running.chrome = undefined;
          }
        },
      };
    },

    mapTabError(err: unknown): { status: number; message: string } | null {
      if (err instanceof Error) {
        const msg = err.message;
        if (msg.includes('Target closed') || msg.includes('Target page is closed')) {
          return { status: 404, message: 'Target page not found or closed' };
        }
        if (msg.includes('connectOverCDP') || msg.includes('ECONNREFUSED')) {
          return { status: 503, message: 'Browser not available' };
        }
        if (msg.includes('Navigation failed')) {
          return { status: 500, message: 'Navigation failed' };
        }
        if (msg.includes('Protocol error')) {
          return { status: 500, message: 'Browser protocol error' };
        }
      }
      return null;
    },
  };
}
