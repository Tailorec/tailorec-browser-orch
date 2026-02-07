"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.armFileUploadViaPlaywright = armFileUploadViaPlaywright;
exports.armDialogViaPlaywright = armDialogViaPlaywright;
exports.waitForDownloadViaPlaywright = waitForDownloadViaPlaywright;
exports.downloadViaPlaywright = downloadViaPlaywright;
const node_crypto_1 = __importDefault(require("node:crypto"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const pw_session_js_1 = require("./pw-session.js");
const pw_tools_core_shared_js_1 = require("./pw-tools-core.shared.js");
const subsystem_js_1 = require("../logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("pw-downloads");
function buildTempDownloadPath(fileName) {
    const id = node_crypto_1.default.randomUUID();
    const safeName = fileName.trim() ? fileName.trim() : "download.bin";
    return node_path_1.default.join("/tmp/openclaw/downloads", `${id}-${safeName}`);
}
function createPageDownloadWaiter(page, timeoutMs) {
    let done = false;
    let timer;
    let handler;
    const cleanup = () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = undefined;
        if (handler) {
            page.off("download", handler);
            handler = undefined;
        }
    };
    const promise = new Promise((resolve, reject) => {
        handler = (download) => {
            if (done) {
                return;
            }
            done = true;
            cleanup();
            resolve(download);
        };
        page.on("download", handler);
        timer = setTimeout(() => {
            if (done) {
                return;
            }
            done = true;
            cleanup();
            reject(new Error("Timeout waiting for download"));
        }, timeoutMs);
    });
    return {
        promise,
        cancel: () => {
            if (done) {
                return;
            }
            done = true;
            cleanup();
        },
    };
}
async function armFileUploadViaPlaywright(opts) {
    const started = Date.now();
    log.info("arm file upload started", {
        cdp_url: opts.cdpUrl,
        target_id: opts.targetId,
        paths_count: opts.paths?.length ?? 0,
        timeout_ms: opts.timeoutMs,
    });
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    const timeout = Math.max(500, Math.min(120_000, opts.timeoutMs ?? 120_000));
    state.armIdUpload = (0, pw_tools_core_shared_js_1.bumpUploadArmId)();
    const armId = state.armIdUpload;
    void page
        .waitForEvent("filechooser", { timeout })
        .then(async (fileChooser) => {
        if (state.armIdUpload !== armId) {
            return;
        }
        if (!opts.paths?.length) {
            // Playwright removed `FileChooser.cancel()`; best-effort close the chooser instead.
            try {
                await page.keyboard.press("Escape");
            }
            catch {
                // Best-effort.
            }
            return;
        }
        await fileChooser.setFiles(opts.paths);
        try {
            const input = typeof fileChooser.element === "function"
                ? await Promise.resolve(fileChooser.element())
                : null;
            if (input) {
                await input.evaluate((el) => {
                    el.dispatchEvent(new Event("input", { bubbles: true }));
                    el.dispatchEvent(new Event("change", { bubbles: true }));
                });
            }
        }
        catch {
            // Best-effort for sites that don't react to setFiles alone.
        }
    })
        .catch(() => {
        // Ignore timeouts; the chooser may never appear.
    });
    log.info("arm file upload registered", { cdp_url: opts.cdpUrl, target_id: opts.targetId, duration_ms: Date.now() - started });
}
async function armDialogViaPlaywright(opts) {
    const started = Date.now();
    log.info("arm dialog started", { cdp_url: opts.cdpUrl, target_id: opts.targetId, accept: opts.accept, timeout_ms: opts.timeoutMs });
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    const timeout = (0, pw_tools_core_shared_js_1.normalizeTimeoutMs)(opts.timeoutMs, 120_000);
    state.armIdDialog = (0, pw_tools_core_shared_js_1.bumpDialogArmId)();
    const armId = state.armIdDialog;
    void page
        .waitForEvent("dialog", { timeout })
        .then(async (dialog) => {
        if (state.armIdDialog !== armId) {
            return;
        }
        if (opts.accept) {
            await dialog.accept(opts.promptText);
        }
        else {
            await dialog.dismiss();
        }
    })
        .catch(() => {
        // Ignore timeouts; the dialog may never appear.
    });
    log.info("arm dialog registered", { cdp_url: opts.cdpUrl, target_id: opts.targetId, duration_ms: Date.now() - started });
}
async function waitForDownloadViaPlaywright(opts) {
    const started = Date.now();
    log.info("wait for download started", { cdp_url: opts.cdpUrl, target_id: opts.targetId, timeout_ms: opts.timeoutMs, path: opts.path });
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    const timeout = (0, pw_tools_core_shared_js_1.normalizeTimeoutMs)(opts.timeoutMs, 120_000);
    state.armIdDownload = (0, pw_tools_core_shared_js_1.bumpDownloadArmId)();
    const armId = state.armIdDownload;
    const waiter = createPageDownloadWaiter(page, timeout);
    try {
        const download = (await waiter.promise);
        if (state.armIdDownload !== armId) {
            throw new Error("Download was superseded by another waiter");
        }
        const suggested = download.suggestedFilename?.() || "download.bin";
        const outPath = opts.path?.trim() || buildTempDownloadPath(suggested);
        await promises_1.default.mkdir(node_path_1.default.dirname(outPath), { recursive: true });
        await download.saveAs?.(outPath);
        const result = {
            url: download.url?.() || "",
            suggestedFilename: suggested,
            path: node_path_1.default.resolve(outPath),
        };
        log.info("wait for download succeeded", {
            cdp_url: opts.cdpUrl,
            target_id: opts.targetId,
            path: result.path,
            suggested_filename: result.suggestedFilename,
            duration_ms: Date.now() - started,
        });
        return result;
    }
    catch (err) {
        waiter.cancel();
        log.exception("wait for download failed", err, { cdp_url: opts.cdpUrl, target_id: opts.targetId, duration_ms: Date.now() - started });
        throw err;
    }
}
async function downloadViaPlaywright(opts) {
    const started = Date.now();
    log.info("download action started", { cdp_url: opts.cdpUrl, target_id: opts.targetId, ref: opts.ref, path: opts.path });
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    const state = (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    const timeout = (0, pw_tools_core_shared_js_1.normalizeTimeoutMs)(opts.timeoutMs, 120_000);
    const ref = (0, pw_tools_core_shared_js_1.requireRef)(opts.ref);
    const outPath = String(opts.path ?? "").trim();
    if (!outPath) {
        throw new Error("path is required");
    }
    state.armIdDownload = (0, pw_tools_core_shared_js_1.bumpDownloadArmId)();
    const armId = state.armIdDownload;
    const waiter = createPageDownloadWaiter(page, timeout);
    try {
        const locator = (0, pw_session_js_1.refLocator)(page, ref);
        try {
            await locator.click({ timeout });
        }
        catch (err) {
            throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
        }
        const download = (await waiter.promise);
        if (state.armIdDownload !== armId) {
            throw new Error("Download was superseded by another waiter");
        }
        const suggested = download.suggestedFilename?.() || "download.bin";
        await promises_1.default.mkdir(node_path_1.default.dirname(outPath), { recursive: true });
        await download.saveAs?.(outPath);
        const result = {
            url: download.url?.() || "",
            suggestedFilename: suggested,
            path: node_path_1.default.resolve(outPath),
        };
        log.info("download action succeeded", {
            cdp_url: opts.cdpUrl,
            target_id: opts.targetId,
            ref,
            path: result.path,
            suggested_filename: result.suggestedFilename,
            duration_ms: Date.now() - started,
        });
        return result;
    }
    catch (err) {
        waiter.cancel();
        log.exception("download action failed", err, { cdp_url: opts.cdpUrl, target_id: opts.targetId, ref: opts.ref, duration_ms: Date.now() - started });
        throw err;
    }
}
