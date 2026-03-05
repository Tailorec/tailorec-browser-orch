import type { Server } from "node:http";
import express from "express";
import type { BrowserRouteRegistrar } from "../../browser/routes/types.js";
import { registerBrowserRoutes } from "../../browser/routes/index.js";
import { createBrowserRouteContext } from "../../browser/server-context.js";
import { installControlLiveWebSocketServer } from "../../browser/routes/control-live.js";
import { findFreePort } from "../../shared/utils/ports.js";
import type { BrowserServerState } from "../../browser/server-context.js";
import { getOrCreateCorrelationIdFromHeaders, withCorrelationId } from "../../logging/subsystem.js";
import { createMiddlewareRegistry } from "../../api/middlewares/index.js";
import { registerAllRoutes, type Controllers } from "../../api/routes/index.js";
import { SnapshotController } from "../../api/controllers/snapshot.controller.js";
import { SimpleActionController } from "../../api/controllers/simple-action.controller.js";
import { FormActionController } from "../../api/controllers/form-action.controller.js";
import { AdvancedActionController } from "../../api/controllers/advanced-action.controller.js";
import { ControlController } from "../../api/controllers/control.controller.js";
import { HooksController } from "../../api/controllers/hooks.controller.js";
import { BasicController } from "../../api/controllers/basic.controller.js";
import { loadConfig } from "../../config/config.js";

export interface TestServerOptions {
  port?: number;
  headless?: boolean;
  evaluateEnabled?: boolean;
  viewport?: { width: number; height: number };
  useNewArchitecture?: boolean;
}

export interface TestServerState {
  app: express.Express;
  server: Server;
  port: number;
  baseUrl: string;
  getState: () => BrowserServerState | null;
  ctx: any;
  controllers?: Controllers;
}

/**
 * Creates a test HTTP server with the browser control routes registered.
 * Does NOT start a real browser - use with mocked Playwright for unit tests.
 * 
 * @deprecated Use createTestServerNewArch for new architecture tests
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
 * Creates a test HTTP server using the new Clean Architecture.
 * Uses DI container and new API controllers/routes.
 */
export async function createTestServerNewArch(
  options: TestServerOptions = {},
): Promise<TestServerState> {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  // Load config
  const config = loadConfig();

  // Create controllers (with stub dependencies for testing)
  const controllers: Controllers = {
    snapshot: new SnapshotController({} as any),
    simpleAction: new SimpleActionController({} as any),
    formAction: new FormActionController({} as any),
    advancedAction: new AdvancedActionController({} as any),
    control: new ControlController(),
    hooks: new HooksController(),
    basic: new BasicController(),
  };

  // Create middleware registry
  const middleware = createMiddlewareRegistry();

  // Register middlewares
  app.use(middleware.correlation);
  app.use(middleware.logging);

  // Register all API routes
  registerAllRoutes(app, controllers, middleware);

  // Register error middleware (must be last)
  app.use(middleware.error);

  // Find a free port and start server
  const port = options.port ?? (await findFreePort());
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  });

  return {
    app,
    server,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    getState: () => null,
    ctx: null,
    controllers,
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

/**
 * Helper to run a test with a temporary server using new architecture.
 * Automatically starts and stops the server.
 */
export async function withTestServerNewArch<T>(
  run: (state: TestServerState) => Promise<T>,
  options: TestServerOptions = {},
): Promise<T> {
  const state = await createTestServerNewArch(options);
  try {
    return await run(state);
  } finally {
    await stopTestServer(state);
  }
}
