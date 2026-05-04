import express, { Router, type Request, type Response } from 'express';
import type { MiddlewareRegistry } from '../../api/middlewares/index.js';
import { createMiddlewareRegistry } from '../../api/middlewares/index.js';
import { vi } from 'vitest';

type MockRequestInput = {
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  protocol?: string;
  path?: string;
  method?: string;
};

export function createMockReq(input: MockRequestInput = {}): Request {
  const headers = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    body: input.body ?? {},
    query: input.query ?? {},
    headers,
    protocol: input.protocol ?? 'http',
    path: input.path ?? '/',
    method: input.method ?? 'GET',
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

export function createMockRes(): Response & {
  statusCode: number;
  payload?: unknown;
  text?: unknown;
} {
  const headers = new Map<string, string>();
  const res = {
    statusCode: 200,
    payload: undefined,
    text: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
    send(body: unknown) {
      this.text = body;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
  };

  return res as Response & { statusCode: number; payload?: unknown; text?: unknown };
}

export function createBrowserContextMock() {
  const profile = {
    name: 'default',
    provider: 'local' as const,
    browserPort: 9222,
    browserEndpoint: 'http://127.0.0.1:9222',
    browserEndpointIsLoopback: true,
    driver: 'chrome',
    color: 'blue',
  };

  const profileCtx = {
    profile,
    ensureTabAvailable: vi.fn(async (_runId: string, targetId?: string) => ({
      targetId: targetId ?? 'tab-1',
      url: 'https://example.test',
      browserEndpoint: profile.browserEndpoint,
    })),
    closeRunSession: vi.fn(async () => ({ closed: false })),
    stopRunningBrowser: vi.fn(async () => undefined),
  };

  const browserContext = {
    state: vi.fn(() => ({
      server: {} as any,
      port: 4000,
      configuredProfiles: new Map([['default', profile]]),
      profiles: new Map(),
      runSessions: new Map(),
      targetOwners: new Map(),
    })),
    getBrowserlessAllocatorStatus: vi.fn(async () => ({
      totalAssignedRuns: 0,
      maxTotalSessions: 20,
      maxSessionsPerWorker: 5,
      workers: [],
    })),
    forProfile: vi.fn(() => profileCtx),
    mapTabError: vi.fn(() => null),
  };

  return { browserContext, profileCtx, profile };
}

export function createTestApp(
  register: (router: Router, middleware: MiddlewareRegistry) => void,
  options: { autoInjectRunId?: boolean } = {},
) {
  const app = express();
  const middleware = createMiddlewareRegistry();
  const router = Router();
  const runScopedPaths = ['/act', '/snapshot', '/screenshot', '/download', '/wait/download'];
  const runScopedPrefixes = ['/hooks/', '/snapshot/'];
  const autoInjectRunId = options.autoInjectRunId ?? true;

  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }
    const path = req.path ?? '';
    const needsRunId = runScopedPaths.includes(path)
      || runScopedPrefixes.some((prefix) => path.startsWith(prefix));
    if (!needsRunId) {
      next();
      return;
    }
    if (!autoInjectRunId) {
      next();
      return;
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      req.body = {};
    }
    const body = req.body as Record<string, unknown>;
    if (typeof body.run_id !== 'string' || body.run_id.trim().length === 0) {
      body.run_id = 'test-run-1';
    }
    next();
  });
  register(router, middleware);
  app.use(router);
  app.use(middleware.error);

  return app;
}
