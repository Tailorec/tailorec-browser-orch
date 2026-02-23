import type { BrowserRouteContext } from "../server-context.js";
import type { BrowserRequest, BrowserResponse, BrowserRouteRegistrar } from "./types.js";
import { resolveProfileContext, requirePwAi, readBody, handleRouteError } from "./agent.shared.js";
import { verifyControlToken } from "./control-live.js";
import { toStringOrEmpty } from "./utils.js";

function requireControlToken(req: BrowserRequest, res: BrowserResponse) {
  const token = toStringOrEmpty(req.query.token);
  if (!token) {
    res.status(401).json({ ok: false, error: "missing_control_token" });
    return null;
  }
  try {
    return verifyControlToken(token);
  } catch (error) {
    res.status(401).json({ ok: false, error: error instanceof Error ? error.message : "invalid_control_token" });
    return null;
  }
}

export function registerBrowserControlRoutes(app: BrowserRouteRegistrar, ctx: BrowserRouteContext) {
  app.get("/control", async (req, res) => {
    const claims = requireControlToken(req, res);
    if (!claims) {
      return;
    }

    const token = toStringOrEmpty(req.query.token);
    const targetId = toStringOrEmpty(req.query.targetId);
    const wsProtocol = req.protocol === "https" ? "wss" : "ws";
    const host = req.get("host") || "127.0.0.1:4000";
    const wsUrl = `${wsProtocol}://${host}/control/live?${new URLSearchParams({
      ...(token ? { token } : {}),
      ...(targetId ? { targetId } : {}),
    }).toString()}`;

    return res.json({
      ok: true,
      mode: "interactive",
      ws_url: wsUrl,
      frame_url: "/control/frame",
      action_url: "/control/action",
      status_url: "/control/status",
      run_id: claims.run_id ?? null,
      note: "Use ws_url for low-latency interactive control. /control/frame remains fallback preview.",
    });
  });

  app.get("/control/status", async (req, res) => {
    if (!requireControlToken(req, res)) {
      return;
    }
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }

    try {
      const pw = await requirePwAi(res, "control-status");
      if (!pw) {
        return;
      }
      const pages = await pw.listPagesViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
      });

      const targetId = toStringOrEmpty(req.query.targetId) || undefined;
      const activeTarget = targetId ? pages.find((page) => page.targetId === targetId) : null;

      return res.json({
        ok: true,
        profile: profileCtx.profile.name,
        targetId: activeTarget?.targetId ?? null,
        url: activeTarget?.url ?? null,
        pageCount: pages.length,
        pages,
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.get("/control/frame", async (req, res) => {
    if (!requireControlToken(req, res)) {
      return;
    }

    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }

    const targetId = toStringOrEmpty(req.query.targetId) || undefined;

    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, "control-frame");
      if (!pw) {
        return;
      }

      const result = await pw.takeScreenshotViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        type: "jpeg",
      });

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.send(result.buffer);
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/control/action", async (req, res) => {
    if (!requireControlToken(req, res)) {
      return;
    }

    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }

    const body = readBody(req);
    const kind = toStringOrEmpty(body.kind);
    const targetId = toStringOrEmpty(body.targetId) || undefined;

    if (!["click", "type", "press", "fill", "select", "hover", "scrollIntoView"].includes(kind)) {
      return res.status(400).json({ ok: false, error: "unsupported_control_action" });
    }

    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      return res.json({
        ok: true,
        note: "Use existing /act route for execution. This endpoint is a capability probe for frontend control mode.",
        targetId: tab.targetId,
        action: kind,
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
}
