"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPageErrorsViaPlaywright = getPageErrorsViaPlaywright;
exports.getNetworkRequestsViaPlaywright = getNetworkRequestsViaPlaywright;
exports.getConsoleMessagesViaPlaywright = getConsoleMessagesViaPlaywright;
const pw_session_js_1 = require("./pw-session.js");
async function getPageErrorsViaPlaywright(opts) {
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    const errors = [...state.errors];
    if (opts.clear) {
        state.errors = [];
    }
    return { errors };
}
async function getNetworkRequestsViaPlaywright(opts) {
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    const raw = [...state.requests];
    const filter = typeof opts.filter === "string" ? opts.filter.trim() : "";
    const requests = filter ? raw.filter((r) => r.url.includes(filter)) : raw;
    if (opts.clear) {
        state.requests = [];
        state.requestIds = new WeakMap();
    }
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
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    if (!opts.level) {
        return [...state.console];
    }
    const min = consolePriority(opts.level);
    return state.console.filter((msg) => consolePriority(msg.type) >= min);
}
