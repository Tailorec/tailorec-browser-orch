import type { BrowserRouteContext } from "../server-context.js";
import type { BrowserRouteRegistrar } from "./types.js";
import { resolveProfileContext, requirePwAi, readBody, handleRouteError } from "./agent.shared.js";
import { toStringOrEmpty } from "./utils.js";

export function registerBrowserControlRoutes(app: BrowserRouteRegistrar, ctx: BrowserRouteContext) {
  app.get("/control/status", async (req, res) => {
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
