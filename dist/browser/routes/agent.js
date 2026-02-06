"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBrowserAgentRoutes = registerBrowserAgentRoutes;
const agent_act_js_1 = require("./agent.act.js");
const agent_snapshot_js_1 = require("./agent.snapshot.js");
function registerBrowserAgentRoutes(app, ctx) {
    (0, agent_snapshot_js_1.registerBrowserAgentSnapshotRoutes)(app, ctx);
    (0, agent_act_js_1.registerBrowserAgentActRoutes)(app, ctx);
}
