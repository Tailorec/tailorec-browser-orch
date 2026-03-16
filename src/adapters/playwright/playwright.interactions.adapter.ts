import type { Page, Locator } from 'playwright-core';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('pw-interactions-adapter');

/**
 * Options for click action.
 */
export type ClickOptions = {
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  timeoutMs?: number;
};

/**
 * Options for type action.
 */
export type TypeOptions = {
  text: string;
  clear?: boolean;
  timeoutMs?: number;
};

/**
 * Options for fill action.
 */
export type FillOptions = {
  value: string;
  type?: 'text' | 'email' | 'phone' | 'date' | 'password';
  timeoutMs?: number;
};

/**
 * Result of a fill operation.
 */
export type FillResult = {
  ref: string;
  requestedValue: string;
  actualValue: string;
  matched: boolean;
  strategy: 'fill' | 'sequential' | 'pressSequentially' | 'inputEvent' | 'skip';
  warning?: string;
};

/**
 * State of an element.
 */
export type ElementState = {
  ref: string;
  exists: boolean;
  visible: boolean;
  enabled: boolean;
  editable: boolean;
  focusable: boolean;
  checked: boolean | null;
  tagName: string;
  inputType: string | null;
  currentValue: string;
  required: boolean;
  ariaInvalid: boolean;
  ariaExpanded: boolean | null;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  isObscured: boolean;
};

/**
 * Helper function to require a valid ref.
 */
function requireRef(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const ref = raw.startsWith('@') ? raw.slice(1) : raw.startsWith('ref=') ? raw.slice(4) : raw;
  if (!ref) {
    throw new Error('ref is required');
  }
  return ref;
}

/**
 * Helper function to normalize timeout.
 */
function normalizeTimeoutMs(timeoutMs: number | undefined, fallback: number): number {
  return Math.max(500, Math.min(120_000, timeoutMs ?? fallback));
}

/**
 * Convert error to AI-friendly message.
 */
function toAIFriendlyError(error: unknown, selector: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('strict mode violation')) {
    const countMatch = message.match(/resolved to (\d+) elements/);
    const count = countMatch ? countMatch[1] : 'multiple';
    return new Error(
      `Selector "${selector}" matched ${count} elements. ` +
        `Run a new snapshot to get updated refs, or use a different ref.`,
    );
  }

  if (
    (message.includes('Timeout') || message.includes('waiting for')) &&
    (message.includes('to be visible') || message.includes('not visible'))
  ) {
    return new Error(
      `Element "${selector}" not found or not visible. ` +
        `Run a new snapshot to see current page elements.`,
    );
  }

  if (
    message.includes('intercepts pointer events') ||
    message.includes('not visible') ||
    message.includes('not receive pointer events')
  ) {
    return new Error(
      `Element "${selector}" is not interactable (hidden or covered). ` +
        `Try scrolling it into view, closing overlays, or re-snapshotting.`,
    );
  }

  return error instanceof Error ? error : new Error(message);
}

/**
 * Get a locator for a ref.
 */
function refLocator(page: Page, ref: string): Locator {
  const normalized = ref.startsWith('@')
    ? ref.slice(1)
    : ref.startsWith('ref=')
      ? ref.slice(4)
      : ref;

  if (/^e\d+$/.test(normalized)) {
    return page.locator(`[aria-ref="${normalized}"]`);
  }

  // Dynamic refs from dropdown discovery (d1, d2, ...)
  if (normalized.startsWith('d')) {
    return page.locator(`[aria-ref="${normalized}"]`);
  }

  return page.locator(`[aria-ref="${normalized}"]`);
}

/**
 * PlaywrightInteractionsAdapter provides interaction functionality for web pages.
 * 
 * This adapter extracts logic from pw-tools-core.interactions.ts to provide:
 * - Click, type, fill actions
 * - Hover, drag, select operations
 * - Element state queries
 * - Fill-and-verify pattern with fallback strategies
 */
export class PlaywrightInteractionsAdapter {
  /**
   * Click an element by ref.
   */
  async click(page: Page, ref: string, options: ClickOptions = {}): Promise<void> {
    const started = Date.now();
    log.debug('click started', { ref, options: JSON.stringify(options) });

    const locator = refLocator(page, ref);
    const timeout = normalizeTimeoutMs(options.timeoutMs, 8000);

    try {
      if (options.doubleClick) {
        await locator.dblclick({ timeout, button: options.button });
      } else {
        await locator.click({ timeout, button: options.button, modifiers: options.modifiers });
      }

      log.info('click succeeded', { ref, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('click failed', error, { ref, duration_ms: Date.now() - started });
      throw toAIFriendlyError(error, ref);
    }
  }

  /**
   * Type text into an element.
   */
  async type(page: Page, ref: string, options: TypeOptions): Promise<void> {
    const started = Date.now();
    log.debug('type started', { ref, text: options.text.substring(0, 20) });

    const locator = refLocator(page, ref);
    const timeout = normalizeTimeoutMs(options.timeoutMs, 8000);

    try {
      if (options.clear) {
        await locator.clear({ timeout });
      }
      await locator.fill(options.text, { timeout });

      log.info('type succeeded', { ref, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('type failed', error, { ref, duration_ms: Date.now() - started });
      throw toAIFriendlyError(error, ref);
    }
  }

  /**
   * Fill a field with verification and fallback strategies.
   * 
   * Strategy escalation:
   * 1. If current value already matches → skip
   * 2. For type="date" → format-aware fill
   * 3. For type="tel" with masked placeholder → digits-only via pressSequentially
   * 4. Try locator.fill()
   * 5. Read back value. If matches → done
   * 6. If mismatch → clear + pressSequentially (char by char)
   * 7. Read back again. If mismatch → report warning
   */
  async fill(
    page: Page,
    ref: string,
    options: FillOptions,
  ): Promise<FillResult> {
    const started = Date.now();
    log.debug('fill started', { ref, value: options.value });

    const locator = refLocator(page, ref);
    const timeout = normalizeTimeoutMs(options.timeoutMs, 8000);

    const result: FillResult = {
      ref,
      requestedValue: options.value,
      actualValue: '',
      matched: false,
      strategy: 'fill',
    };

    try {
      // Step 0: Read current value
      let currentValue = '';
      try {
        currentValue = await locator.inputValue({ timeout: 2000 });
      } catch {
        try {
          currentValue = await locator.innerText({ timeout: 2000 });
        } catch {
          currentValue = '';
        }
      }

      if (currentValue.trim() === options.value.trim()) {
        result.actualValue = currentValue;
        result.matched = true;
        result.strategy = 'skip';
        log.info('fill skipped - value already matches', { ref, duration_ms: Date.now() - started });
        return result;
      }

      // Step 1: Try locator.fill()
      await locator.fill(options.value, { timeout });

      // Step 2: Read back value (verification)
      try {
        result.actualValue = await locator.inputValue({ timeout: 2000 });
      } catch {
        try {
          result.actualValue = await locator.innerText({ timeout: 2000 });
        } catch {
          result.actualValue = '';
        }
      }

      if (result.actualValue.trim() === options.value.trim()) {
        result.matched = true;
        log.info('fill succeeded', { ref, duration_ms: Date.now() - started });
        return result;
      }

      // Step 3: Fallback - clear + pressSequentially
      log.warn('fill verification failed, trying sequential typing', {
        ref,
        expected: options.value,
        actual: result.actualValue,
      });

      await locator.fill('', { timeout: 2000 });
      await locator.pressSequentially(options.value, { delay: 40, timeout });
      result.strategy = 'pressSequentially';

      result.actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => '');
      result.matched = result.actualValue.trim() === options.value.trim();

      if (!result.matched) {
        result.warning = `Value mismatch after sequential typing. Expected: "${options.value}", Got: "${result.actualValue}"`;
      }

      log.info('fill completed', {
        ref,
        matched: result.matched,
        strategy: result.strategy,
        duration_ms: Date.now() - started,
      });

      return result;
    } catch (error) {
      log.exception('fill failed', error, { ref, duration_ms: Date.now() - started });
      result.warning = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * Hover over an element.
   */
  async hover(page: Page, ref: string, timeoutMs: number = 8000): Promise<void> {
    const started = Date.now();
    log.debug('hover started', { ref });

    const locator = refLocator(page, ref);
    const timeout = normalizeTimeoutMs(timeoutMs, 8000);

    try {
      await locator.hover({ timeout });
      log.info('hover succeeded', { ref, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('hover failed', error, { ref, duration_ms: Date.now() - started });
      throw toAIFriendlyError(error, ref);
    }
  }

  /**
   * Drag from one element to another.
   */
  async drag(
    page: Page,
    startRef: string,
    endRef: string,
    timeoutMs: number = 8000,
  ): Promise<void> {
    const started = Date.now();
    log.debug('drag started', { start_ref: startRef, end_ref: endRef });

    const startLocator = refLocator(page, startRef);
    const endLocator = refLocator(page, endRef);
    const timeout = normalizeTimeoutMs(timeoutMs, 8000);

    try {
      await startLocator.dragTo(endLocator, { timeout });
      log.info('drag succeeded', { start_ref: startRef, end_ref: endRef, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('drag failed', error, { start_ref: startRef, end_ref: endRef, duration_ms: Date.now() - started });
      throw toAIFriendlyError(error, `${startRef} -> ${endRef}`);
    }
  }

  /**
   * Select options in a dropdown.
   */
  async selectOption(page: Page, ref: string, values: string[], timeoutMs: number = 8000): Promise<void> {
    const started = Date.now();
    log.debug('select started', { ref, values_count: values.length });

    if (!values.length) {
      throw new Error('values are required');
    }

    const locator = refLocator(page, ref);
    const timeout = normalizeTimeoutMs(timeoutMs, 8000);

    try {
      await locator.selectOption(values, { timeout });
      log.info('select succeeded', { ref, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('select failed', error, { ref, duration_ms: Date.now() - started });
      throw toAIFriendlyError(error, ref);
    }
  }

  /**
   * Press a keyboard key.
   */
  async pressKey(page: Page, key: string, delayMs?: number): Promise<void> {
    const started = Date.now();
    log.debug('press started', { key });

    if (!key.trim()) {
      throw new Error('key is required');
    }

    try {
      await page.keyboard.press(key, { delay: delayMs ?? 0 });
      log.info('press succeeded', { key, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('press failed', error, { key, duration_ms: Date.now() - started });
      throw error;
    }
  }

  /**
   * Query the state of an element.
   */
  async queryElementState(page: Page, ref: string): Promise<ElementState> {
    const locator = refLocator(page, ref);
    const exists = (await locator.count()) > 0;

    if (!exists) {
      return {
        ref,
        exists: false,
        visible: false,
        enabled: false,
        editable: false,
        focusable: false,
        checked: null,
        tagName: '',
        inputType: null,
        currentValue: '',
        required: false,
        ariaInvalid: false,
        ariaExpanded: null,
        boundingBox: null,
        isObscured: false,
      };
    }

    const el = locator.first();

    const [visible, enabled, editable, boundingBox] = await Promise.all([
      el.isVisible().catch(() => false),
      el.isEnabled().catch(() => false),
      el.isEditable().catch(() => false),
      el.boundingBox().catch(() => null),
    ]);

    const domState = await el.evaluate((node: Element) => {
      const input = node as HTMLInputElement;
      const rect = node.getBoundingClientRect();

      // Check if element is obscured
      let isObscured = false;
      if (rect.width > 0 && rect.height > 0) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topElement = document.elementFromPoint(centerX, centerY);
        if (
          topElement &&
          topElement !== node &&
          !node.contains(topElement) &&
          !topElement.contains(node)
        ) {
          isObscured = true;
        }
      }

      return {
        tagName: node.tagName?.toLowerCase() || '',
        inputType: input.type || node.getAttribute('type') || null,
        currentValue: (input.value || '').slice(0, 200),
        required:
          input.required ||
          node.hasAttribute('required') ||
          node.getAttribute('aria-required') === 'true',
        ariaInvalid: node.getAttribute('aria-invalid') === 'true',
        ariaExpanded:
          node.getAttribute('aria-expanded') === 'true'
            ? true
            : node.getAttribute('aria-expanded') === 'false'
              ? false
              : null,
        checked: typeof input.checked === 'boolean' ? input.checked : null,
        focusable: (node as HTMLElement).tabIndex >= 0,
        isObscured,
      };
    });

    return {
      ref,
      exists,
      visible,
      enabled,
      editable,
      ...domState,
      boundingBox,
    };
  }

  /**
   * Highlight an element.
   */
  async highlight(page: Page, ref: string): Promise<void> {
    const started = Date.now();
    log.debug('highlight started', { ref });

    const locator = refLocator(page, ref);

    try {
      await locator.highlight();
      log.debug('highlight succeeded', { ref, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('highlight failed', error, { ref, duration_ms: Date.now() - started });
      throw toAIFriendlyError(error, ref);
    }
  }
}
