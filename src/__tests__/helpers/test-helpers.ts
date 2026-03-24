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
    cdpPort: 9222,
    cdpUrl: 'http://127.0.0.1:9222',
    cdpIsLoopback: true,
    driver: 'chrome',
    color: 'blue',
  };

  const profileCtx = {
    profile,
    ensureTabAvailable: vi.fn(async (targetId?: string) => ({
      targetId: targetId ?? 'tab-1',
      url: 'https://example.test',
    })),
    stopRunningBrowser: vi.fn(async () => undefined),
  };

  const browserContext = {
    state: vi.fn(() => ({
      server: {} as any,
      port: 4000,
      configuredProfiles: new Map([['default', profile]]),
      profiles: new Map(),
    })),
    forProfile: vi.fn(() => profileCtx),
    mapTabError: vi.fn(() => null),
  };

  return { browserContext, profileCtx, profile };
}

export function createTestApp(
  register: (router: Router, middleware: MiddlewareRegistry) => void,
) {
  const app = express();
  const middleware = createMiddlewareRegistry();
  const router = Router();

  app.use(express.json());
  register(router, middleware);
  app.use(router);
  app.use(middleware.error);

  return app;
}
