"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bumpUploadArmId = bumpUploadArmId;
exports.bumpDialogArmId = bumpDialogArmId;
exports.bumpDownloadArmId = bumpDownloadArmId;
exports.requireRef = requireRef;
exports.normalizeTimeoutMs = normalizeTimeoutMs;
exports.toAIFriendlyError = toAIFriendlyError;
const pw_role_snapshot_js_1 = require("./pw-role-snapshot.js");
let nextUploadArmId = 0;
let nextDialogArmId = 0;
let nextDownloadArmId = 0;
function bumpUploadArmId() {
    nextUploadArmId += 1;
    return nextUploadArmId;
}
function bumpDialogArmId() {
    nextDialogArmId += 1;
    return nextDialogArmId;
}
function bumpDownloadArmId() {
    nextDownloadArmId += 1;
    return nextDownloadArmId;
}
function requireRef(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    const roleRef = raw ? (0, pw_role_snapshot_js_1.parseRoleRef)(raw) : null;
    const ref = roleRef ?? (raw.startsWith("@") ? raw.slice(1) : raw);
    if (!ref) {
        throw new Error("ref is required");
    }
    return ref;
}
function normalizeTimeoutMs(timeoutMs, fallback) {
    return Math.max(500, Math.min(120_000, timeoutMs ?? fallback));
}
function toAIFriendlyError(error, selector) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("strict mode violation")) {
        const countMatch = message.match(/resolved to (\d+) elements/);
        const count = countMatch ? countMatch[1] : "multiple";
        return new Error(`Selector "${selector}" matched ${count} elements. ` +
            `Run a new snapshot to get updated refs, or use a different ref.`);
    }
    if ((message.includes("Timeout") || message.includes("waiting for")) &&
        (message.includes("to be visible") || message.includes("not visible"))) {
        return new Error(`Element "${selector}" not found or not visible. ` +
            `Run a new snapshot to see current page elements.`);
    }
    if (message.includes("intercepts pointer events") ||
        message.includes("not visible") ||
        message.includes("not receive pointer events")) {
        return new Error(`Element "${selector}" is not interactable (hidden or covered). ` +
            `Try scrolling it into view, closing overlays, or re-snapshotting.`);
    }
    return error instanceof Error ? error : new Error(message);
}
