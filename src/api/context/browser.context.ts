/**
 * Browser Context for API Routes
 * 
 * Provides context for browser route handlers including profile management
 * and tab lifecycle operations.
 * 
 * Extracted from: src/browser/server-context.ts
 */

import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import type { ResolvedBrowserProfile } from '../../config/config.types.js';
import type { RunningBrowserRuntime } from '../../core/ports/browser-runtime.port.js';
import { createSubsystemLogger } from '../../adapters/logging/logger.adapter.js';
import { redactBrowserEndpoint } from '../../shared/utils/browser-endpoint.utils.js';

const log = createSubsystemLogger('browser-context');
function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

const DEFAULT_GLOBAL_MAX_SESSIONS = 200;
const GLOBAL_MAX_SESSIONS = parsePositiveInt(process.env.BROWSER_MAX_SESSIONS, DEFAULT_GLOBAL_MAX_SESSIONS);
const DEFAULT_LOCAL_MAX_SESSIONS = 5;
const LOCAL_MAX_SESSIONS = parsePositiveInt(process.env.BROWSER_LOCAL_MAX_SESSIONS, DEFAULT_LOCAL_MAX_SESSIONS);
const DEFAULT_BROWSERLESS_MAX_SESSIONS = 20;
const BROWSERLESS_MAX_SESSIONS = parsePositiveInt(
  process.env.BROWSER_BROWSERLESS_MAX_SESSIONS,
  DEFAULT_BROWSERLESS_MAX_SESSIONS,
);
const DEFAULT_CREATE_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const CREATE_IDEMPOTENCY_TTL_MS = parsePositiveInt(
  process.env.BROWSER_CREATE_IDEMPOTENCY_TTL_MS,
  DEFAULT_CREATE_IDEMPOTENCY_TTL_MS,
);
const DEFAULT_ADMISSION_RETRY_AFTER_SECONDS = 5;
const ADMISSION_RETRY_AFTER_SECONDS = parsePositiveInt(
  process.env.BROWSER_ADMISSION_RETRY_AFTER_SECONDS,
  DEFAULT_ADMISSION_RETRY_AFTER_SECONDS,
);
const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = parseNonNegativeInt(
  process.env.BROWSER_SESSION_IDLE_TIMEOUT_MS,
  DEFAULT_SESSION_IDLE_TIMEOUT_MS,
);
const DEFAULT_SESSION_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000;
const SESSION_MAX_LIFETIME_MS = parseNonNegativeInt(
  process.env.BROWSER_SESSION_MAX_LIFETIME_MS,
  DEFAULT_SESSION_MAX_LIFETIME_MS,
);
const DEFAULT_SESSION_CLEANUP_SWEEP_MS = 30_000;
const SESSION_CLEANUP_SWEEP_MS = parseNonNegativeInt(
  process.env.BROWSER_SESSION_CLEANUP_SWEEP_MS,
  DEFAULT_SESSION_CLEANUP_SWEEP_MS,
);

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
  sessionId: string;
  runId: string;
  profileName: string;
  browserEndpoint: string;
  runtimeProfile: ResolvedBrowserProfile;
  runtime?: RunningBrowserRuntime;
  activeTargetId?: string;
  activeTargetUrl?: string;
  createdAt?: number;
  lastTouchedAt?: number;
};

/**
 * Profile context for route handlers
 */
export interface ProfileContext {
  profile: ResolvedBrowserProfile;
  ensureRunSession(runId: string): Promise<{ runId: string; sessionId: string; created: boolean }>;
  ensureTabAvailable(
    runId: string,
    targetId?: string,
    options?: { createNewTab?: boolean; useCurrentTab?: boolean; idempotencyKey?: string },
  ): Promise<{ targetId: string; url: string; browserEndpoint: string }>;
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

function statusError(
  status: number,
  message: string,
  details?: { code?: string; retryAfterSeconds?: number; active?: number; max?: number },
): Error & { status: number; code?: string; retryAfterSeconds?: number; active?: number; max?: number } {
  const error = new Error(message) as Error & {
    status: number;
    code?: string;
    retryAfterSeconds?: number;
    active?: number;
    max?: number;
  };
  error.status = status;
  if (details?.code) error.code = details.code;
  if (typeof details?.retryAfterSeconds === 'number') error.retryAfterSeconds = details.retryAfterSeconds;
  if (typeof details?.active === 'number') error.active = details.active;
  if (typeof details?.max === 'number') error.max = details.max;
  return error;
}

async function reserveLoopbackPort(): Promise<number> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate local browser port')));
        return;
      }
      const port = address.port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
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
  const runLocks = new Map<string, Promise<void>>();
  const createIdempotencyResults = new Map<
    string,
    { expiresAt: number; response: { targetId: string; url: string; browserEndpoint: string } }
  >();

  const withRunLock = async <T>(key: string, action: () => Promise<T>): Promise<T> => {
    const previous = runLocks.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        return await action();
      });
    const tail = current.then(() => undefined, () => undefined);
    runLocks.set(key, tail);
    try {
      return await current;
    } finally {
      if (runLocks.get(key) === tail) {
        runLocks.delete(key);
      }
    }
  };

  const touchSession = (session: RunOwnedSession, now = Date.now()) => {
    if (!session.createdAt) {
      session.createdAt = now;
    }
    session.lastTouchedAt = now;
  };

  const clearIdempotencyForRun = (profileName: string, runId: string) => {
    const runPrefix = `${profileName}:${runId}:`;
    for (const key of createIdempotencyResults.keys()) {
      if (key.startsWith(runPrefix)) {
        createIdempotencyResults.delete(key);
      }
    }
  };

  const closeSessionInternal = async (
    s: BrowserServerState,
    runId: string,
    session: RunOwnedSession,
    reason: 'explicit_close' | 'idle_timeout' | 'max_lifetime',
    targetId?: string,
  ): Promise<{ targetId?: string; closed: boolean }> => {
    const closeTargetId = targetId?.trim() || session.activeTargetId;
    if (targetId && session.activeTargetId && targetId !== session.activeTargetId) {
      throw statusError(409, `Target ${targetId} is not owned by run ${runId}`);
    }

    if (session.runtime) {
      try {
        await opts.releaseBrowser(session.runtimeProfile, session.runtime);
      } catch (err) {
        log.warn('browser stop failed', {
          profile: session.profileName,
          run_id: runId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (closeTargetId) {
      s.targetOwners.delete(closeTargetId);
    }
    s.runSessions.delete(runId);
    clearIdempotencyForRun(session.profileName, runId);
    log.info('run session closed', {
      profile: session.profileName,
      run_id: runId,
      session_id: session.sessionId,
      target_id: closeTargetId,
      reason,
    });
    return { targetId: closeTargetId, closed: true };
  };

  const sweepExpiredSessions = async (now = Date.now()) => {
    const s = opts.getState();
    if (!s) return;
    const candidates: Array<{ runId: string; reason: 'idle_timeout' | 'max_lifetime' }> = [];
    for (const [runId, session] of s.runSessions.entries()) {
      const createdAt = session.createdAt ?? now;
      const lastTouchedAt = session.lastTouchedAt ?? createdAt;
      const isMaxLifetimeExpired =
        SESSION_MAX_LIFETIME_MS > 0 && now - createdAt >= SESSION_MAX_LIFETIME_MS;
      const isIdleExpired =
        !isMaxLifetimeExpired && SESSION_IDLE_TIMEOUT_MS > 0 && now - lastTouchedAt >= SESSION_IDLE_TIMEOUT_MS;
      if (isMaxLifetimeExpired) {
        candidates.push({ runId, reason: 'max_lifetime' });
      } else if (isIdleExpired) {
        candidates.push({ runId, reason: 'idle_timeout' });
      }
    }

    for (const candidate of candidates) {
      const lockKey = `${s.runSessions.get(candidate.runId)?.profileName ?? ''}:${candidate.runId}`;
      await withRunLock(lockKey, async () => {
        const latest = s.runSessions.get(candidate.runId);
        if (!latest) return;
        const createdAt = latest.createdAt ?? now;
        const lastTouchedAt = latest.lastTouchedAt ?? createdAt;
        const stillExpired =
          candidate.reason === 'max_lifetime'
            ? SESSION_MAX_LIFETIME_MS > 0 && now - createdAt >= SESSION_MAX_LIFETIME_MS
            : SESSION_IDLE_TIMEOUT_MS > 0 && now - lastTouchedAt >= SESSION_IDLE_TIMEOUT_MS;
        if (stillExpired) {
          await closeSessionInternal(s, candidate.runId, latest, candidate.reason);
        }
      });
    }
  };

  if (SESSION_CLEANUP_SWEEP_MS > 0) {
    const timer = setInterval(() => {
      void sweepExpiredSessions();
    }, SESSION_CLEANUP_SWEEP_MS);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

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

      const ensureBrowserRunning = async (session: RunOwnedSession) => {
        const ensureKey = `${name}:${session.runId}`;
        const available = await opts.isBrowserAvailable(session.runtimeProfile, session.runtime);

        if (session.runtime && !available) {
          try {
            await opts.releaseBrowser(session.runtimeProfile, session.runtime);
          } catch {
            // Ignore stop errors
          }
          session.runtime = undefined;
        }

        if (!session.runtime) {
          const activeSessions = Array.from(s.runSessions.values()).filter(
            (candidate) => candidate.runtime,
          ).length;
          if (activeSessions >= GLOBAL_MAX_SESSIONS) {
            throw statusError(
              429,
              `global browser capacity exceeded: ${activeSessions}/${GLOBAL_MAX_SESSIONS}`,
              {
                code: 'capacity_exceeded',
                retryAfterSeconds: ADMISSION_RETRY_AFTER_SECONDS,
                active: activeSessions,
                max: GLOBAL_MAX_SESSIONS,
              },
            );
          }

          if (session.runtimeProfile.provider === 'local') {
            const activeLocalSessions = Array.from(s.runSessions.values()).filter(
              (candidate) => candidate.runtimeProfile.provider === 'local' && candidate.runtime,
            ).length;
            if (activeLocalSessions >= LOCAL_MAX_SESSIONS) {
              throw statusError(
                429,
                `local browser capacity exceeded: ${activeLocalSessions}/${LOCAL_MAX_SESSIONS}`,
                {
                  code: 'capacity_exceeded',
                  retryAfterSeconds: ADMISSION_RETRY_AFTER_SECONDS,
                  active: activeLocalSessions,
                  max: LOCAL_MAX_SESSIONS,
                },
              );
            }
          }

          if (session.runtimeProfile.provider === 'browserless') {
            const activeBrowserlessSessions = Array.from(s.runSessions.values()).filter(
              (candidate) => candidate.runtimeProfile.provider === 'browserless' && candidate.runtime,
            ).length;
            if (activeBrowserlessSessions >= BROWSERLESS_MAX_SESSIONS) {
              throw statusError(
                429,
                `browserless capacity exceeded: ${activeBrowserlessSessions}/${BROWSERLESS_MAX_SESSIONS}`,
                {
                  code: 'capacity_exceeded',
                  retryAfterSeconds: ADMISSION_RETRY_AFTER_SECONDS,
                  active: activeBrowserlessSessions,
                  max: BROWSERLESS_MAX_SESSIONS,
                },
              );
            }
          }

          let ensurePromise = ensureInFlight.get(ensureKey);
          if (!ensurePromise) {
            ensurePromise = opts.ensureBrowser(session.runtimeProfile).finally(() => {
              ensureInFlight.delete(ensureKey);
            });
            ensureInFlight.set(ensureKey, ensurePromise);
          }

          const runtime = await ensurePromise;
          session.runtime = runtime;
          s.profiles.set(name, { name, config: session.runtimeProfile, runtime });
          log.info('browser available on demand', {
            profile: name,
            run_id: session.runId,
            provider: session.runtimeProfile.provider,
            browser_endpoint: redactBrowserEndpoint(session.runtimeProfile.browserEndpoint),
            browser_port: runtime?.browserPort ?? session.runtimeProfile.browserPort,
          });
        }
      };

      const throwUnsupportedFlowIfExtraTabs = (
        pages: Array<{ targetId: string; url: string; title?: string }>,
        activeTargetId: string,
      ) => {
        const extraNonBlankTabs = pages.filter(
          (page) => page.targetId !== activeTargetId && page.url && page.url !== 'about:blank',
        );
        if (extraNonBlankTabs.length > 0) {
          throw statusError(409, 'new tab opened is unsupported in v1', {
            code: 'unsupported_flow',
          });
        }
      };

      return {
        profile: resolvedProfile,

        async ensureRunSession(runId: string): Promise<{ runId: string; sessionId: string; created: boolean }> {
          await sweepExpiredSessions();
          const normalizedRunId = runId.trim();
          if (!normalizedRunId) {
            throw statusError(400, 'run_id is required');
          }
          const lockKey = `${name}:${normalizedRunId}`;
          return await withRunLock(lockKey, async () => {
            const existing = s.runSessions.get(normalizedRunId);
            if (existing && existing.profileName !== name) {
              throw statusError(409, 'run_id is already bound to a different profile');
            }

            const session = existing ?? {
              sessionId: randomUUID(),
              runId: normalizedRunId,
              profileName: name,
              browserEndpoint: resolvedProfile.browserEndpoint,
              runtimeProfile: resolvedProfile,
            };
            const created = !existing;

            if (!existing && resolvedProfile.provider === 'local') {
              const port = await reserveLoopbackPort();
              session.runtimeProfile = {
                ...resolvedProfile,
                browserPort: port,
                browserEndpoint: `http://127.0.0.1:${port}`,
                browserEndpointIsLoopback: true,
              };
              session.browserEndpoint = session.runtimeProfile.browserEndpoint;
            }

            touchSession(session);
            s.runSessions.set(normalizedRunId, session);
            await ensureBrowserRunning(session);
            log.info(created ? 'run session created' : 'run session reused', {
              profile: name,
              run_id: normalizedRunId,
              session_id: session.sessionId,
              provider: session.runtimeProfile.provider,
            });
            return {
              runId: normalizedRunId,
              sessionId: session.sessionId,
              created,
            };
          });
        },

        async ensureTabAvailable(
          runId: string,
          targetId?: string,
          options?: { createNewTab?: boolean; useCurrentTab?: boolean; idempotencyKey?: string },
        ) {
          await sweepExpiredSessions();
          const normalizedRunId = runId.trim();
          if (!normalizedRunId) {
            throw statusError(400, 'run_id is required');
          }
          const lockKey = `${name}:${normalizedRunId}`;
          const normalizedIdempotencyKey = options?.idempotencyKey?.trim();
          const idempotencyResultKey =
            options?.createNewTab && normalizedIdempotencyKey
              ? `${name}:${normalizedRunId}:${normalizedIdempotencyKey}`
              : undefined;

          const getOrCreateTab = async () => {
            const startedAt = Date.now();
            if (idempotencyResultKey) {
              const cached = createIdempotencyResults.get(idempotencyResultKey);
              if (cached) {
                if (cached.expiresAt > Date.now()) {
                  return cached.response;
                }
                createIdempotencyResults.delete(idempotencyResultKey);
              }
            }
            const runSession = s.runSessions.get(normalizedRunId);
            if (!runSession) {
              throw statusError(409, 'run session is not initialized. Call CreateRunSession first.');
            }
            if (runSession.profileName !== name) {
              throw statusError(409, 'run_id is already bound to a different profile');
            }
            const session = runSession;
            touchSession(session);
            const setActiveTarget = (activeTargetId: string, activeTargetUrl?: string) => {
              session.activeTargetId = activeTargetId;
              session.activeTargetUrl = activeTargetUrl;
              touchSession(session);
              s.runSessions.set(normalizedRunId, session);
              s.targetOwners.set(activeTargetId, normalizedRunId);
            };
            const clearOwnedTarget = () => {
              if (session.activeTargetId) {
                s.targetOwners.delete(session.activeTargetId);
                session.activeTargetId = undefined;
                session.activeTargetUrl = undefined;
                touchSession(session);
                s.runSessions.set(normalizedRunId, session);
              }
            };

            if (targetId) {
              const owner = s.targetOwners.get(targetId);
              if (owner && owner !== normalizedRunId) {
                throw statusError(409, `Target ${targetId} is owned by another run`);
              }
              await ensureBrowserRunning(session);
              const pages = await opts.listPages(session.browserEndpoint);
              throwUnsupportedFlowIfExtraTabs(pages, targetId);
              const found = pages.find((p) => p.targetId === targetId);
              if (found) {
                await opts.focusPage(session.browserEndpoint, targetId);
                setActiveTarget(targetId, found.url);
                log.info('target focused', {
                  profile: name,
                  target_id: targetId,
                  url: found.url,
                  duration_ms: Date.now() - startedAt,
                });
                return { targetId, url: found.url, browserEndpoint: session.browserEndpoint };
              }
              throw statusError(404, `Target ${targetId} not found`);
            }

            const maybeFocusRunActiveTarget = async () => {
              const activeTargetId = session.activeTargetId;
              if (!activeTargetId) {
                return null;
              }
              await ensureBrowserRunning(session);
              const pages = await opts.listPages(session.browserEndpoint);
              throwUnsupportedFlowIfExtraTabs(pages, activeTargetId);
              const current = pages.find((p) => p.targetId === activeTargetId);
              if (!current) {
                clearOwnedTarget();
                return null;
              }
              await opts.focusPage(session.browserEndpoint, current.targetId);
              setActiveTarget(current.targetId, current.url);
              log.info('run current target focused', {
                profile: name,
                run_id: normalizedRunId,
                target_id: current.targetId,
                url: current.url,
                duration_ms: Date.now() - startedAt,
              });
              return { targetId: current.targetId, url: current.url, browserEndpoint: session.browserEndpoint };
            };

            if (!options?.createNewTab) {
              const current = await maybeFocusRunActiveTarget();
              if (current) {
                return current;
              }
              throw statusError(400, 'targetId is required. Call navigate first to create a browser session.');
            }

            // For create/retry flows, reuse the run-owned active target idempotently.
            if (session.activeTargetId) {
              const response = {
                targetId: session.activeTargetId,
                url: session.activeTargetUrl ?? 'about:blank',
                browserEndpoint: session.browserEndpoint,
              };
              touchSession(session);
              s.runSessions.set(normalizedRunId, session);
              if (idempotencyResultKey) {
                createIdempotencyResults.set(idempotencyResultKey, {
                  expiresAt: Date.now() + CREATE_IDEMPOTENCY_TTL_MS,
                  response,
                });
              }
              return response;
            }

            // For navigate without targetId, prefer the run-owned active target if available.
            const current = await maybeFocusRunActiveTarget();
            if (current) {
              touchSession(session);
              s.runSessions.set(normalizedRunId, session);
              if (idempotencyResultKey) {
                createIdempotencyResults.set(idempotencyResultKey, {
                  expiresAt: Date.now() + CREATE_IDEMPOTENCY_TTL_MS,
                  response: current,
                });
              }
              return current;
            }

            await ensureBrowserRunning(session);

            const result = await opts.createPage(session.browserEndpoint);
            setActiveTarget(result.targetId, result.url);
            log.info('new tab created', {
              profile: name,
              run_id: normalizedRunId,
              target_id: result.targetId,
              url: result.url,
              duration_ms: Date.now() - startedAt,
            });
            const response = {
              ...result,
              browserEndpoint: session.browserEndpoint,
            };
            if (idempotencyResultKey) {
              createIdempotencyResults.set(idempotencyResultKey, {
                expiresAt: Date.now() + CREATE_IDEMPOTENCY_TTL_MS,
                response,
              });
            }
            return response;
          };

          try {
            return await withRunLock(lockKey, async () => {
              return await getOrCreateTab();
            });
          } catch (err) {
            if (isConnectionRefusedError(err)) {
              log.warn('browser connection refused, retrying', {
                profile: name,
                provider: resolvedProfile.provider,
                browser_endpoint: redactBrowserEndpoint(resolvedProfile.browserEndpoint),
              });
              return await withRunLock(lockKey, async () => {
                return await getOrCreateTab();
              });
            }
            throw err;
          }
        },

        async closeRunSession(runId: string, targetId?: string): Promise<{ targetId?: string; closed: boolean }> {
          await sweepExpiredSessions();
          const normalizedRunId = runId.trim();
          if (!normalizedRunId) {
            throw statusError(400, 'run_id is required');
          }
          const lockKey = `${name}:${normalizedRunId}`;
          return await withRunLock(lockKey, async () => {
            const session = s.runSessions.get(normalizedRunId);
            if (!session || session.profileName !== name) {
              return { closed: false };
            }
            return await closeSessionInternal(s, normalizedRunId, session, 'explicit_close', targetId);
          });
        },

        async stopRunningBrowser() {
          for (const [runId, session] of s.runSessions.entries()) {
            if (session.profileName !== name || !session.runtime) {
              continue;
            }
            ensureInFlight.delete(`${name}:${runId}`);
            try {
              await opts.releaseBrowser(session.runtimeProfile, session.runtime);
              log.info('browser stopped', {
                profile: name,
                run_id: runId,
                provider: session.runtimeProfile.provider,
                browser_endpoint: redactBrowserEndpoint(session.runtimeProfile.browserEndpoint),
                browser_port: session.runtimeProfile.browserPort,
              });
            } catch (err) {
              log.warn('browser stop failed', {
                profile: name,
                run_id: runId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            session.runtime = undefined;
            s.runSessions.set(runId, session);
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
