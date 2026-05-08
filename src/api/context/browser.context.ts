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
import { setTimeout as sleep } from 'node:timers/promises';
import type { ResolvedBrowserProfile } from '../../config/config.types.js';
import type { RunningBrowserRuntime } from '../../core/ports/browser-runtime.port.js';
import {
  BrowserlessCapacityExceededError,
  type BrowserlessAllocatorStatusSnapshot,
  type IBrowserlessAllocator,
} from '../../core/ports/browserless-allocator.port.js';
import { InMemoryBrowserlessAllocatorAdapter } from '../../adapters/browser/in-memory-browserless-allocator.adapter.js';
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
const DEFAULT_SESSION_DEGRADED_CLOSE_GRACE_MS = 60_000;
const SESSION_DEGRADED_CLOSE_GRACE_MS = parseNonNegativeInt(
  process.env.BROWSER_SESSION_DEGRADED_CLOSE_GRACE_MS,
  DEFAULT_SESSION_DEGRADED_CLOSE_GRACE_MS,
);
const DEFAULT_BROWSERLESS_READY_TIMEOUT_MS = 60_000;
const BROWSERLESS_READY_TIMEOUT_MS = parsePositiveInt(
  process.env.BROWSER_BROWSERLESS_READY_TIMEOUT_MS,
  DEFAULT_BROWSERLESS_READY_TIMEOUT_MS,
);
const DEFAULT_BROWSERLESS_READY_POLL_INTERVAL_MS = 1_000;
const BROWSERLESS_READY_POLL_INTERVAL_MS = parsePositiveInt(
  process.env.BROWSER_BROWSERLESS_READY_POLL_INTERVAL_MS,
  DEFAULT_BROWSERLESS_READY_POLL_INTERVAL_MS,
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
  browserlessTaskId?: string;
  browserlessWorkerEndpoint?: string;
  browserlessAssignedAt?: number;
  runtimeProfile: ResolvedBrowserProfile;
  runtime?: RunningBrowserRuntime;
  activeTargetId?: string;
  activeTargetUrl?: string;
  createdAt?: number;
  lastTouchedAt?: number;
  degradedAt?: number;
  degradedReason?: string;
  degradedCloseAt?: number;
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
  getBrowserlessAllocatorStatus(): Promise<BrowserlessAllocatorStatusSnapshot>;
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

function isBrowserDisconnectError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('ECONNREFUSED') ||
    msg.includes('connectOverCDP') ||
    msg.includes('WebSocket is not open') ||
    msg.includes('Session closed') ||
    msg.includes('Browser has been closed') ||
    msg.includes('browser has disconnected') ||
    msg.includes('Target page, context or browser has been closed')
  );
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

function withTrackingId(browserEndpoint: string, trackingId: string): string {
  const toBrowserlessTrackingId = (value: string): string => {
    const normalized = value.replace(/[^a-zA-Z0-9]/g, '');
    if (!normalized) {
      return 'run';
    }
    return normalized.slice(0, 31);
  };
  const url = new URL(browserEndpoint);
  if (!url.searchParams.has('trackingId')) {
    url.searchParams.set('trackingId', toBrowserlessTrackingId(trackingId));
  }
  return url.toString();
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
  connectBrowserEndpoint?: (browserEndpoint: string) => Promise<void>;
  disconnectBrowserEndpoint?: (browserEndpoint: string) => Promise<void>;
  probeBrowserEndpoint?: (browserEndpoint: string) => Promise<void>;
  listPages: (browserEndpoint: string) => Promise<Array<{ targetId: string; url: string; title?: string }>>;
  focusPage: (browserEndpoint: string, targetId: string) => Promise<void>;
  createPage: (browserEndpoint: string, url?: string) => Promise<{ targetId: string; url: string }>;
  browserlessAllocator?: IBrowserlessAllocator;
}): BrowserRouteContext {
  const ensureInFlight = new Map<string, Promise<RunningProfile['runtime']>>();
  const runLocks = new Map<string, Promise<void>>();
  const browserlessAllocator = opts.browserlessAllocator ?? new InMemoryBrowserlessAllocatorAdapter();
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

  const ensureBrowserlessPinnedWorker = async (session: RunOwnedSession) => {
    if (session.runtimeProfile.provider !== 'browserless') {
      return;
    }

    const existingAssignment = await browserlessAllocator.getAssignment(session.runId);
    let assignment = existingAssignment;
    if (!assignment) {
      try {
        assignment = await browserlessAllocator.assignRun({
          runId: session.runId,
          sessionId: session.sessionId,
          profile: session.runtimeProfile,
        });
      } catch (error) {
        if (error instanceof BrowserlessCapacityExceededError) {
          throw statusError(429, error.message, {
            code: 'capacity_exceeded',
            retryAfterSeconds: ADMISSION_RETRY_AFTER_SECONDS,
            active: error.active,
            max: error.max,
          });
        }
        throw error;
      }
    }

    session.browserlessTaskId = assignment.taskId;
    session.browserlessWorkerEndpoint = assignment.endpoint;
    session.browserlessAssignedAt = assignment.assignedAt;
    session.browserEndpoint = withTrackingId(assignment.endpoint, session.sessionId);
  };

  const waitForBrowserlessReadiness = async (session: RunOwnedSession) => {
    if (session.runtimeProfile.provider !== 'browserless') {
      return;
    }

    if (!session.browserlessTaskId || !session.browserlessWorkerEndpoint) {
      throw statusError(503, 'browserless worker assignment is missing', {
        code: 'runtime_unavailable',
      });
    }

    const markBrowserlessWorkerUnavailableForReadinessFailure = async (error: unknown) => {
      if (!session.browserlessTaskId || !session.browserlessWorkerEndpoint) {
        return;
      }
      try {
        await browserlessAllocator.markWorkerUnavailable({
          taskId: session.browserlessTaskId,
          endpoint: session.browserlessWorkerEndpoint,
          reason: error instanceof Error ? error.message : String(error),
        });
      } catch (allocatorError) {
        log.warn('browserless worker unavailable mark failed during readiness handling', {
          profile: session.profileName,
          run_id: session.runId,
          session_id: session.sessionId,
          browserless_task_id: session.browserlessTaskId,
          error: allocatorError instanceof Error ? allocatorError.message : String(allocatorError),
        });
      }
    };

    try {
      const runningState = await browserlessAllocator.waitForWorkerRunning({
        taskId: session.browserlessTaskId,
        endpoint: session.browserlessWorkerEndpoint,
        timeoutMs: BROWSERLESS_READY_TIMEOUT_MS,
        pollIntervalMs: BROWSERLESS_READY_POLL_INTERVAL_MS,
      });
      session.browserlessWorkerEndpoint = runningState.endpoint;
      session.browserEndpoint = withTrackingId(runningState.endpoint, session.sessionId);
    } catch (error) {
      await markBrowserlessWorkerUnavailableForReadinessFailure(error);
      throw statusError(503, 'browserless worker failed to reach running state', {
        code: 'runtime_unavailable',
      });
    }

    try {
      const readinessDeadline = Date.now() + BROWSERLESS_READY_TIMEOUT_MS;
      let readinessAttempt = 0;

      for (;;) {
        readinessAttempt += 1;
        try {
          if (opts.probeBrowserEndpoint) {
            await opts.probeBrowserEndpoint(session.browserEndpoint);
          } else if (opts.connectBrowserEndpoint) {
            await opts.connectBrowserEndpoint(session.browserEndpoint);
          }
          break;
        } catch (error) {
          const remainingMs = readinessDeadline - Date.now();
          if (!isBrowserDisconnectError(error) || remainingMs <= 0) {
            throw error;
          }
          log.warn('browserless readiness probe not ready, retrying', {
            profile: session.profileName,
            run_id: session.runId,
            session_id: session.sessionId,
            browserless_task_id: session.browserlessTaskId,
            attempt: readinessAttempt,
            remaining_ms: remainingMs,
            error: error instanceof Error ? error.message : String(error),
          });
          await sleep(Math.min(BROWSERLESS_READY_POLL_INTERVAL_MS, remainingMs));
        }
      }
    } catch (error) {
      await markBrowserlessWorkerUnavailableForReadinessFailure(error);
      throw statusError(503, 'browserless worker failed readiness probe', {
        code: 'runtime_unavailable',
      });
    }
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
    reason: 'explicit_close' | 'idle_timeout' | 'max_lifetime' | 'degraded_timeout' | 'unsupported_flow',
    targetId?: string,
  ): Promise<{ targetId?: string; closed: boolean }> => {
    const closeTargetId = targetId?.trim() || session.activeTargetId;
    if (targetId && session.activeTargetId && targetId !== session.activeTargetId) {
      throw statusError(409, `Target ${targetId} is not owned by run ${runId}`);
    }

    ensureInFlight.delete(`${session.profileName}:${runId}`);
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
    if (opts.disconnectBrowserEndpoint) {
      try {
        await opts.disconnectBrowserEndpoint(session.browserEndpoint);
      } catch (err) {
        log.warn('browser disconnect failed', {
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
    if (session.runtimeProfile.provider === 'browserless') {
      await browserlessAllocator.releaseRun(runId);
    }
    log.info('run session closed', {
      profile: session.profileName,
      run_id: runId,
      session_id: session.sessionId,
      target_id: closeTargetId,
      reason,
      browserless_task_id: session.browserlessTaskId,
    });
    return { targetId: closeTargetId, closed: true };
  };

  const sweepExpiredSessions = async (now = Date.now()) => {
    const s = opts.getState();
    if (!s) return;
    const candidates: Array<{ runId: string; reason: 'idle_timeout' | 'max_lifetime' | 'degraded_timeout' }> = [];
    for (const [runId, session] of s.runSessions.entries()) {
      const createdAt = session.createdAt ?? now;
      const lastTouchedAt = session.lastTouchedAt ?? createdAt;
      const isDegradedExpired =
        SESSION_DEGRADED_CLOSE_GRACE_MS > 0 &&
        typeof session.degradedCloseAt === 'number' &&
        now >= session.degradedCloseAt;
      const isMaxLifetimeExpired =
        !isDegradedExpired && SESSION_MAX_LIFETIME_MS > 0 && now - createdAt >= SESSION_MAX_LIFETIME_MS;
      const isIdleExpired =
        !isMaxLifetimeExpired && SESSION_IDLE_TIMEOUT_MS > 0 && now - lastTouchedAt >= SESSION_IDLE_TIMEOUT_MS;
      if (isDegradedExpired) {
        candidates.push({ runId, reason: 'degraded_timeout' });
      } else if (isMaxLifetimeExpired) {
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
          candidate.reason === 'degraded_timeout'
            ? SESSION_DEGRADED_CLOSE_GRACE_MS > 0 &&
              typeof latest.degradedCloseAt === 'number' &&
              now >= latest.degradedCloseAt
            : candidate.reason === 'max_lifetime'
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

    async getBrowserlessAllocatorStatus(): Promise<BrowserlessAllocatorStatusSnapshot> {
      return await browserlessAllocator.getStatusSnapshot();
    },

    forProfile(name: string) {
      const s = opts.getState();
      if (!s) throw new Error('Server not started');

      const resolvedProfile = s.configuredProfiles.get(name);
      if (!resolvedProfile) {
        throw new Error(`Profile ${name} not found`);
      }

      log.debug('profile context created', { profile: name });

      const degradedRetryAfterSeconds = (session: RunOwnedSession, now = Date.now()): number | undefined => {
        if (typeof session.degradedCloseAt !== 'number') return undefined;
        const remainingMs = session.degradedCloseAt - now;
        return remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 1000)) : undefined;
      };

      const markSessionDegraded = (session: RunOwnedSession, error: unknown, now = Date.now()) => {
        if (session.degradedAt) {
          return;
        }
        session.degradedAt = now;
        session.degradedReason = error instanceof Error ? error.message : String(error);
        session.degradedCloseAt = now + SESSION_DEGRADED_CLOSE_GRACE_MS;
        touchSession(session, now);
        s.runSessions.set(session.runId, session);
        log.warn('run session degraded', {
          profile: session.profileName,
          run_id: session.runId,
          session_id: session.sessionId,
          error: session.degradedReason,
          auto_close_in_ms: SESSION_DEGRADED_CLOSE_GRACE_MS,
        });
      };

      const markBrowserlessSessionDegraded = async (session: RunOwnedSession, error: unknown, now = Date.now()) => {
        markSessionDegraded(session, error, now);
        if (!session.browserlessTaskId || !session.browserlessWorkerEndpoint) {
          return;
        }
        try {
          await browserlessAllocator.markWorkerUnavailable({
            taskId: session.browserlessTaskId,
            endpoint: session.browserlessWorkerEndpoint,
            reason: error instanceof Error ? error.message : String(error),
          });
        } catch (allocatorError) {
          log.warn('browserless worker unavailable mark failed', {
            profile: session.profileName,
            run_id: session.runId,
            session_id: session.sessionId,
            browserless_task_id: session.browserlessTaskId,
            error: allocatorError instanceof Error ? allocatorError.message : String(allocatorError),
          });
        }
      };

      const throwIfSessionDegraded = (session: RunOwnedSession, now = Date.now()) => {
        if (!session.degradedAt) {
          return;
        }
        throw statusError(503, 'run session is degraded', {
          code: 'session_degraded',
          retryAfterSeconds: degradedRetryAfterSeconds(session, now),
        });
      };

      const ensureBrowserRunning = async (session: RunOwnedSession) => {
        throwIfSessionDegraded(session);
        const ensureKey = `${name}:${session.runId}`;
        const available = await opts.isBrowserAvailable(session.runtimeProfile, session.runtime);

        if (session.runtime && !available) {
          if (session.runtimeProfile.provider === 'browserless') {
            await markBrowserlessSessionDegraded(session, new Error('browserless session disconnected'));
            throwIfSessionDegraded(session);
          }
          try {
            await opts.releaseBrowser(session.runtimeProfile, session.runtime);
          } catch {
            // Ignore stop errors
          }
          session.runtime = undefined;
        }

        if (session.runtime && session.runtimeProfile.provider === 'browserless') {
          try {
            if (opts.probeBrowserEndpoint) {
              await opts.probeBrowserEndpoint(session.browserEndpoint);
            } else if (opts.connectBrowserEndpoint) {
              await opts.connectBrowserEndpoint(session.browserEndpoint);
            }
          } catch (error) {
            await markBrowserlessSessionDegraded(session, error);
            throwIfSessionDegraded(session);
          }
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

          let ensurePromise = ensureInFlight.get(ensureKey);
          if (!ensurePromise) {
            ensurePromise = opts.ensureBrowser(session.runtimeProfile).finally(() => {
              ensureInFlight.delete(ensureKey);
            });
            ensureInFlight.set(ensureKey, ensurePromise);
          }

          const runtime = await ensurePromise;
          if (!runtime) {
            throw statusError(503, 'browser runtime unavailable after ensure', {
              code: 'runtime_unavailable',
            });
          }
          session.runtime = runtime;
          if (session.runtimeProfile.provider === 'browserless' && runtime.browserEndpoint) {
            session.browserEndpoint = session.browserlessWorkerEndpoint
              ? withTrackingId(session.browserlessWorkerEndpoint, session.sessionId)
              : runtime.browserEndpoint;
          }
          if (session.runtimeProfile.provider === 'browserless' && runtime.browserSessionId) {
            session.sessionId = runtime.browserSessionId;
          }
          await waitForBrowserlessReadiness(session);
          session.degradedAt = undefined;
          session.degradedReason = undefined;
          session.degradedCloseAt = undefined;
          if (opts.connectBrowserEndpoint) {
            await opts.connectBrowserEndpoint(session.browserEndpoint);
          }
          s.profiles.set(name, { name, config: session.runtimeProfile, runtime });
          log.info('browser available on demand', {
            profile: name,
            run_id: session.runId,
            session_id: session.sessionId,
            provider: session.runtimeProfile.provider,
            browser_endpoint: redactBrowserEndpoint(session.browserEndpoint),
            browser_port: runtime?.browserPort ?? session.runtimeProfile.browserPort,
          });
        }
      };

      const throwUnsupportedFlowIfExtraTabs = async (
        runId: string,
        session: RunOwnedSession,
        pages: Array<{ targetId: string; url: string; title?: string }>,
        activeTargetId: string,
      ) => {
        const extraNonBlankTabs = pages.filter(
          (page) => page.targetId !== activeTargetId && page.url && page.url !== 'about:blank',
        );
        if (extraNonBlankTabs.length > 0) {
          await closeSessionInternal(s, runId, session, 'unsupported_flow', activeTargetId);
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
            if (existing) {
              throwIfSessionDegraded(existing);
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
            if (!existing && resolvedProfile.provider === 'browserless') {
              await ensureBrowserlessPinnedWorker(session);
            }
            if (existing && resolvedProfile.provider === 'browserless') {
              await ensureBrowserlessPinnedWorker(session);
            }

            touchSession(session);
            s.runSessions.set(normalizedRunId, session);
            try {
              await ensureBrowserRunning(session);
            } catch (error) {
              if (created) {
                const latest = s.runSessions.get(normalizedRunId);
                if (latest?.sessionId === session.sessionId) {
                  if (latest.activeTargetId) {
                    s.targetOwners.delete(latest.activeTargetId);
                  }
                  s.runSessions.delete(normalizedRunId);
                  clearIdempotencyForRun(latest.profileName, normalizedRunId);
                  if (latest.runtimeProfile.provider === 'browserless') {
                    await browserlessAllocator.releaseRun(normalizedRunId);
                  }
                }
              }
              throw error;
            }
            log.info(created ? 'run session created' : 'run session reused', {
              profile: name,
              run_id: normalizedRunId,
              session_id: session.sessionId,
              provider: session.runtimeProfile.provider,
              browserless_task_id: session.browserlessTaskId,
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
              let pages: Array<{ targetId: string; url: string; title?: string }>;
              try {
                pages = await opts.listPages(session.browserEndpoint);
              } catch (error) {
                if (session.runtimeProfile.provider === 'browserless' && isBrowserDisconnectError(error)) {
                  await markBrowserlessSessionDegraded(session, error);
                  throwIfSessionDegraded(session);
                }
                throw error;
              }
              await throwUnsupportedFlowIfExtraTabs(normalizedRunId, session, pages, targetId);
              const found = pages.find((p) => p.targetId === targetId);
              if (found) {
                try {
                  await opts.focusPage(session.browserEndpoint, targetId);
                } catch (error) {
                  if (session.runtimeProfile.provider === 'browserless' && isBrowserDisconnectError(error)) {
                    await markBrowserlessSessionDegraded(session, error);
                    throwIfSessionDegraded(session);
                  }
                  throw error;
                }
                setActiveTarget(targetId, found.url);
                log.info('target focused', {
                  profile: name,
                  run_id: normalizedRunId,
                  session_id: session.sessionId,
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
              let pages: Array<{ targetId: string; url: string; title?: string }>;
              try {
                pages = await opts.listPages(session.browserEndpoint);
              } catch (error) {
                if (session.runtimeProfile.provider === 'browserless' && isBrowserDisconnectError(error)) {
                  await markBrowserlessSessionDegraded(session, error);
                  throwIfSessionDegraded(session);
                }
                throw error;
              }
              await throwUnsupportedFlowIfExtraTabs(normalizedRunId, session, pages, activeTargetId);
              const current = pages.find((p) => p.targetId === activeTargetId);
              if (!current) {
                clearOwnedTarget();
                return null;
              }
              try {
                await opts.focusPage(session.browserEndpoint, current.targetId);
              } catch (error) {
                if (session.runtimeProfile.provider === 'browserless' && isBrowserDisconnectError(error)) {
                  await markBrowserlessSessionDegraded(session, error);
                  throwIfSessionDegraded(session);
                }
                throw error;
              }
              setActiveTarget(current.targetId, current.url);
              log.info('run current target focused', {
                profile: name,
                run_id: normalizedRunId,
                session_id: session.sessionId,
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

            let result: { targetId: string; url: string };
            try {
              result = await opts.createPage(session.browserEndpoint);
            } catch (error) {
              if (session.runtimeProfile.provider === 'browserless' && isBrowserDisconnectError(error)) {
                await markBrowserlessSessionDegraded(session, error);
                throwIfSessionDegraded(session);
              }
              throw error;
            }
            let pagesAfterCreate: Array<{ targetId: string; url: string; title?: string }> = [];
            try {
              pagesAfterCreate = await opts.listPages(session.browserEndpoint);
            } catch (error) {
              if (session.runtimeProfile.provider === 'browserless' && isBrowserDisconnectError(error)) {
                await markBrowserlessSessionDegraded(session, error);
                throwIfSessionDegraded(session);
              }
              throw error;
            }
            await throwUnsupportedFlowIfExtraTabs(normalizedRunId, session, pagesAfterCreate, result.targetId);
            setActiveTarget(result.targetId, result.url);
            log.info('new tab created', {
              profile: name,
              run_id: normalizedRunId,
              session_id: session.sessionId,
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
