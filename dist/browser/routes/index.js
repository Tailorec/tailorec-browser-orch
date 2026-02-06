"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBrowserRoutes = registerBrowserRoutes;
const agent_js_1 = require("./agent.js");
const basic_js_1 = require("./basic.js");
// import { registerBrowserTabRoutes } from "./tabs.js"; // Skipping tabs management for now
function registerBrowserRoutes(app, ctx) {
    (0, basic_js_1.registerBrowserBasicRoutes)(app, ctx);
    // registerBrowserTabRoutes(app, ctx);
    (0, agent_js_1.registerBrowserAgentRoutes)(app, ctx);
}
