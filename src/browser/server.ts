import type { Server } from "node:http";
import express from "express";
import type { BrowserRouteRegistrar } from "./routes/types.js";
import { loadConfig } from "./config.js";
import {
  createSubsystemLogger,
  getOrCreateCorrelationIdFromHeaders,
  withCorrelationId,
} from "../logging/subsystem.js";
import { resolveBrowserConfig } from "./config.js";
import { registerBrowserRoutes } from "./routes/index.js";
import { type BrowserServerState, createBrowserRouteContext } from "./server-context.js";

let state: BrowserServerState | null = null;
const log = createSubsystemLogger("browser");
const logServer = createSubsystemLogger("server");

export async function startBrowserControlServerFromConfig(): Promise<BrowserServerState | null> {
  if (state) {
    return state;
  }

  const cfg = loadConfig();
  const resolved = resolveBrowserConfig(cfg.browser, cfg);
  if (!resolved.enabled) {
    return null;
  }

  const app = express();
  app.use(express.json({ limit: "50mb" })); // Increased limit for snapshots
  app.use((req, res, next) => {
    const correlationId = getOrCreateCorrelationIdFromHeaders(req.headers);
    const headerName = (process.env.CORRELATION_ID_HEADER || "x-correlation-id").toLowerCase();
    const start = Date.now();
    res.setHeader(headerName, correlationId);
    withCorrelationId(correlationId, () => {
      logServer.info("request started", {
        method: req.method,
        path: req.path,
        query: req.query,
        body:
          req.body && typeof req.body === "object"
            ? req.body
            : req.body === undefined
              ? undefined
              : String(req.body),
      });
      res.on("finish", () => {
        logServer.info("request completed", {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          duration_ms: Date.now() - start,
        });
      });
      next();
    });
  });

  const ctx = createBrowserRouteContext({
    getState: () => state,
  });
  registerBrowserRoutes(app as unknown as BrowserRouteRegistrar, ctx);

  const port = resolved.controlPort;
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  }).catch((err) => {
    logServer.error(`browser server failed to bind 127.0.0.1:${port}: ${String(err)}`);
    return null;
  });

  if (!server) {
    return null;
  }

  state = {
    server,
    port,
    resolved,
    profiles: new Map(),
  };

  logServer.info(`Browser control listening on http://127.0.0.1:${port}/`);
  return state;
}

export async function stopBrowserControlServer(): Promise<void> {
  const current = state;
  if (!current) {
    return;
  }

  const ctx = createBrowserRouteContext({
    getState: () => state,
  });

  try {
    for (const name of Object.keys(current.resolved.profiles)) {
      try {
        await ctx.forProfile(name).stopRunningBrowser();
      } catch {
        // ignore
      }
    }
  } catch (err) {
    logServer.warn(`browser stop failed: ${String(err)}`);
  }

  if (current.server) {
    await new Promise<void>((resolve) => {
      current.server?.close(() => resolve());
    });
  }
  state = null;

  try {
    const mod = await import("./pw-ai.js");
    await mod.closePlaywrightBrowserConnection();
  } catch {
    // ignore
  }
}
