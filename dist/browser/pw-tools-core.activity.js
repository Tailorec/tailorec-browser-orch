"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPageErrorsViaPlaywright = getPageErrorsViaPlaywright;
exports.getNetworkRequestsViaPlaywright = getNetworkRequestsViaPlaywright;
exports.getConsoleMessagesViaPlaywright = getConsoleMessagesViaPlaywright;
const pw_session_js_1 = require("./pw-session.js");
const subsystem_js_1 = require("../logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("pw-activity");
async function getPageErrorsViaPlaywright(opts) {
    const started = Date.now();
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    const errors = [...state.errors];
    if (opts.clear) {
        state.errors = [];
    }
    log.debug("retrieved page errors", {
        cdp_url: opts.cdpUrl,
        target_id: opts.targetId,
        clear: Boolean(opts.clear),
        count: errors.length,
        duration_ms: Date.now() - started,
    });
    return { errors };
}
async function getNetworkRequestsViaPlaywright(opts) {
    const started = Date.now();
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    const raw = [...state.requests];
    const filter = typeof opts.filter === "string" ? opts.filter.trim() : "";
    const requests = filter ? raw.filter((r) => r.url.includes(filter)) : raw;
    if (opts.clear) {
        state.requests = [];
        state.requestIds = new WeakMap();
    }
    log.debug("retrieved network requests", {
        cdp_url: opts.cdpUrl,
        target_id: opts.targetId,
        clear: Boolean(opts.clear),
        filter: filter || undefined,
        count: requests.length,
        duration_ms: Date.now() - started,
    });
    return { requests };
}
function consolePriority(level) {
    switch (level) {
        case "error":
            return 3;
        case "warning":
            return 2;
        case "info":
        case "log":
            return 1;
        case "debug":
            return 0;
        default:
            return 1;
    }
}
async function getConsoleMessagesViaPlaywright(opts) {
    const started = Date.now();
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    if (!opts.level) {
        const all = [...state.console];
        log.debug("retrieved console messages", {
            cdp_url: opts.cdpUrl,
            target_id: opts.targetId,
            level: opts.level,
            count: all.length,
            duration_ms: Date.now() - started,
        });
        return all;
    }
    const min = consolePriority(opts.level);
    const filtered = state.console.filter((msg) => consolePriority(msg.type) >= min);
    log.debug("retrieved console messages", {
        cdp_url: opts.cdpUrl,
        target_id: opts.targetId,
        level: opts.level,
        count: filtered.length,
        duration_ms: Date.now() - started,
    });
    return filtered;
}
