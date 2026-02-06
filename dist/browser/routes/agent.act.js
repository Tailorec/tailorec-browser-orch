"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBrowserAgentActRoutes = registerBrowserAgentActRoutes;
const agent_act_shared_js_1 = require("./agent.act.shared.js");
const agent_shared_js_1 = require("./agent.shared.js");
const utils_js_1 = require("./utils.js");
const pw_ai_module_js_1 = require("../pw-ai-module.js");
function registerBrowserAgentActRoutes(app, ctx) {
    app.post("/act", async (req, res) => {
        const profileCtx = (0, agent_shared_js_1.resolveProfileContext)(req, res, ctx);
        if (!profileCtx) {
            return;
        }
        const body = (0, agent_shared_js_1.readBody)(req);
        const kindRaw = (0, utils_js_1.toStringOrEmpty)(body.kind);
        if (!(0, agent_act_shared_js_1.isActKind)(kindRaw)) {
            return (0, utils_js_1.jsonError)(res, 400, "kind is required");
        }
        const kind = kindRaw;
        const targetId = (0, utils_js_1.toStringOrEmpty)(body.targetId) || undefined;
        if (Object.hasOwn(body, "selector") && kind !== "wait") {
            return (0, utils_js_1.jsonError)(res, 400, agent_shared_js_1.SELECTOR_UNSUPPORTED_MESSAGE);
        }
        try {
            const tab = await profileCtx.ensureTabAvailable(targetId);
            const cdpUrl = profileCtx.profile.cdpUrl;
            const pw = await (0, pw_ai_module_js_1.getPwAiModule)();
            const evaluateEnabled = ctx.state().resolved.evaluateEnabled;
            switch (kind) {
                case "click": {
                    const ref = (0, utils_js_1.toStringOrEmpty)(body.ref);
                    if (!ref) {
                        return (0, utils_js_1.jsonError)(res, 400, "ref is required");
                    }
                    const doubleClick = (0, utils_js_1.toBoolean)(body.doubleClick) ?? false;
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
                    const buttonRaw = (0, utils_js_1.toStringOrEmpty)(body.button) || "";
                    const button = buttonRaw ? (0, agent_act_shared_js_1.parseClickButton)(buttonRaw) : undefined;
                    if (buttonRaw && !button) {
                        return (0, utils_js_1.jsonError)(res, 400, "button must be left|right|middle");
                    }
                    const modifiersRaw = (0, utils_js_1.toStringArray)(body.modifiers) ?? [];
                    const parsedModifiers = (0, agent_act_shared_js_1.parseClickModifiers)(modifiersRaw);
                    if (parsedModifiers.error) {
                        return (0, utils_js_1.jsonError)(res, 400, parsedModifiers.error);
                    }
                    const modifiers = parsedModifiers.modifiers;
                    const clickRequest = {
                        cdpUrl,
                        targetId: tab.targetId,
                        ref,
                        doubleClick,
                    };
                    if (button) {
                        clickRequest.button = button;
                    }
                    if (modifiers) {
                        clickRequest.modifiers = modifiers;
                    }
                    if (timeoutMs) {
                        clickRequest.timeoutMs = timeoutMs;
                    }
                    await pw.clickViaPlaywright(clickRequest);
                    return res.json({ ok: true, targetId: tab.targetId, url: tab.url });
                }
                case "type": {
                    const ref = (0, utils_js_1.toStringOrEmpty)(body.ref);
                    if (!ref) {
                        return (0, utils_js_1.jsonError)(res, 400, "ref is required");
                    }
                    if (typeof body.text !== "string") {
                        return (0, utils_js_1.jsonError)(res, 400, "text is required");
                    }
                    const text = body.text;
                    const submit = (0, utils_js_1.toBoolean)(body.submit) ?? false;
                    const slowly = (0, utils_js_1.toBoolean)(body.slowly) ?? false;
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
                    const typeRequest = {
                        cdpUrl,
                        targetId: tab.targetId,
                        ref,
                        text,
                        submit,
                        slowly,
                    };
                    if (timeoutMs) {
                        typeRequest.timeoutMs = timeoutMs;
                    }
                    await pw.typeViaPlaywright(typeRequest);
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                case "press": {
                    const key = (0, utils_js_1.toStringOrEmpty)(body.key);
                    if (!key) {
                        return (0, utils_js_1.jsonError)(res, 400, "key is required");
                    }
                    const delayMs = (0, utils_js_1.toNumber)(body.delayMs);
                    await pw.pressKeyViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        key,
                        delayMs: delayMs ?? undefined,
                    });
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                case "hover": {
                    const ref = (0, utils_js_1.toStringOrEmpty)(body.ref);
                    if (!ref) {
                        return (0, utils_js_1.jsonError)(res, 400, "ref is required");
                    }
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
                    await pw.hoverViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        ref,
                        timeoutMs: timeoutMs ?? undefined,
                    });
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                case "scrollIntoView": {
                    const ref = (0, utils_js_1.toStringOrEmpty)(body.ref);
                    if (!ref) {
                        return (0, utils_js_1.jsonError)(res, 400, "ref is required");
                    }
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
                    const scrollRequest = {
                        cdpUrl,
                        targetId: tab.targetId,
                        ref,
                    };
                    if (timeoutMs) {
                        scrollRequest.timeoutMs = timeoutMs;
                    }
                    await pw.scrollIntoViewViaPlaywright(scrollRequest);
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                case "drag": {
                    const startRef = (0, utils_js_1.toStringOrEmpty)(body.startRef);
                    const endRef = (0, utils_js_1.toStringOrEmpty)(body.endRef);
                    if (!startRef || !endRef) {
                        return (0, utils_js_1.jsonError)(res, 400, "startRef and endRef are required");
                    }
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
                    await pw.dragViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        startRef,
                        endRef,
                        timeoutMs: timeoutMs ?? undefined,
                    });
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                case "select": {
                    const ref = (0, utils_js_1.toStringOrEmpty)(body.ref);
                    const values = (0, utils_js_1.toStringArray)(body.values);
                    if (!ref || !values?.length) {
                        return (0, utils_js_1.jsonError)(res, 400, "ref and values are required");
                    }
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
                    await pw.selectOptionViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        ref,
                        values,
                        timeoutMs: timeoutMs ?? undefined,
                    });
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                case "fill": {
                    const rawFields = Array.isArray(body.fields) ? body.fields : [];
                    const fields = rawFields
                        .map((field) => {
                        if (!field || typeof field !== "object") {
                            return null;
                        }
                        const rec = field;
                        const ref = (0, utils_js_1.toStringOrEmpty)(rec.ref);
                        const type = (0, utils_js_1.toStringOrEmpty)(rec.type);
                        if (!ref || !type) {
                            return null;
                        }
                        const value = typeof rec.value === "string" ||
                            typeof rec.value === "number" ||
                            typeof rec.value === "boolean"
                            ? rec.value
                            : undefined;
                        const parsed = value === undefined ? { ref, type } : { ref, type, value };
                        return parsed;
                    })
                        .filter((field) => field !== null);
                    if (!fields.length) {
                        return (0, utils_js_1.jsonError)(res, 400, "fields are required");
                    }
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
                    await pw.fillFormViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        fields,
                        timeoutMs: timeoutMs ?? undefined,
                    });
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                case "resize": {
                    const width = (0, utils_js_1.toNumber)(body.width);
                    const height = (0, utils_js_1.toNumber)(body.height);
                    if (!width || !height) {
                        return (0, utils_js_1.jsonError)(res, 400, "width and height are required");
                    }
                    await pw.resizeViewportViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        width,
                        height,
                    });
                    return res.json({ ok: true, targetId: tab.targetId, url: tab.url });
                }
                case "wait": {
                    const timeMs = (0, utils_js_1.toNumber)(body.timeMs);
                    const text = (0, utils_js_1.toStringOrEmpty)(body.text) || undefined;
                    const textGone = (0, utils_js_1.toStringOrEmpty)(body.textGone) || undefined;
                    const selector = (0, utils_js_1.toStringOrEmpty)(body.selector) || undefined;
                    const url = (0, utils_js_1.toStringOrEmpty)(body.url) || undefined;
                    const loadStateRaw = (0, utils_js_1.toStringOrEmpty)(body.loadState);
                    const loadState = loadStateRaw === "load" ||
                        loadStateRaw === "domcontentloaded" ||
                        loadStateRaw === "networkidle"
                        ? loadStateRaw
                        : undefined;
                    const fn = (0, utils_js_1.toStringOrEmpty)(body.fn) || undefined;
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs) ?? undefined;
                    if (fn && !evaluateEnabled) {
                        return (0, utils_js_1.jsonError)(res, 403, [
                            "wait --fn is disabled by config (browser.evaluateEnabled=false).",
                            "Docs: /gateway/configuration#browser-openclaw-managed-browser",
                        ].join("\n"));
                    }
                    if (timeMs === undefined &&
                        !text &&
                        !textGone &&
                        !selector &&
                        !url &&
                        !loadState &&
                        !fn) {
                        return (0, utils_js_1.jsonError)(res, 400, "wait requires at least one of: timeMs, text, textGone, selector, url, loadState, fn");
                    }
                    await pw.waitForViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        timeMs,
                        text,
                        textGone,
                        selector,
                        url,
                        loadState,
                        fn,
                        timeoutMs,
                    });
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                case "evaluate": {
                    if (!evaluateEnabled) {
                        return (0, utils_js_1.jsonError)(res, 403, [
                            "act:evaluate is disabled by config (browser.evaluateEnabled=false).",
                            "Docs: /gateway/configuration#browser-openclaw-managed-browser",
                        ].join("\n"));
                    }
                    const fn = (0, utils_js_1.toStringOrEmpty)(body.fn);
                    if (!fn) {
                        return (0, utils_js_1.jsonError)(res, 400, "fn is required");
                    }
                    const ref = (0, utils_js_1.toStringOrEmpty)(body.ref) || undefined;
                    const result = await pw.evaluateViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        fn,
                        ref,
                    });
                    return res.json({
                        ok: true,
                        targetId: tab.targetId,
                        url: tab.url,
                        result,
                    });
                }
                case "navigate": {
                    const url = (0, utils_js_1.toStringOrEmpty)(body.url);
                    if (!url) {
                        return (0, utils_js_1.jsonError)(res, 400, "url is required");
                    }
                    const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
                    const result = await pw.navigateViaPlaywright({
                        cdpUrl,
                        targetId: tab.targetId,
                        url,
                        timeoutMs,
                    });
                    return res.json({ ok: true, targetId: tab.targetId, url: result.url });
                }
                case "close": {
                    await pw.closePageViaPlaywright({ cdpUrl, targetId: tab.targetId });
                    return res.json({ ok: true, targetId: tab.targetId });
                }
                default: {
                    return (0, utils_js_1.jsonError)(res, 400, "unsupported kind");
                }
            }
        }
        catch (err) {
            (0, agent_shared_js_1.handleRouteError)(ctx, res, err);
        }
    });
    app.post("/hooks/file-chooser", async (req, res) => {
        const profileCtx = (0, agent_shared_js_1.resolveProfileContext)(req, res, ctx);
        if (!profileCtx) {
            return;
        }
        const body = (0, agent_shared_js_1.readBody)(req);
        const targetId = (0, utils_js_1.toStringOrEmpty)(body.targetId) || undefined;
        const ref = (0, utils_js_1.toStringOrEmpty)(body.ref) || undefined;
        const inputRef = (0, utils_js_1.toStringOrEmpty)(body.inputRef) || undefined;
        const element = (0, utils_js_1.toStringOrEmpty)(body.element) || undefined;
        const paths = (0, utils_js_1.toStringArray)(body.paths) ?? [];
        const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
        if (!paths.length) {
            return (0, utils_js_1.jsonError)(res, 400, "paths are required");
        }
        try {
            const tab = await profileCtx.ensureTabAvailable(targetId);
            const pw = await (0, pw_ai_module_js_1.getPwAiModule)();
            if (inputRef || element) {
                if (ref) {
                    return (0, utils_js_1.jsonError)(res, 400, "ref cannot be combined with inputRef/element");
                }
                await pw.setInputFilesViaPlaywright({
                    cdpUrl: profileCtx.profile.cdpUrl,
                    targetId: tab.targetId,
                    inputRef,
                    element,
                    paths,
                });
            }
            else {
                await pw.armFileUploadViaPlaywright({
                    cdpUrl: profileCtx.profile.cdpUrl,
                    targetId: tab.targetId,
                    paths,
                    timeoutMs: timeoutMs ?? undefined,
                });
                if (ref) {
                    await pw.clickViaPlaywright({
                        cdpUrl: profileCtx.profile.cdpUrl,
                        targetId: tab.targetId,
                        ref,
                    });
                }
            }
            res.json({ ok: true });
        }
        catch (err) {
            (0, agent_shared_js_1.handleRouteError)(ctx, res, err);
        }
    });
    app.post("/hooks/dialog", async (req, res) => {
        const profileCtx = (0, agent_shared_js_1.resolveProfileContext)(req, res, ctx);
        if (!profileCtx) {
            return;
        }
        const body = (0, agent_shared_js_1.readBody)(req);
        const targetId = (0, utils_js_1.toStringOrEmpty)(body.targetId) || undefined;
        const accept = (0, utils_js_1.toBoolean)(body.accept);
        const promptText = (0, utils_js_1.toStringOrEmpty)(body.promptText) || undefined;
        const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
        if (accept === undefined) {
            return (0, utils_js_1.jsonError)(res, 400, "accept is required");
        }
        try {
            const tab = await profileCtx.ensureTabAvailable(targetId);
            const pw = await (0, pw_ai_module_js_1.getPwAiModule)();
            await pw.armDialogViaPlaywright({
                cdpUrl: profileCtx.profile.cdpUrl,
                targetId: tab.targetId,
                accept,
                promptText,
                timeoutMs: timeoutMs ?? undefined,
            });
            res.json({ ok: true });
        }
        catch (err) {
            (0, agent_shared_js_1.handleRouteError)(ctx, res, err);
        }
    });
    app.post("/wait/download", async (req, res) => {
        const profileCtx = (0, agent_shared_js_1.resolveProfileContext)(req, res, ctx);
        if (!profileCtx) {
            return;
        }
        const body = (0, agent_shared_js_1.readBody)(req);
        const targetId = (0, utils_js_1.toStringOrEmpty)(body.targetId) || undefined;
        const out = (0, utils_js_1.toStringOrEmpty)(body.path) || undefined;
        const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
        try {
            const tab = await profileCtx.ensureTabAvailable(targetId);
            const pw = await (0, pw_ai_module_js_1.getPwAiModule)();
            const result = await pw.waitForDownloadViaPlaywright({
                cdpUrl: profileCtx.profile.cdpUrl,
                targetId: tab.targetId,
                path: out,
                timeoutMs: timeoutMs ?? undefined,
            });
            res.json({ ok: true, targetId: tab.targetId, download: result });
        }
        catch (err) {
            (0, agent_shared_js_1.handleRouteError)(ctx, res, err);
        }
    });
    app.post("/download", async (req, res) => {
        const profileCtx = (0, agent_shared_js_1.resolveProfileContext)(req, res, ctx);
        if (!profileCtx) {
            return;
        }
        const body = (0, agent_shared_js_1.readBody)(req);
        const targetId = (0, utils_js_1.toStringOrEmpty)(body.targetId) || undefined;
        const ref = (0, utils_js_1.toStringOrEmpty)(body.ref);
        const out = (0, utils_js_1.toStringOrEmpty)(body.path);
        const timeoutMs = (0, utils_js_1.toNumber)(body.timeoutMs);
        if (!ref) {
            return (0, utils_js_1.jsonError)(res, 400, "ref is required");
        }
        if (!out) {
            return (0, utils_js_1.jsonError)(res, 400, "path is required");
        }
        try {
            const tab = await profileCtx.ensureTabAvailable(targetId);
            const pw = await (0, pw_ai_module_js_1.getPwAiModule)();
            const result = await pw.downloadViaPlaywright({
                cdpUrl: profileCtx.profile.cdpUrl,
                targetId: tab.targetId,
                ref,
                path: out,
                timeoutMs: timeoutMs ?? undefined,
            });
            res.json({ ok: true, targetId: tab.targetId, download: result });
        }
        catch (err) {
            (0, agent_shared_js_1.handleRouteError)(ctx, res, err);
        }
    });
    app.post("/highlight", async (req, res) => {
        const profileCtx = (0, agent_shared_js_1.resolveProfileContext)(req, res, ctx);
        if (!profileCtx) {
            return;
        }
        const body = (0, agent_shared_js_1.readBody)(req);
        const targetId = (0, utils_js_1.toStringOrEmpty)(body.targetId) || undefined;
        const ref = (0, utils_js_1.toStringOrEmpty)(body.ref);
        if (!ref) {
            return (0, utils_js_1.jsonError)(res, 400, "ref is required");
        }
        try {
            const tab = await profileCtx.ensureTabAvailable(targetId);
            const pw = await (0, pw_ai_module_js_1.getPwAiModule)();
            await pw.highlightViaPlaywright({
                cdpUrl: profileCtx.profile.cdpUrl,
                targetId: tab.targetId,
                ref,
            });
            res.json({ ok: true, targetId: tab.targetId });
        }
        catch (err) {
            (0, agent_shared_js_1.handleRouteError)(ctx, res, err);
        }
    });
}
