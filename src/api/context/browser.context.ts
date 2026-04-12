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
  runSessions: Map<string, RunOwnedSession>;
  targetOwners: Map<string, string>;
};

/**
 * Running profile runtime state
 */
export type RunningProfile = {
  name: string;
  config: ResolvedBrowserProfile;
  runtime?: RunningBrowserRuntime;
};

export type RunOwnedSession = {
  runId: string;
  profileName: string;
  activeTargetId?: string;
};

/**
 * Profile context for route handlers
 */
export interface ProfileContext {
  profile: ResolvedBrowserProfile;
  ensureTabAvailable(
    runId: string,
    targetId?: string,
    options?: { createNewTab?: boolean; useCurrentTab?: boolean },
  ): Promise<{ targetId: string; url: string }>;
  closeRunSession(runId: string, targetId?: string): Promise<{ targetId?: string; closed: boolean }>;
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

function statusError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
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

        async ensureTabAvailable(runId: string, targetId?: string, options?: { createNewTab?: boolean; useCurrentTab?: boolean }) {
          const normalizedRunId = runId.trim();
          if (!normalizedRunId) {
            throw statusError(400, 'run_id is required');
          }

          const stopRunningBrowser = async () => {
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
          };

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
            const runSession = s.runSessions.get(normalizedRunId);
            if (runSession && runSession.profileName !== name) {
              throw statusError(409, 'run_id is already bound to a different profile');
            }
            const session = runSession ?? { runId: normalizedRunId, profileName: name };
            const setActiveTarget = (activeTargetId: string) => {
              session.activeTargetId = activeTargetId;
              s.runSessions.set(normalizedRunId, session);
              s.targetOwners.set(activeTargetId, normalizedRunId);
            };
            const clearOwnedTarget = () => {
              if (session.activeTargetId) {
                s.targetOwners.delete(session.activeTargetId);
                session.activeTargetId = undefined;
                s.runSessions.set(normalizedRunId, session);
              }
            };

            if (targetId) {
              const owner = s.targetOwners.get(targetId);
              if (owner && owner !== normalizedRunId) {
                throw statusError(409, `Target ${targetId} is owned by another run`);
              }
              const pages = await opts.listPages(resolvedProfile.browserEndpoint);
              const found = pages.find((p) => p.targetId === targetId);
              if (found) {
                await opts.focusPage(resolvedProfile.browserEndpoint, targetId);
                setActiveTarget(targetId);
                log.info('target focused', {
                  profile: name,
                  target_id: targetId,
                  url: found.url,
                  duration_ms: Date.now() - startedAt,
                });
                return { targetId, url: found.url };
              }
              throw statusError(404, `Target ${targetId} not found`);
            }

            const maybeFocusRunActiveTarget = async () => {
              const activeTargetId = session.activeTargetId;
              if (!activeTargetId) {
                return null;
              }
              const pages = await opts.listPages(resolvedProfile.browserEndpoint);
              const current = pages.find((p) => p.targetId === activeTargetId);
              if (!current) {
                clearOwnedTarget();
                return null;
              }
              await opts.focusPage(resolvedProfile.browserEndpoint, current.targetId);
              setActiveTarget(current.targetId);
              log.info('run current target focused', {
                profile: name,
                run_id: normalizedRunId,
                target_id: current.targetId,
                url: current.url,
                duration_ms: Date.now() - startedAt,
              });
              return { targetId: current.targetId, url: current.url };
            };

            if (!options?.createNewTab) {
              const current = await maybeFocusRunActiveTarget();
              if (current) {
                return current;
              }
              throw statusError(400, 'targetId is required. Call navigate first to create a browser session.');
            }

            // For navigate without targetId, prefer the run-owned active target if available.
            const current = await maybeFocusRunActiveTarget();
            if (current) {
              return current;
            }

            await stopRunningBrowser();
            await ensureBrowserRunning();

            const result = await opts.createPage(resolvedProfile.browserEndpoint);
            setActiveTarget(result.targetId);
            log.info('new tab created', {
              profile: name,
              run_id: normalizedRunId,
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

        async closeRunSession(runId: string, targetId?: string): Promise<{ targetId?: string; closed: boolean }> {
          const normalizedRunId = runId.trim();
          if (!normalizedRunId) {
            throw statusError(400, 'run_id is required');
          }

          const session = s.runSessions.get(normalizedRunId);
          if (!session || session.profileName !== name) {
            return { closed: false };
          }

          const closeTargetId = targetId?.trim() || session.activeTargetId;
          if (targetId && session.activeTargetId && targetId !== session.activeTargetId) {
            throw statusError(409, `Target ${targetId} is not owned by run ${normalizedRunId}`);
          }

          if (closeTargetId) {
            s.targetOwners.delete(closeTargetId);
          }
          s.runSessions.delete(normalizedRunId);
          return { targetId: closeTargetId, closed: Boolean(closeTargetId) };
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
        if (msg.includes('targetId is required')) {
          return { status: 400, message: msg };
        }
        if (msg.includes('is owned by another run')) {
          return { status: 409, message: msg };
        }
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
