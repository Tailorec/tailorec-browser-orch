"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonError = jsonError;
exports.toStringOrEmpty = toStringOrEmpty;
exports.toBoolean = toBoolean;
exports.toNumber = toNumber;
exports.toStringArray = toStringArray;
exports.getProfileContext = getProfileContext;
const subsystem_js_1 = require("../../logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("browser-routes");
function jsonError(res, status, messageOrError) {
    const message = messageOrError instanceof Error
        ? messageOrError.message
        : typeof messageOrError === "string"
            ? messageOrError
            : String(messageOrError);
    if (status >= 500) {
        log.error(`HTTP ${status}: ${message}`);
    }
    else {
        log.warn(`HTTP ${status}: ${message}`);
    }
    res.status(status).json({ ok: false, error: message });
}
function toStringOrEmpty(val) {
    if (typeof val === "string") {
        return val.trim();
    }
    return "";
}
function toBoolean(val) {
    if (typeof val === "boolean") {
        return val;
    }
    if (val === "true" || val === "1" || val === 1) {
        return true;
    }
    if (val === "false" || val === "0" || val === 0) {
        return false;
    }
    return undefined;
}
function toNumber(val) {
    if (typeof val === "number") {
        return val;
    }
    if (typeof val === "string") {
        const n = Number(val);
        if (Number.isFinite(n)) {
            return n;
        }
    }
    return undefined;
}
function toStringArray(val) {
    if (Array.isArray(val)) {
        return val.map((v) => String(v));
    }
    return undefined;
}
function getProfileContext(req, ctx) {
    // In OpenClaw, profile is passed in query or defaults to "default"
    // Tailorec will likely use "default" or separate profiles per job/worker
    const profileName = toStringOrEmpty(req.query.profile) || "default";
    try {
        return ctx.forProfile(profileName);
    }
    catch (err) {
        return { status: 404, error: String(err) };
    }
}
