"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBrowserAgentSnapshotRoutes = registerBrowserAgentSnapshotRoutes;
const agent_shared_js_1 = require("./agent.shared.js");
const pw_ai_module_js_1 = require("../pw-ai-module.js");
const utils_js_1 = require("./utils.js");
const subsystem_js_1 = require("../../logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("browser-snapshot");
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
            log.info("snapshot request", {
                target_id: tab.targetId,
                profile: profileCtx.profile.name,
            });
            // Perform snapshot
            // We accept snapshot options in body
            const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
            const maxChars = (0, utils_js_1.toNumber)(body.maxChars);
            const interactiveOnly = body.interactiveOnly === true;
            const compact = body.compact === true;
            const maxDepth = (0, utils_js_1.toNumber)(body.maxDepth);
            const result = await pw.snapshotAiViaPlaywright({
                cdpUrl,
                targetId: tab.targetId,
                timeoutMs,
                maxChars,
                options: {
                    interactive: interactiveOnly,
                    compact,
                    maxDepth: maxDepth ?? undefined,
                },
            });
            res.json({ ok: true, targetId: tab.targetId, url: tab.url, ...result });
        }
        catch (err) {
            log.exception("snapshot route failed", err, { target_id: targetId });
            (0, utils_js_1.jsonError)(res, 500, String(err));
        }
    });
}
