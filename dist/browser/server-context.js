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
const subsystem_js_1 = require("../logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("server-context");
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
            log.debug("profile context created", { profile: name });
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
                    const startedAt = Date.now();
                    // If targetId is provided, verify it exists. If not, verify we have at least one tab or create one.
                    // This logic was partly in server.ts in OpenClaw or implied.
                    // We need to ensure the browser is running first.
                    let running = s.profiles.get(name);
                    if (!running || !running.chrome) {
                        // Start browser on demand?
                        // OpenClaw starts browsers on startup for enabled profiles, or on demand?
                        // Let's implement on-demand start if not running.
                        const chrome = await (0, chrome_js_1.launchOpenClawChrome)(s.resolved, resolvedProfile);
                        running = { name, config: resolvedProfile, chrome };
                        s.profiles.set(name, running);
                        log.info("browser launched on demand", {
                            profile: name,
                            cdp_url: resolvedProfile.cdpUrl,
                            cdp_port: resolvedProfile.cdpPort,
                        });
                    }
                    if (targetId) {
                        // Validate it exists
                        // We can use listPagesViaPlaywright
                        const pages = await (0, pw_session_js_1.listPagesViaPlaywright)({ cdpUrl: resolvedProfile.cdpUrl });
                        const found = pages.find(p => p.targetId === targetId);
                        if (found) {
                            await (0, pw_session_js_1.focusPageByTargetIdViaPlaywright)({ cdpUrl: resolvedProfile.cdpUrl, targetId });
                            log.info("target focused", {
                                profile: name,
                                target_id: targetId,
                                url: found.url,
                                duration_ms: Date.now() - startedAt,
                            });
                            return { targetId, url: found.url };
                        }
                        log.warn("target not found", { profile: name, target_id: targetId });
                        throw new Error(`Target ${targetId} not found`);
                    }
                    // No targetId, check for any page
                    const pages = await (0, pw_session_js_1.listPagesViaPlaywright)({ cdpUrl: resolvedProfile.cdpUrl });
                    if (pages.length > 0) {
                        const first = pages[0];
                        await (0, pw_session_js_1.focusPageByTargetIdViaPlaywright)({ cdpUrl: resolvedProfile.cdpUrl, targetId: first.targetId });
                        log.debug("reusing existing tab", {
                            profile: name,
                            target_id: first.targetId,
                            url: first.url,
                            duration_ms: Date.now() - startedAt,
                        });
                        return { targetId: first.targetId, url: first.url };
                    }
                    // Create new page
                    const created = await (0, pw_session_js_1.createPageViaPlaywright)({ cdpUrl: resolvedProfile.cdpUrl, url: "about:blank" });
                    log.info("created new tab", {
                        profile: name,
                        target_id: created.targetId,
                        url: created.url,
                        duration_ms: Date.now() - startedAt,
                    });
                    return { targetId: created.targetId, url: created.url };
                },
                async stopRunningBrowser() {
                    const running = s.profiles.get(name);
                    if (running && running.chrome) {
                        log.info("stopping running browser", {
                            profile: name,
                            pid: running.chrome.pid,
                            cdp_port: running.chrome.cdpPort,
                        });
                        await (0, chrome_js_1.stopOpenClawChrome)(running.chrome);
                        running.chrome = undefined;
                    }
                }
            };
        },
        mapTabError(err) {
            // Simple error mapping
            const msg = err instanceof Error ? err.message : String(err);
            log.warn("mapping tab error", { message: msg });
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
