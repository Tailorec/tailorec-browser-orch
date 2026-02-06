import type { BrowserRouteContext } from "../server-context.js";
import type { BrowserRouteRegistrar } from "./types.js";

export function registerBrowserBasicRoutes(app: BrowserRouteRegistrar, ctx: BrowserRouteContext) {
  app.get("/", (req, res) => {
    res.send("Tailorec Browser Service OK");
  });
  
  app.get("/status", (req, res) => {
    res.json({ ok: true, profiles: Array.from(ctx.state().profiles.keys()) });
  });
}
