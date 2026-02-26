import type { BrowserFormField } from "./client-actions-core.js";
import {
  ensurePageState,
  getPageForTargetId,
  refLocator,
  restoreRoleRefsForTarget,
} from "./pw-session.js";
import { normalizeTimeoutMs, requireRef, toAIFriendlyError } from "./pw-tools-core.shared.js";
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

export type FillResult = {
  ref: string;
  requestedValue: string;
  actualValue: string;
  matched: boolean;
  strategy: "fill" | "sequential" | "pressSequentially" | "inputEvent" | "skip";
  warning?: string;
};

/**
 * Fill a single field with verification and fallback strategies.
 *
 * Strategy escalation:
 * 1. If current value already matches → skip
 * 2. Try locator.fill()
 * 3. Read back value. If matches → done
 * 4. If mismatch → clear + pressSequentially (char by char with 30ms delay)
 * 5. Read back again. If mismatch → report warning with actual vs requested
 *
 * Special handling:
 * - type="date": use locator.fill() with ISO format (YYYY-MM-DD)
 * - type="tel": strip non-digit chars if fill fails, retry with digits-only
 * - contenteditable: use page.keyboard.type() after clicking
 */
export async function fillAndVerifyField(
  page: Awaited<ReturnType<typeof getPageForTargetId>>,
  locator: ReturnType<typeof refLocator>,
  ref: string,
  value: string,
  inputType: string | null,
  timeout: number,
): Promise<FillResult> {
  const result: FillResult = {
    ref,
    requestedValue: value,
    actualValue: "",
    matched: false,
    strategy: "fill",
  };

  // Step 0: Read current value
  let currentValue = "";
  try {
    currentValue = await locator.inputValue({ timeout: 2000 });
  } catch {
    // Not an input — might be contenteditable or select
    try {
      currentValue = await locator.innerText({ timeout: 2000 });
    } catch {
      currentValue = "";
    }
  }

  if (currentValue.trim() === value.trim()) {
    result.actualValue = currentValue;
    result.matched = true;
    result.strategy = "skip";
    return result;
  }

  // Step 0.5: Specific input types handling
  const placeholder = await locator.getAttribute("placeholder", { timeout: 1500 }).catch(() => "");

  if (inputType === "date" || (placeholder && /MM|DD|YYYY|mm\/dd/i.test(placeholder))) {
    try {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        if (inputType === "date") {
          // Native date input: always use ISO format
          const iso = parsed.toISOString().split("T")[0];
          await locator.fill(iso, { timeout });
        } else if (placeholder) {
          // Text input with date format hint
          let formatted = value;
          if (/MM\/DD\/YYYY/i.test(placeholder)) {
            formatted = `${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}/${parsed.getFullYear()}`;
          } else if (/MM\/YYYY/i.test(placeholder)) {
            formatted = `${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
          } else if (/YYYY-MM-DD/i.test(placeholder)) {
            formatted = parsed.toISOString().split("T")[0];
          } else if (/DD\.MM\.YYYY/i.test(placeholder)) {
            formatted = `${String(parsed.getDate()).padStart(2, "0")}.${String(parsed.getMonth() + 1).padStart(2, "0")}.${parsed.getFullYear()}`;
          }
          await locator.fill(formatted, { timeout });
        }
        result.actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => "");
        // console.log(`DATE DEBUG: actualValue="${result.actualValue}" value="${value}"`);
        result.matched = result.actualValue.trim() === value.trim() || result.actualValue.length > 0;
        result.strategy = "fill";
        if (result.matched) return result;
      }
    } catch (err) {
      // console.log(`DATE DEBUG ERROR: ${err}`);
      /* fall through to general fill */
    }
  }

  // Phone format strategy for job apps
  if (inputType === "tel") {
    const digitsOnly = value.replace(/\D/g, "");

    // Strategy 1: If placeholder has parentheses/dashes → input mask likely → digits only + sequential
    if (placeholder && /[()-]/.test(placeholder)) {
      try {
        await locator.click({ timeout: 2000 });
        await locator.fill("", { timeout: 2000 });
        await page.keyboard.type(digitsOnly, { delay: 50 });
        result.strategy = "pressSequentially";
        result.actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => "");
        // Masked inputs will auto-format; just verify digits match
        if (result.actualValue.replace(/\D/g, "") === digitsOnly) {
          result.matched = true;
          return result;
        }
      } catch {
        /* fall through */
      }
    }
  }

  // Step 1: Try locator.fill()
  try {
    await locator.fill(value, { timeout });
  } catch {
    // fill() failed — might be contenteditable or non-standard
    try {
      await locator.click({ timeout: 3000 });
      await locator.selectText({ timeout: 2000 }).catch(() => {});
      await page.keyboard.type(value, { delay: 30 });
      result.strategy = "sequential";
    } catch (seqErr) {
      result.warning = `fill and sequential both failed: ${seqErr instanceof Error ? seqErr.message : String(seqErr)}`;
      result.actualValue = "";
      return result;
    }
  }

  // Step 2: Read back value
  try {
    result.actualValue = await locator.inputValue({ timeout: 2000 });
  } catch {
    try {
      result.actualValue = await locator.innerText({ timeout: 2000 });
    } catch {
      result.actualValue = "";
    }
  }

  if (result.actualValue.trim() === value.trim()) {
    result.matched = true;
    return result;
  }

  // Step 3: For specific input types, try format normalization
  if (inputType === "tel" && !result.matched) {
    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly !== value) {
      try {
        await locator.fill("", { timeout: 2000 });
        await locator.pressSequentially(digitsOnly, { delay: 30, timeout });
        result.actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => "");
        result.strategy = "pressSequentially";
        if (result.actualValue.replace(/\D/g, "") === digitsOnly) {
          result.matched = true;
          return result;
        }
      } catch {
        /* continue */
      }
    }
  }

  // Step 4: General fallback — clear + pressSequentially
  if (!result.matched) {
    try {
      await locator.fill("", { timeout: 2000 });
      await locator.pressSequentially(value, { delay: 40, timeout });
      result.actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => "");
      result.strategy = "pressSequentially";
      result.matched = result.actualValue.trim() === value.trim();
    } catch {
      /* already have warning from above */
    }
  }

  if (!result.matched) {
    result.warning = `Value mismatch after fill: requested="${value.slice(0, 50)}" actual="${result.actualValue.slice(
      0,
      50,
    )}"`;
  }

  return result;
}

export async function fillFormViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  fields: BrowserFormField[];
  timeoutMs?: number;
}): Promise<{ results: FillResult[] }> {
  const started = Date.now();
  log.debug("action fill started", actionMeta(opts, { fields: opts.fields.length }));
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  restoreRoleRefsForTarget({ cdpUrl: opts.cdpUrl, targetId: opts.targetId, page });
  const timeout = Math.max(500, Math.min(60_000, opts.timeoutMs ?? 8000));
  const results: FillResult[] = [];

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
    if (!ref || !type) continue;
    const locator = refLocator(page, ref);

    if (type === "checkbox" || type === "radio") {
      const checked =
        rawValue === true || rawValue === 1 || rawValue === "1" || rawValue === "true";
      try {
        await locator.setChecked(checked, { timeout });
        results.push({
          ref,
          requestedValue: String(checked),
          actualValue: String(checked),
          matched: true,
          strategy: "fill",
        });
      } catch (err) {
        results.push({
          ref,
          requestedValue: String(checked),
          actualValue: "",
          matched: false,
          strategy: "fill",
          warning: err instanceof Error ? err.message : String(err),
        });
      }
      continue;
    }

    // Determine input type for format-aware filling
    let inputType: string | null = null;
    try {
      inputType = await locator.getAttribute("type", { timeout: 1500 });
    } catch {
      /* not available */
    }

    const fillResult = await fillAndVerifyField(page, locator, ref, value, inputType, timeout);
    results.push(fillResult);

    if (!fillResult.matched) {
      log.warn(
        "fill verify mismatch",
        actionMeta(opts, {
          ref,
          type,
          requested: value.slice(0, 50),
          actual: fillResult.actualValue.slice(0, 50),
          strategy: fillResult.strategy,
        }),
      );
    }
  }

  log.info(
    "action fill completed",
    actionMeta(opts, {
      fields: opts.fields.length,
      matched: results.filter((r) => r.matched).length,
      mismatched: results.filter((r) => !r.matched).length,
      duration_ms: Date.now() - started,
    }),
  );

  return { results };
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
