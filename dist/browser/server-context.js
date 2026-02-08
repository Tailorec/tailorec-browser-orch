"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrowserRouteContext = createBrowserRouteContext;
const config_js_1 = require("./config.js");
const chrome_js_1 = require("./chrome.js");
const pw_session_js_1 = require("./pw-session.js");
function isConnectionRefusedError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("ECONNREFUSED") || msg.includes("connectOverCDP");
}
function createBrowserRouteContext(opts) {
    return {
        state() {
            const s = opts.getState();
            if (!s)
                throw new Error("Server not started");
            return s;
        },
        forProfile(name) {
            const s = opts.getState();
            if (!s)
                throw new Error("Server not started");
            const resolvedProfile = (0, config_js_1.resolveProfile)(s.resolved, name);
            if (!resolvedProfile)
                throw new Error(`Profile ${name} not found`);
            return {
                profile: resolvedProfile,
                async ensureTabAvailable(targetId) {
                    const ensureBrowserRunning = async () => {
                        let running = s.profiles.get(name);
                        const reachable = await (0, chrome_js_1.isChromeReachable)(resolvedProfile.cdpUrl, 500);
                        if (running?.chrome && !reachable) {
                            try {
                                await (0, chrome_js_1.stopOpenClawChrome)(running.chrome);
                            }
                            catch {
                                // ignore
                            }
                            running.chrome = undefined;
                        }
                        if (!running || !running.chrome) {
                            const chrome = await (0, chrome_js_1.launchOpenClawChrome)(s.resolved, resolvedProfile);
                            running = { name, config: resolvedProfile, chrome };
                            s.profiles.set(name, running);
                        }
                    };
                    const getOrCreateTab = async () => {
                        if (targetId) {
                            const pages = await (0, pw_session_js_1.listPagesViaPlaywright)({ cdpUrl: resolvedProfile.cdpUrl });
                            const found = pages.find((p) => p.targetId === targetId);
                            if (found) {
                                await (0, pw_session_js_1.focusPageByTargetIdViaPlaywright)({ cdpUrl: resolvedProfile.cdpUrl, targetId });
                                return { targetId, url: found.url };
                            }
                            throw new Error(`Target ${targetId} not found`);
                        }
                        const pages = await (0, pw_session_js_1.listPagesViaPlaywright)({ cdpUrl: resolvedProfile.cdpUrl });
                        if (pages.length > 0) {
                            const first = pages[0];
                            await (0, pw_session_js_1.focusPageByTargetIdViaPlaywright)({
                                cdpUrl: resolvedProfile.cdpUrl,
                                targetId: first.targetId,
                            });
                            return { targetId: first.targetId, url: first.url };
                        }
                        const created = await (0, pw_session_js_1.createPageViaPlaywright)({
                            cdpUrl: resolvedProfile.cdpUrl,
                            url: "about:blank",
                        });
                        return { targetId: created.targetId, url: created.url };
                    };
                    await ensureBrowserRunning();
                    try {
                        return await getOrCreateTab();
                    }
                    catch (err) {
                        if (!isConnectionRefusedError(err)) {
                            throw err;
                        }
                        // One recovery attempt: restart browser and retry once.
                        const running = s.profiles.get(name);
                        if (running?.chrome) {
                            try {
                                await (0, chrome_js_1.stopOpenClawChrome)(running.chrome);
                            }
                            catch {
                                // ignore
                            }
                            running.chrome = undefined;
                        }
                        await ensureBrowserRunning();
                        return await getOrCreateTab();
                    }
                },
                async stopRunningBrowser() {
                    const running = s.profiles.get(name);
                    if (running && running.chrome) {
                        await (0, chrome_js_1.stopOpenClawChrome)(running.chrome);
                        running.chrome = undefined;
                    }
                }
            };
        },
        mapTabError(err) {
            // Simple error mapping
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("tab not found") || msg.includes("Target closed")) {
                return { status: 404, message: "Tab not found or closed" };
            }
            if (isConnectionRefusedError(err)) {
                return { status: 503, message: "Browser CDP unavailable. Retry in a few seconds." };
            }
            if (msg.includes("Timeout") || msg.includes("TimeoutError")) {
                return { status: 408, message: "Browser action timed out" };
            }
            return null;
        }
    };
}
