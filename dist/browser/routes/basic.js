"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBrowserBasicRoutes = registerBrowserBasicRoutes;
function registerBrowserBasicRoutes(app, ctx) {
    app.get("/", (req, res) => {
        res.send("Tailorec Browser Service OK");
    });
    app.get("/status", (req, res) => {
        res.json({ ok: true, profiles: Array.from(ctx.state().profiles.keys()) });
    });
}
