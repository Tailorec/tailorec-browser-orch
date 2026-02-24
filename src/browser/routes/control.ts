import type { BrowserRouteRegistrar } from "./types.js";
import { verifyControlToken } from "./control-live.js";
import { toStringOrEmpty } from "./utils.js";

export function registerBrowserControlRoutes(app: BrowserRouteRegistrar) {
  app.get("/control", async (req, res) => {
    const token = toStringOrEmpty(req.query.token);
    if (!token) {
      return res.status(401).json({ ok: false, error: "missing_control_token" });
    }

    let claims: ReturnType<typeof verifyControlToken>;
    try {
      claims = verifyControlToken(token);
    } catch (error) {
      return res.status(401).json({
        ok: false,
        error: error instanceof Error ? error.message : "invalid_control_token",
      });
    }

    const targetId = toStringOrEmpty(req.query.targetId);
    const wsProtocol = req.protocol === "https" ? "wss" : "ws";
    const host = req.get("host") || "127.0.0.1:4000";
    const wsUrl = `${wsProtocol}://${host}/control/live?${new URLSearchParams({
      token,
      ...(targetId ? { targetId } : {}),
    }).toString()}`;

    return res.json({
      ok: true,
      mode: "interactive",
      ws_url: wsUrl,
      run_id: claims.run_id ?? null,
      note: "Use ws_url for browser interaction. Legacy frame/action/status control endpoints are removed.",
    });
  });
}
