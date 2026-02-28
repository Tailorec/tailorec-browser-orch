import type { Server } from "node:http";
import express from "express";
import type { BrowserRouteRegistrar } from "../../browser/routes/types.js";
import { registerBrowserRoutes } from "../../browser/routes/index.js";
import { createBrowserRouteContext } from "../../browser/server-context.js";
import { installControlLiveWebSocketServer } from "../../browser/routes/control-live.js";
import { findFreePort } from "../../infra/ports.js";
import type { BrowserServerState } from "../../browser/server-context.js";
import { getOrCreateCorrelationIdFromHeaders, withCorrelationId } from "../../logging/subsystem.js";

export interface TestServerOptions {
  port?: number;
  headless?: boolean;
  evaluateEnabled?: boolean;
  viewport?: { width: number; height: number };
}

export interface TestServerState {
  app: express.Express;
  server: Server;
  port: number;
  baseUrl: string;
  getState: () => BrowserServerState | null;
  ctx: any;
}

/**
 * Creates a test HTTP server with the browser control routes registered.
 * Does NOT start a real browser - use with mocked Playwright for unit tests.
 */
export async function createTestServer(
  options: TestServerOptions = {},
): Promise<TestServerState> {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  // Correlation ID middleware - adds correlation ID to all responses
  app.use((req, res, next) => {
    const correlationId = getOrCreateCorrelationIdFromHeaders(req.headers);
    const headerName = (process.env.CORRELATION_ID_HEADER || "x-correlation-id").toLowerCase();
    res.setHeader(headerName, correlationId);
    withCorrelationId(correlationId, () => {
      next();
    });
  });

  // Mock state for testing
  const mockState: BrowserServerState = {
    server: null as unknown as Server,
    port: options.port ?? 0,
    resolved: {
      enabled: true,
      controlPort: options.port ?? 0,
      headless: options.headless ?? true,
      noSandbox: true,
      profiles: {
        default: {
          cdpPort: 9222,
          driver: "chrome" as const,
          color: "blue",
        },
      },
      evaluateEnabled: options.evaluateEnabled ?? true,
      viewport: options.viewport ?? { width: 1280, height: 720 },
    },
    profiles: new Map(),
  } as unknown as BrowserServerState;

  const getState = () => mockState;
  const ctx = createBrowserRouteContext({ getState });

  // Register all browser routes
  registerBrowserRoutes(app as unknown as BrowserRouteRegistrar, ctx);

  // Find a free port and start server
  const port = options.port ?? (await findFreePort());
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  });

  // Install control WebSocket server
  installControlLiveWebSocketServer(server, ctx);

  return {
    app,
    server,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    getState,
    ctx,
  };
}

/**
 * Stops a test server and cleans up resources.
 */
export async function stopTestServer(state: TestServerState): Promise<void> {
  if (!state.server) {
    return;
  }

  return new Promise<void>((resolve) => {
    state.server.close(() => {
      resolve();
    });
  });
}

/**
 * Helper to run a test with a temporary server.
 * Automatically starts and stops the server.
 */
export async function withTestServer<T>(
  run: (state: TestServerState) => Promise<T>,
  options: TestServerOptions = {},
): Promise<T> {
  const state = await createTestServer(options);
  try {
    return await run(state);
  } finally {
    await stopTestServer(state);
  }
}
