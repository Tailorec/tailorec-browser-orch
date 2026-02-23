import type { BrowserRouteContext } from "../server-context.js";
import type { BrowserRouteRegistrar } from "./types.js";
import { registerBrowserAgentRoutes } from "./agent.js";
import { registerBrowserBasicRoutes } from "./basic.js";
import { registerBrowserControlRoutes } from "./control.js";
// import { registerBrowserTabRoutes } from "./tabs.js"; // Skipping tabs management for now

export function registerBrowserRoutes(app: BrowserRouteRegistrar, ctx: BrowserRouteContext) {
  registerBrowserBasicRoutes(app, ctx);
  registerBrowserControlRoutes(app, ctx);
  // registerBrowserTabRoutes(app, ctx);
  registerBrowserAgentRoutes(app, ctx);
}
