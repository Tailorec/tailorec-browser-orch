"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBrowserAgentSnapshotRoutes = registerBrowserAgentSnapshotRoutes;
const agent_shared_js_1 = require("./agent.shared.js");
const pw_ai_module_js_1 = require("../pw-ai-module.js");
const utils_js_1 = require("./utils.js");
function registerBrowserAgentSnapshotRoutes(app, ctx) {
    app.post("/snapshot", async (req, res) => {
        const profileCtx = (0, agent_shared_js_1.resolveProfileContext)(req, res, ctx);
        if (!profileCtx)
            return;
        const body = req.body || {};
        const targetId = (0, utils_js_1.toStringOrEmpty)(body.targetId) || undefined;
        try {
            const tab = await profileCtx.ensureTabAvailable(targetId);
            const cdpUrl = profileCtx.profile.cdpUrl;
            const pw = await (0, pw_ai_module_js_1.getPwAiModule)();
            // Perform snapshot
            // We accept snapshot options in body
            const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
            const maxChars = (0, utils_js_1.toNumber)(body.maxChars);
            const result = await pw.snapshotAiViaPlaywright({
                cdpUrl,
                targetId: tab.targetId,
                timeoutMs,
                maxChars
            });
            res.json({ ok: true, targetId: tab.targetId, url: tab.url, ...result });
        }
        catch (err) {
            (0, utils_js_1.jsonError)(res, 500, String(err));
        }
    });
}
