"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELECTOR_UNSUPPORTED_MESSAGE = void 0;
exports.readBody = readBody;
exports.handleRouteError = handleRouteError;
exports.resolveProfileContext = resolveProfileContext;
exports.getPwAiModule = getPwAiModule;
exports.requirePwAi = requirePwAi;
const pw_ai_module_js_1 = require("../pw-ai-module.js");
const utils_js_1 = require("./utils.js");
const subsystem_js_1 = require("../../logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("agent-shared");
exports.SELECTOR_UNSUPPORTED_MESSAGE = [
    "Error: 'selector' is not supported. Use 'ref' from snapshot instead.",
    "",
    "Example workflow:",
    "1. snapshot action to get page state with refs",
    '2. act with ref: "e123" to interact with element',
    "",
    "This is more reliable for modern SPAs.",
].join("\n");
function readBody(req) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return {};
    }
    return body;
}
function handleRouteError(ctx, res, err) {
    const mapped = ctx.mapTabError(err);
    if (mapped) {
        log.warn("route error mapped", { status: mapped.status, message: mapped.message });
        return (0, utils_js_1.jsonError)(res, mapped.status, mapped.message);
    }
    log.exception("route error unmapped", err);
    (0, utils_js_1.jsonError)(res, 500, String(err));
}
function resolveProfileContext(req, res, ctx) {
    const result = (0, utils_js_1.getProfileContext)(req, ctx);
    if ("error" in result) { // Check if it's the error object
        log.warn("profile context resolution failed", { status: result.status, error: result.error });
        (0, utils_js_1.jsonError)(res, result.status, result.error);
        return null;
    }
    log.debug("profile context resolved", { profile: result.profile.name });
    return result;
}
async function getPwAiModule() {
    return await (0, pw_ai_module_js_1.getPwAiModule)();
}
async function requirePwAi(res, feature) {
    const mod = await getPwAiModule();
    if (mod) {
        return mod;
    }
    (0, utils_js_1.jsonError)(res, 501, [
        `Playwright is not available in this gateway build; '${feature}' is unsupported.`,
        "Install the full Playwright package (not playwright-core) and restart the gateway, or reinstall with browser support.",
        "Docs: /tools/browser#playwright-requirement",
    ].join("\n"));
    return null;
}
