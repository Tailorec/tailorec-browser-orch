"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.highlightViaPlaywright = highlightViaPlaywright;
exports.clickViaPlaywright = clickViaPlaywright;
exports.hoverViaPlaywright = hoverViaPlaywright;
exports.dragViaPlaywright = dragViaPlaywright;
exports.selectOptionViaPlaywright = selectOptionViaPlaywright;
exports.pressKeyViaPlaywright = pressKeyViaPlaywright;
exports.typeViaPlaywright = typeViaPlaywright;
exports.fillFormViaPlaywright = fillFormViaPlaywright;
exports.evaluateViaPlaywright = evaluateViaPlaywright;
exports.scrollIntoViewViaPlaywright = scrollIntoViewViaPlaywright;
exports.waitForViaPlaywright = waitForViaPlaywright;
exports.takeScreenshotViaPlaywright = takeScreenshotViaPlaywright;
exports.screenshotWithLabelsViaPlaywright = screenshotWithLabelsViaPlaywright;
exports.setInputFilesViaPlaywright = setInputFilesViaPlaywright;
const pw_session_js_1 = require("./pw-session.js");
const pw_tools_core_shared_js_1 = require("./pw-tools-core.shared.js");
const subsystem_js_1 = require("../logging/subsystem.js");
const log = (0, subsystem_js_1.createSubsystemLogger)("pw-actions");
function actionMeta(opts, extra) {
    return { target_id: opts.targetId, cdp_url: opts.cdpUrl, ...(extra || {}) };
}
async function highlightViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action highlight started", actionMeta(opts, { ref: opts.ref }));
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    const ref = (0, pw_tools_core_shared_js_1.requireRef)(opts.ref);
    try {
        await (0, pw_session_js_1.refLocator)(page, ref).highlight();
        log.debug("action highlight succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    }
    catch (err) {
        log.exception("action highlight failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
        throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
    }
}
async function clickViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action click started", actionMeta(opts, { ref: opts.ref, double_click: opts.doubleClick }));
    const page = await (0, pw_session_js_1.getPageForTargetId)({
        cdpUrl: opts.cdpUrl,
        targetId: opts.targetId,
    });
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    const ref = (0, pw_tools_core_shared_js_1.requireRef)(opts.ref);
    const locator = (0, pw_session_js_1.refLocator)(page, ref);
    const timeout = Math.max(500, Math.min(60_000, Math.floor(opts.timeoutMs ?? 8000)));
    try {
        if (opts.doubleClick) {
            await locator.dblclick({
                timeout,
                button: opts.button,
                modifiers: opts.modifiers,
            });
        }
        else {
            await locator.click({
                timeout,
                button: opts.button,
                modifiers: opts.modifiers,
            });
        }
        log.info("action click succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    }
    catch (err) {
        log.exception("action click failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
        throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
    }
}
async function hoverViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action hover started", actionMeta(opts, { ref: opts.ref }));
    const ref = (0, pw_tools_core_shared_js_1.requireRef)(opts.ref);
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    try {
        await (0, pw_session_js_1.refLocator)(page, ref).hover({
            timeout: Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000)),
        });
        log.info("action hover succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    }
    catch (err) {
        log.exception("action hover failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
        throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
    }
}
async function dragViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action drag started", actionMeta(opts, { start_ref: opts.startRef, end_ref: opts.endRef }));
    const startRef = (0, pw_tools_core_shared_js_1.requireRef)(opts.startRef);
    const endRef = (0, pw_tools_core_shared_js_1.requireRef)(opts.endRef);
    if (!startRef || !endRef) {
        throw new Error("startRef and endRef are required");
    }
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    try {
        await (0, pw_session_js_1.refLocator)(page, startRef).dragTo((0, pw_session_js_1.refLocator)(page, endRef), {
            timeout: Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000)),
        });
        log.info("action drag succeeded", actionMeta(opts, { start_ref: startRef, end_ref: endRef, duration_ms: Date.now() - started }));
    }
    catch (err) {
        log.exception("action drag failed", err, actionMeta(opts, { start_ref: startRef, end_ref: endRef, duration_ms: Date.now() - started }));
        throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, `${startRef} -> ${endRef}`);
    }
}
async function selectOptionViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action select started", actionMeta(opts, { ref: opts.ref, values_count: opts.values?.length ?? 0 }));
    const ref = (0, pw_tools_core_shared_js_1.requireRef)(opts.ref);
    if (!opts.values?.length) {
        throw new Error("values are required");
    }
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    try {
        await (0, pw_session_js_1.refLocator)(page, ref).selectOption(opts.values, {
            timeout: Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000)),
        });
        log.info("action select succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    }
    catch (err) {
        log.exception("action select failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
        throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
    }
}
async function pressKeyViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action press started", actionMeta(opts, { key: opts.key }));
    const key = String(opts.key ?? "").trim();
    if (!key) {
        throw new Error("key is required");
    }
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    await page.keyboard.press(key, {
        delay: Math.max(0, Math.floor(opts.delayMs ?? 0)),
    });
    log.info("action press succeeded", actionMeta(opts, { key, duration_ms: Date.now() - started }));
}
async function typeViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action type started", actionMeta(opts, { ref: opts.ref, submit: opts.submit, slowly: opts.slowly }));
    const text = String(opts.text ?? "");
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    const ref = (0, pw_tools_core_shared_js_1.requireRef)(opts.ref);
    const locator = (0, pw_session_js_1.refLocator)(page, ref);
    const timeout = Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000));
    try {
        if (opts.slowly) {
            await locator.click({ timeout });
            await locator.type(text, { timeout, delay: 75 });
        }
        else {
            await locator.fill(text, { timeout });
        }
        if (opts.submit) {
            await locator.press("Enter", { timeout });
        }
        log.info("action type succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    }
    catch (err) {
        log.exception("action type failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
        throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
    }
}
async function fillFormViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action fill started", actionMeta(opts, { fields: opts.fields.length }));
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    const timeout = Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000));
    for (const field of opts.fields) {
        const ref = field.ref.trim();
        const type = field.type.trim();
        const rawValue = field.value;
        const value = typeof rawValue === "string"
            ? rawValue
            : typeof rawValue === "number" || typeof rawValue === "boolean"
                ? String(rawValue)
                : "";
        if (!ref || !type) {
            continue;
        }
        const locator = (0, pw_session_js_1.refLocator)(page, ref);
        if (type === "checkbox" || type === "radio") {
            const checked = rawValue === true || rawValue === 1 || rawValue === "1" || rawValue === "true";
            try {
                await locator.setChecked(checked, { timeout });
            }
            catch (err) {
                throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
            }
            continue;
        }
        try {
            await locator.fill(value, { timeout });
        }
        catch (err) {
            log.exception("action fill field failed", err, actionMeta(opts, { ref, type, duration_ms: Date.now() - started }));
            throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
        }
    }
    log.info("action fill succeeded", actionMeta(opts, { fields: opts.fields.length, duration_ms: Date.now() - started }));
}
async function evaluateViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action evaluate started", actionMeta(opts, { ref: opts.ref, fn_chars: opts.fn?.length ?? 0 }));
    const fnText = String(opts.fn ?? "").trim();
    if (!fnText) {
        throw new Error("function is required");
    }
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    if (opts.ref) {
        const locator = (0, pw_session_js_1.refLocator)(page, opts.ref);
        // Use Function constructor at runtime to avoid esbuild adding __name helper
        // which doesn't exist in the browser context
        // eslint-disable-next-line @typescript-eslint/no-implied-eval -- required for browser-context eval
        const elementEvaluator = new Function("el", "fnBody", `
      "use strict";
      try {
        var candidate = eval("(" + fnBody + ")");
        return typeof candidate === "function" ? candidate(el) : candidate;
      } catch (err) {
        throw new Error("Invalid evaluate function: " + (err && err.message ? err.message : String(err)));
      }
      `);
        const result = await locator.evaluate(elementEvaluator, fnText);
        log.info("action evaluate succeeded", actionMeta(opts, { ref: opts.ref, duration_ms: Date.now() - started }));
        return result;
    }
    // Use Function constructor at runtime to avoid esbuild adding __name helper
    // which doesn't exist in the browser context
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- required for browser-context eval
    const browserEvaluator = new Function("fnBody", `
    "use strict";
    try {
      var candidate = eval("(" + fnBody + ")");
      return typeof candidate === "function" ? candidate() : candidate;
    } catch (err) {
      throw new Error("Invalid evaluate function: " + (err && err.message ? err.message : String(err)));
    }
    `);
    const result = await page.evaluate(browserEvaluator, fnText);
    log.info("action evaluate succeeded", actionMeta(opts, { duration_ms: Date.now() - started }));
    return result;
}
async function scrollIntoViewViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action scrollIntoView started", actionMeta(opts, { ref: opts.ref }));
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    const timeout = (0, pw_tools_core_shared_js_1.normalizeTimeoutMs)(opts.timeoutMs, 20_000);
    const ref = (0, pw_tools_core_shared_js_1.requireRef)(opts.ref);
    const locator = (0, pw_session_js_1.refLocator)(page, ref);
    try {
        await locator.scrollIntoViewIfNeeded({ timeout });
        log.info("action scrollIntoView succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    }
    catch (err) {
        log.exception("action scrollIntoView failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
        throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, ref);
    }
}
async function waitForViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action wait started", actionMeta(opts, {
        has_time: opts.timeMs !== undefined,
        has_text: Boolean(opts.text),
        has_text_gone: Boolean(opts.textGone),
        has_selector: Boolean(opts.selector),
        has_url: Boolean(opts.url),
        has_load_state: Boolean(opts.loadState),
        has_fn: Boolean(opts.fn),
    }));
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    const timeout = (0, pw_tools_core_shared_js_1.normalizeTimeoutMs)(opts.timeoutMs, 20_000);
    if (typeof opts.timeMs === "number" && Number.isFinite(opts.timeMs)) {
        await page.waitForTimeout(Math.max(0, opts.timeMs));
    }
    if (opts.text) {
        await page.getByText(opts.text).first().waitFor({
            state: "visible",
            timeout,
        });
    }
    if (opts.textGone) {
        await page.getByText(opts.textGone).first().waitFor({
            state: "hidden",
            timeout,
        });
    }
    if (opts.selector) {
        const selector = String(opts.selector).trim();
        if (selector) {
            await page.locator(selector).first().waitFor({ state: "visible", timeout });
        }
    }
    if (opts.url) {
        const url = String(opts.url).trim();
        if (url) {
            await page.waitForURL(url, { timeout });
        }
    }
    if (opts.loadState) {
        await page.waitForLoadState(opts.loadState, { timeout });
    }
    if (opts.fn) {
        const fn = String(opts.fn).trim();
        if (fn) {
            await page.waitForFunction(fn, { timeout });
        }
    }
    log.info("action wait succeeded", actionMeta(opts, { duration_ms: Date.now() - started }));
}
async function takeScreenshotViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action screenshot started", actionMeta(opts, { ref: opts.ref, element: opts.element, full_page: opts.fullPage }));
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    const type = opts.type ?? "png";
    if (opts.ref) {
        if (opts.fullPage) {
            throw new Error("fullPage is not supported for element screenshots");
        }
        const locator = (0, pw_session_js_1.refLocator)(page, opts.ref);
        const buffer = await locator.screenshot({ type });
        return { buffer };
    }
    if (opts.element) {
        if (opts.fullPage) {
            throw new Error("fullPage is not supported for element screenshots");
        }
        const locator = page.locator(opts.element).first();
        const buffer = await locator.screenshot({ type });
        return { buffer };
    }
    const buffer = await page.screenshot({
        type,
        fullPage: Boolean(opts.fullPage),
    });
    log.info("action screenshot succeeded", actionMeta(opts, { bytes: buffer.length, duration_ms: Date.now() - started }));
    return { buffer };
}
async function screenshotWithLabelsViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action screenshotWithLabels started", actionMeta(opts, { refs_count: Object.keys(opts.refs ?? {}).length }));
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    const type = opts.type ?? "png";
    const maxLabels = typeof opts.maxLabels === "number" && Number.isFinite(opts.maxLabels)
        ? Math.max(1, Math.floor(opts.maxLabels))
        : 150;
    const viewport = await page.evaluate(() => ({
        scrollX: window.scrollX || 0,
        scrollY: window.scrollY || 0,
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
    }));
    const refs = Object.keys(opts.refs ?? {});
    const boxes = [];
    let skipped = 0;
    for (const ref of refs) {
        if (boxes.length >= maxLabels) {
            skipped += 1;
            continue;
        }
        try {
            const box = await (0, pw_session_js_1.refLocator)(page, ref).boundingBox();
            if (!box) {
                skipped += 1;
                continue;
            }
            const x0 = box.x;
            const y0 = box.y;
            const x1 = box.x + box.width;
            const y1 = box.y + box.height;
            const vx0 = viewport.scrollX;
            const vy0 = viewport.scrollY;
            const vx1 = viewport.scrollX + viewport.width;
            const vy1 = viewport.scrollY + viewport.height;
            if (x1 < vx0 || x0 > vx1 || y1 < vy0 || y0 > vy1) {
                skipped += 1;
                continue;
            }
            boxes.push({
                ref,
                x: x0 - viewport.scrollX,
                y: y0 - viewport.scrollY,
                w: Math.max(1, box.width),
                h: Math.max(1, box.height),
            });
        }
        catch {
            skipped += 1;
        }
    }
    try {
        if (boxes.length > 0) {
            await page.evaluate((labels) => {
                const existing = document.querySelectorAll("[data-openclaw-labels]");
                existing.forEach((el) => el.remove());
                const root = document.createElement("div");
                root.setAttribute("data-openclaw-labels", "1");
                root.style.position = "fixed";
                root.style.left = "0";
                root.style.top = "0";
                root.style.zIndex = "2147483647";
                root.style.pointerEvents = "none";
                root.style.fontFamily =
                    '"SF Mono","SFMono-Regular",Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace';
                const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
                for (const label of labels) {
                    const box = document.createElement("div");
                    box.setAttribute("data-openclaw-labels", "1");
                    box.style.position = "absolute";
                    box.style.left = `${label.x}px`;
                    box.style.top = `${label.y}px`;
                    box.style.width = `${label.w}px`;
                    box.style.height = `${label.h}px`;
                    box.style.border = "2px solid #ffb020";
                    box.style.boxSizing = "border-box";
                    const tag = document.createElement("div");
                    tag.setAttribute("data-openclaw-labels", "1");
                    tag.textContent = label.ref;
                    tag.style.position = "absolute";
                    tag.style.left = `${label.x}px`;
                    tag.style.top = `${clamp(label.y - 18, 0, 20000)}px`;
                    tag.style.background = "#ffb020";
                    tag.style.color = "#1a1a1a";
                    tag.style.fontSize = "12px";
                    tag.style.lineHeight = "14px";
                    tag.style.padding = "1px 4px";
                    tag.style.borderRadius = "3px";
                    tag.style.boxShadow = "0 1px 2px rgba(0,0,0,0.35)";
                    tag.style.whiteSpace = "nowrap";
                    root.appendChild(box);
                    root.appendChild(tag);
                }
                document.documentElement.appendChild(root);
            }, boxes);
        }
        const buffer = await page.screenshot({ type });
        log.info("action screenshotWithLabels succeeded", actionMeta(opts, { labels: boxes.length, skipped, bytes: buffer.length, duration_ms: Date.now() - started }));
        return { buffer, labels: boxes.length, skipped };
    }
    finally {
        await page
            .evaluate(() => {
            const existing = document.querySelectorAll("[data-openclaw-labels]");
            existing.forEach((el) => el.remove());
        })
            .catch(() => { });
    }
}
async function setInputFilesViaPlaywright(opts) {
    const started = Date.now();
    log.debug("action setInputFiles started", actionMeta(opts, { input_ref: opts.inputRef, has_element: Boolean(opts.element), paths_count: opts.paths.length }));
    const page = await (0, pw_session_js_1.getPageForTargetId)(opts);
    (0, pw_session_js_1.ensurePageState)(page);
    (0, pw_session_js_1.restoreRoleRefsForTarget)({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
    if (!opts.paths.length) {
        throw new Error("paths are required");
    }
    const inputRef = typeof opts.inputRef === "string" ? opts.inputRef.trim() : "";
    const element = typeof opts.element === "string" ? opts.element.trim() : "";
    if (inputRef && element) {
        throw new Error("inputRef and element are mutually exclusive");
    }
    if (!inputRef && !element) {
        throw new Error("inputRef or element is required");
    }
    const locator = inputRef ? (0, pw_session_js_1.refLocator)(page, inputRef) : page.locator(element).first();
    try {
        await locator.setInputFiles(opts.paths);
        log.info("action setInputFiles succeeded", actionMeta(opts, { duration_ms: Date.now() - started }));
    }
    catch (err) {
        log.exception("action setInputFiles failed", err, actionMeta(opts, { duration_ms: Date.now() - started }));
        throw (0, pw_tools_core_shared_js_1.toAIFriendlyError)(err, inputRef || element);
    }
    try {
        const handle = await locator.elementHandle();
        if (handle) {
            await handle.evaluate((el) => {
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
            });
        }
    }
    catch {
        // Best-effort for sites that don't react to setInputFiles alone.
    }
}
