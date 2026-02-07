"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBrowserControlServerFromConfig = startBrowserControlServerFromConfig;
exports.stopBrowserControlServer = stopBrowserControlServer;
const express_1 = __importDefault(require("express"));
const config_js_1 = require("./config.js");
const subsystem_js_1 = require("../logging/subsystem.js");
const config_js_2 = require("./config.js");
const index_js_1 = require("./routes/index.js");
const server_context_js_1 = require("./server-context.js");
let state = null;
const log = (0, subsystem_js_1.createSubsystemLogger)("browser");
const logServer = (0, subsystem_js_1.createSubsystemLogger)("server");
async function startBrowserControlServerFromConfig() {
    if (state) {
        return state;
    }
    const cfg = (0, config_js_1.loadConfig)();
    const resolved = (0, config_js_2.resolveBrowserConfig)(cfg.browser, cfg);
    if (!resolved.enabled) {
        return null;
    }
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: "50mb" })); // Increased limit for snapshots
    app.use((req, res, next) => {
        const correlationId = (0, subsystem_js_1.getOrCreateCorrelationIdFromHeaders)(req.headers);
        const headerName = (process.env.CORRELATION_ID_HEADER || "x-correlation-id").toLowerCase();
        const start = Date.now();
        res.setHeader(headerName, correlationId);
        (0, subsystem_js_1.withCorrelationId)(correlationId, () => {
            logServer.info("request started", {
                method: req.method,
                path: req.path,
                query: req.query,
                body: req.body && typeof req.body === "object"
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
    const ctx = (0, server_context_js_1.createBrowserRouteContext)({
        getState: () => state,
    });
    (0, index_js_1.registerBrowserRoutes)(app, ctx);
    const port = resolved.controlPort;
    const server = await new Promise((resolve, reject) => {
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
async function stopBrowserControlServer() {
    const current = state;
    if (!current) {
        return;
    }
    const ctx = (0, server_context_js_1.createBrowserRouteContext)({
        getState: () => state,
    });
    try {
        for (const name of Object.keys(current.resolved.profiles)) {
            try {
                await ctx.forProfile(name).stopRunningBrowser();
            }
            catch {
                // ignore
            }
        }
    }
    catch (err) {
        logServer.warn(`browser stop failed: ${String(err)}`);
    }
    if (current.server) {
        await new Promise((resolve) => {
            current.server?.close(() => resolve());
        });
    }
    state = null;
    try {
        const mod = await import("./pw-ai.js");
        await mod.closePlaywrightBrowserConnection();
    }
    catch {
        // ignore
    }
}
