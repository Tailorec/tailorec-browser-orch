import type { BrowserRouteContext } from "../server-context.js";
import type { BrowserRouteRegistrar } from "./types.js";
import { resolveProfileContext } from "./agent.shared.js";
import { getPwAiModule } from "../pw-ai-module.js";
import { jsonError, toStringOrEmpty, toNumber, toBoolean } from "./utils.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("browser-snapshot");

export function registerBrowserAgentSnapshotRoutes(app: BrowserRouteRegistrar, ctx: BrowserRouteContext) {
  app.post("/snapshot", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const body = req.body || {};
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const cdpUrl = profileCtx.profile.cdpUrl;
      const pw = await getPwAiModule();
      log.info("snapshot request", {
        target_id: tab.targetId,
        profile: profileCtx.profile.name,
      });
      
      // Perform snapshot
      // We accept snapshot options in body
      const timeoutMs = toNumber(body.timeoutMs);
      const maxChars = toNumber(body.maxChars);
      
      const result = await pw.snapshotAiViaPlaywright({
        cdpUrl,
        targetId: tab.targetId,
        timeoutMs,
        maxChars
      });
      
      res.json({ ok: true, targetId: tab.targetId, url: tab.url, ...result });
      
    } catch (err) {
      log.exception("snapshot route failed", err, { target_id: targetId });
      jsonError(res, 500, String(err));
    }
  });
}
