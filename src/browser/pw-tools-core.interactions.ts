import type { BrowserFormField } from "./client-actions-core.js";
import {
  ensurePageState,
  getPageForTargetId,
  refLocator,
  restoreRoleRefsForTarget,
} from "./pw-session.js";
import { normalizeTimeoutMs, requireRef, toAIFriendlyError } from "./pw-tools-core.shared.js";
import {
  type IncrementalElement,
  injectIncrementalRefs,
  startDomObserver,
  stopDomObserver,
} from "./pw-tools-core.dom-observer.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("pw-actions");

function actionMeta(opts: { targetId?: string; cdpUrl: string }, extra?: Record<string, unknown>) {
  return { target_id: opts.targetId, cdp_url: opts.cdpUrl, ...(extra || {}) };
}

export async function highlightViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
}): Promise<void> {
  const started = Date.now();
  log.debug("action highlight started", actionMeta(opts, { ref: opts.ref }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const ref = requireRef(opts.ref);
  try {
    await refLocator(page, ref).highlight();
    log.debug("action highlight succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action highlight failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, ref);
  }
}

export async function clickViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
  doubleClick?: boolean;
  button?: "left" | "right" | "middle";
  modifiers?: Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift">;
  timeoutMs?: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("action click started", actionMeta(opts, { ref: opts.ref, double_click: opts.doubleClick }));
  const page = await getPageForTargetId({
    cdpUrl: opts.cdpUrl,
    targetId: opts.targetId,
  });
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);
  const timeout = Math.max(500, Math.min(60_000, Math.floor(opts.timeoutMs ?? 8000)));
  try {
    if (opts.doubleClick) {
      await locator.dblclick({
        timeout,
        button: opts.button,
        modifiers: opts.modifiers,
      });
    } else {
      await locator.click({
        timeout,
        button: opts.button,
        modifiers: opts.modifiers,
      });
    }
    log.info("action click succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action click failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, ref);
  }
}

export async function hoverViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
  timeoutMs?: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("action hover started", actionMeta(opts, { ref: opts.ref }));
  const ref = requireRef(opts.ref);
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  try {
    await refLocator(page, ref).hover({
      timeout: Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000)),
    });
    log.info("action hover succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action hover failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, ref);
  }
}

export async function dragViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  startRef: string;
  endRef: string;
  timeoutMs?: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("action drag started", actionMeta(opts, { start_ref: opts.startRef, end_ref: opts.endRef }));
  const startRef = requireRef(opts.startRef);
  const endRef = requireRef(opts.endRef);
  if (!startRef || !endRef) {
    throw new Error("startRef and endRef are required");
  }
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  try {
    await refLocator(page, startRef).dragTo(refLocator(page, endRef), {
      timeout: Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000)),
    });
    log.info("action drag succeeded", actionMeta(opts, { start_ref: startRef, end_ref: endRef, duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action drag failed", err, actionMeta(opts, { start_ref: startRef, end_ref: endRef, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, `${startRef} -> ${endRef}`);
  }
}

export async function selectOptionViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
  values: string[];
  timeoutMs?: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("action select started", actionMeta(opts, { ref: opts.ref, values_count: opts.values?.length ?? 0 }));
  const ref = requireRef(opts.ref);
  if (!opts.values?.length) {
    throw new Error("values are required");
  }
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  try {
    await refLocator(page, ref).selectOption(opts.values, {
      timeout: Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000)),
    });
    log.info("action select succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action select failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, ref);
  }
}

export async function pressKeyViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  key: string;
  delayMs?: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("action press started", actionMeta(opts, { key: opts.key }));
  const key = String(opts.key ?? "").trim();
  if (!key) {
    throw new Error("key is required");
  }
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.keyboard.press(key, {
    delay: Math.max(0, Math.floor(opts.delayMs ?? 0)),
  });
  log.info("action press succeeded", actionMeta(opts, { key, duration_ms: Date.now() - started }));
}

export async function typeViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
  text: string;
  submit?: boolean;
  slowly?: boolean;
  timeoutMs?: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("action type started", actionMeta(opts, { ref: opts.ref, submit: opts.submit, slowly: opts.slowly }));
  const text = String(opts.text ?? "");
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);
  const timeout = Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000));
  try {
    if (opts.slowly) {
      await locator.click({ timeout });
      await locator.type(text, { timeout, delay: 75 });
    } else {
      await locator.fill(text, { timeout });
    }
    if (opts.submit) {
      await locator.press("Enter", { timeout });
    }
    log.info("action type succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action type failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, ref);
  }
}

export async function fillFormViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  fields: BrowserFormField[];
  timeoutMs?: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("action fill started", actionMeta(opts, { fields: opts.fields.length }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const timeout = Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000));
  for (const field of opts.fields) {
    const ref = field.ref.trim();
    const type = field.type.trim();
    const rawValue = field.value;
    const value =
      typeof rawValue === "string"
        ? rawValue
        : typeof rawValue === "number" || typeof rawValue === "boolean"
          ? String(rawValue)
          : "";
    if (!ref || !type) {
      continue;
    }
    const locator = refLocator(page, ref);
    if (type === "checkbox" || type === "radio") {
      const checked =
        rawValue === true || rawValue === 1 || rawValue === "1" || rawValue === "true";
      try {
        await locator.setChecked(checked, { timeout });
      } catch (err) {
        throw toAIFriendlyError(err, ref);
      }
      continue;
    }
    try {
      await locator.fill(value, { timeout });
    } catch (err) {
      log.exception("action fill field failed", err, actionMeta(opts, { ref, type, duration_ms: Date.now() - started }));
      throw toAIFriendlyError(err, ref);
    }
  }
  log.info("action fill succeeded", actionMeta(opts, { fields: opts.fields.length, duration_ms: Date.now() - started }));
}

export async function evaluateViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  fn: string;
  ref?: string;
}): Promise<unknown> {
  const started = Date.now();
  log.debug("action evaluate started", actionMeta(opts, { ref: opts.ref, fn_chars: opts.fn?.length ?? 0 }));
  const fnText = String(opts.fn ?? "").trim();
  if (!fnText) {
    throw new Error("function is required");
  }
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  if (opts.ref) {
    const locator = refLocator(page, opts.ref);
    // Use Function constructor at runtime to avoid esbuild adding __name helper
    // which doesn't exist in the browser context
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- required for browser-context eval
    const elementEvaluator = new Function(
      "el",
      "fnBody",
      `
      "use strict";
      try {
        var candidate = eval("(" + fnBody + ")");
        return typeof candidate === "function" ? candidate(el) : candidate;
      } catch (err) {
        throw new Error("Invalid evaluate function: " + (err && err.message ? err.message : String(err)));
      }
      `,
    ) as (el: Element, fnBody: string) => unknown;
    const result = await locator.evaluate(elementEvaluator, fnText);
    log.info("action evaluate succeeded", actionMeta(opts, { ref: opts.ref, duration_ms: Date.now() - started }));
    return result;
  }
  // Use Function constructor at runtime to avoid esbuild adding __name helper
  // which doesn't exist in the browser context
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- required for browser-context eval
  const browserEvaluator = new Function(
    "fnBody",
    `
    "use strict";
    try {
      var candidate = eval("(" + fnBody + ")");
      return typeof candidate === "function" ? candidate() : candidate;
    } catch (err) {
      throw new Error("Invalid evaluate function: " + (err && err.message ? err.message : String(err)));
    }
    `,
  ) as (fnBody: string) => unknown;
  const result = await page.evaluate(browserEvaluator, fnText);
  log.info("action evaluate succeeded", actionMeta(opts, { duration_ms: Date.now() - started }));
  return result;
}

export async function scrollIntoViewViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
  timeoutMs?: number;
}): Promise<void> {
  const started = Date.now();
  log.debug("action scrollIntoView started", actionMeta(opts, { ref: opts.ref }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const timeout = normalizeTimeoutMs(opts.timeoutMs, 20_000);

  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);
  try {
    await locator.scrollIntoViewIfNeeded({ timeout });
    log.info("action scrollIntoView succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action scrollIntoView failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, ref);
  }
}

export async function waitForViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  timeMs?: number;
  text?: string;
  textGone?: string;
  selector?: string;
  url?: string;
  loadState?: "load" | "domcontentloaded" | "networkidle";
  fn?: string;
  timeoutMs?: number;
}): Promise<void> {
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
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const timeout = normalizeTimeoutMs(opts.timeoutMs, 20_000);

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

export async function takeScreenshotViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref?: string;
  element?: string;
  fullPage?: boolean;
  type?: "png" | "jpeg";
}): Promise<{ buffer: Buffer }> {
  const started = Date.now();
  log.debug("action screenshot started", actionMeta(opts, { ref: opts.ref, element: opts.element, full_page: opts.fullPage }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const type = opts.type ?? "png";
  if (opts.ref) {
    if (opts.fullPage) {
      throw new Error("fullPage is not supported for element screenshots");
    }
    const locator = refLocator(page, opts.ref);
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

export async function screenshotWithLabelsViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  refs: Record<string, { role: string; name?: string; nth?: number }>;
  maxLabels?: number;
  type?: "png" | "jpeg";
}): Promise<{ buffer: Buffer; labels: number; skipped: number }> {
  const started = Date.now();
  log.debug("action screenshotWithLabels started", actionMeta(opts, { refs_count: Object.keys(opts.refs ?? {}).length }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const type = opts.type ?? "png";
  const maxLabels =
    typeof opts.maxLabels === "number" && Number.isFinite(opts.maxLabels)
      ? Math.max(1, Math.floor(opts.maxLabels))
      : 150;

  const viewport = await page.evaluate(() => ({
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0,
    width: window.innerWidth || 0,
    height: window.innerHeight || 0,
  }));

  const refs = Object.keys(opts.refs ?? {});
  const boxes: Array<{ ref: string; x: number; y: number; w: number; h: number }> = [];
  let skipped = 0;

  for (const ref of refs) {
    if (boxes.length >= maxLabels) {
      skipped += 1;
      continue;
    }
    try {
      const box = await refLocator(page, ref).boundingBox();
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
    } catch {
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

        const clamp = (value: number, min: number, max: number) =>
          Math.min(max, Math.max(min, value));

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
  } finally {
    await page
      .evaluate(() => {
        const existing = document.querySelectorAll("[data-openclaw-labels]");
        existing.forEach((el) => el.remove());
      })
      .catch(() => {});
  }
}

export async function setInputFilesViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  inputRef?: string;
  element?: string;
  paths: string[];
}): Promise<void> {
  const started = Date.now();
  log.debug("action setInputFiles started", actionMeta(opts, { input_ref: opts.inputRef, has_element: Boolean(opts.element), paths_count: opts.paths.length }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
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

  const locator = inputRef ? refLocator(page, inputRef) : page.locator(element).first();

  try {
    await locator.setInputFiles(opts.paths);
    log.info("action setInputFiles succeeded", actionMeta(opts, { duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action setInputFiles failed", err, actionMeta(opts, { duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, inputRef || element);
  }
  try {
    const handle = await locator.elementHandle();
    if (handle) {
      await handle.evaluate((el) => {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
  } catch {
    // Best-effort for sites that don't react to setInputFiles alone.
  }
}

export async function discoverDropdownOptionsViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
  searchText?: string;
  timeoutMs?: number;
}): Promise<{
  options: IncrementalElement[];
  dropdownOpen: boolean;
  triggerMethod: "click" | "arrowdown" | "typeahead" | "none";
}> {
  const started = Date.now();
  log.debug("action discoverDropdownOptions started", actionMeta(opts, { ref: opts.ref }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);

  let triggerMethod: "click" | "arrowdown" | "typeahead" | "none" = "none";
  let options: IncrementalElement[] = [];

  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 5000 });

    // 1. Try Click
    triggerMethod = "click";
    await startDomObserver(page);
    await locator.click({ timeout: 5000 });
    await page.waitForTimeout(500); // Wait for animation
    let incremental = await stopDomObserver(page);
    options = incremental.newElements;

    // 2. Try ArrowDown if no new elements
    if (options.length === 0) {
      triggerMethod = "arrowdown";
      await startDomObserver(page);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(500);
      incremental = await stopDomObserver(page);
      options = incremental.newElements;
    }

    // 3. Try Typing if still no new elements and searchText provided
    if (options.length === 0 && opts.searchText) {
      triggerMethod = "typeahead";
      await startDomObserver(page);
      await locator.type(opts.searchText, { delay: 50 });
      await page.waitForTimeout(500);
      incremental = await stopDomObserver(page);
      options = incremental.newElements;
    }

    // Filter and assign refs
    options = options.filter((o) => o.isInteractable || o.text.length > 0);

    if (options.length > 0) {
      await injectIncrementalRefs(page, options);
    }

    log.info("action discoverDropdownOptions succeeded", actionMeta(opts, {
      ref,
      options_count: options.length,
      trigger_method: triggerMethod,
      duration_ms: Date.now() - started,
    }));

    return {
      options,
      dropdownOpen: options.length > 0,
      triggerMethod,
    };
  } catch (err) {
    log.exception("action discoverDropdownOptions failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, ref);
  }
}

export async function closeDropdownViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  ref: string;
}): Promise<void> {
  const started = Date.now();
  log.debug("action closeDropdown started", actionMeta(opts, { ref: opts.ref }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const ref = requireRef(opts.ref);
  const locator = refLocator(page, ref);

  try {
    await page.keyboard.press("Escape");
    await locator.blur().catch(() => {});
    log.info("action closeDropdown succeeded", actionMeta(opts, { ref, duration_ms: Date.now() - started }));
  } catch (err) {
    log.exception("action closeDropdown failed", err, actionMeta(opts, { ref, duration_ms: Date.now() - started }));
    throw toAIFriendlyError(err, ref);
  }
}
