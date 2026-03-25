/**
 * Interaction Service
 *
 * Performs user interactions on browser pages.
 * Extracted from: src/browser/pw-tools-core.interactions.ts
 */

import type { Locator, Page } from 'playwright-core';

/**
 * Browser form field
 */
export type BrowserFormField = {
  ref: string;
  type: string;
  value?: string | number | boolean;
};

/**
 * Interaction options
 */
export type InteractionOptions = {
  targetId?: string;
  timeoutMs?: number;
};

/**
 * Interaction result
 */
export type InteractionResult = {
  ok: true;
  targetId?: string;
  url?: string;
  result?: unknown;
};

/**
 * Click action
 */
export type ClickAction = {
  kind: 'click';
  ref: string;
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift' | 'ControlOrMeta'>;
  timeoutMs?: number;
};

/**
 * Type action
 */
export type TypeAction = {
  kind: 'type';
  ref: string;
  text: string;
  clear?: boolean;
  submit?: boolean;
  slowly?: boolean;
  timeoutMs?: number;
};

/**
 * Fill action
 */
export type FillAction = {
  kind: 'fill';
  fields: BrowserFormField[];
  timeoutMs?: number;
};

/**
 * Hover action
 */
export type HoverAction = {
  kind: 'hover';
  ref: string;
  timeoutMs?: number;
};

/**
 * Press action
 */
export type PressAction = {
  kind: 'press';
  key: string;
  delayMs?: number;
};

/**
 * Navigate action
 */
export type NavigateAction = {
  kind: 'navigate';
  url: string;
  timeoutMs?: number;
};

/**
 * Wait action
 */
export type WaitAction = {
  kind: 'wait';
  timeMs?: number;
  text?: string;
  textGone?: string;
  selector?: string;
  url?: string;
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  fn?: string;
  timeoutMs?: number;
};

/**
 * Evaluate action
 */
export type EvaluateAction = {
  kind: 'evaluate';
  fn: string;
  ref?: string;
};

/**
 * Drag action
 */
export type DragAction = {
  kind: 'drag';
  startRef: string;
  endRef: string;
  timeoutMs?: number;
};

/**
 * Select action
 */
export type SelectAction = {
  kind: 'select';
  ref: string;
  values: string[];
  timeoutMs?: number;
};

/**
 * Scroll action
 */
export type ScrollAction = {
  kind: 'scrollIntoView';
  ref: string;
  timeoutMs?: number;
};

/**
 * Resize action
 */
export type ResizeAction = {
  kind: 'resize';
  width: number;
  height: number;
};

/**
 * Close action
 */
export type CloseAction = {
  kind: 'close';
};

/**
 * Browser action types union
 */
export type BrowserAction =
  | ClickAction
  | TypeAction
  | FillAction
  | HoverAction
  | PressAction
  | NavigateAction
  | WaitAction
  | EvaluateAction
  | DragAction
  | SelectAction
  | ScrollAction
  | ResizeAction
  | CloseAction;

/**
 * Fill result for form field operations
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
 * Interaction Service
 *
 * Performs user interactions on browser pages.
 */
export class InteractionService {
  /**
   * Execute browser action
   * @param page - Page to interact with
   * @param action - Action to execute
   * @param locateRef - Resolver for stable ref lookups
   * @returns Interaction result
   */
  async executeAction(
    page: Page,
    action: BrowserAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    switch (action.kind) {
      case 'click':
        return this.handleClick(page, action, locateRef);
      case 'type':
        return this.handleType(page, action, locateRef);
      case 'fill':
        return this.handleFill(page, action, locateRef);
      case 'hover':
        return this.handleHover(page, action, locateRef);
      case 'press':
        return this.handlePress(page, action);
      case 'navigate':
        return this.handleNavigate(page, action);
      case 'wait':
        return this.handleWait(page, action);
      case 'evaluate':
        return this.handleEvaluate(page, action, locateRef);
      case 'drag':
        return this.handleDrag(page, action, locateRef);
      case 'select':
        return this.handleSelect(page, action, locateRef);
      case 'scrollIntoView':
        return this.handleScroll(page, action, locateRef);
      case 'resize':
        return this.handleResize(page, action);
      case 'close':
        return this.handleClose(page);
      default:
        throw new Error(`Unknown action kind: ${(action as { kind: string }).kind}`);
    }
  }

  /**
   * Handle click action
   */
  private async handleClick(
    page: Page,
    action: ClickAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, locateRef);
    const timeout = action.timeoutMs ?? 8000;

    if (action.doubleClick) {
      await locator.dblclick({ timeout, button: action.button });
    } else {
      await locator.click({ timeout, button: action.button, modifiers: action.modifiers });
    }

    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle type action
   */
  private async handleType(
    page: Page,
    action: TypeAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, locateRef);
    const timeout = action.timeoutMs ?? 8000;

    if (action.clear) {
      await locator.clear({ timeout });
    }

    if (action.slowly) {
      await locator.click({ timeout });
      await locator.type(action.text, { timeout, delay: 75 });
    } else {
      await locator.fill(action.text, { timeout });
    }

    if (action.submit) {
      await locator.press('Enter', { timeout });
    }

    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle fill action
   */
  private async handleFill(
    page: Page,
    action: FillAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    const results: FillResult[] = [];
    const timeout = action.timeoutMs ?? 8000;

    for (const field of action.fields) {
      const locator = this.refLocator(page, field.ref, locateRef);
      const type = field.type.trim();
      const rawValue = field.value;
      const value = String(field.value ?? '');

      if (type === 'checkbox' || type === 'radio') {
        const checked =
          rawValue === true || rawValue === 1 || rawValue === '1' || rawValue === 'true';
        try {
          await locator.setChecked(checked, { timeout });
          results.push({
            ref: field.ref,
            requestedValue: String(checked),
            actualValue: String(checked),
            matched: true,
            strategy: 'fill',
          });
        } catch {
          results.push({
            ref: field.ref,
            requestedValue: String(checked),
            actualValue: '',
            matched: false,
            strategy: 'fill',
          });
        }
        continue;
      }

      // Try fill
      try {
        await locator.fill(value, { timeout });
      } catch {
        // Fallback to sequential type
        await locator.click({ timeout: 3000 });
        await locator.selectText({ timeout: 2000 }).catch(() => {});
        await page.keyboard.type(value, { delay: 30 });
      }

      // Verify fill
      const actualValue = await locator.inputValue({ timeout: 2000 }).catch(() => '');
      results.push({
        ref: field.ref,
        requestedValue: value,
        actualValue,
        matched: actualValue.trim() === value.trim(),
        strategy: 'fill',
      });
    }

    return { ok: true, targetId: undefined, url: page.url(), result: { results } };
  }

  /**
   * Handle hover action
   */
  private async handleHover(
    page: Page,
    action: HoverAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, locateRef);
    await locator.hover({ timeout: action.timeoutMs ?? 8000 });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle press action
   */
  private async handlePress(page: Page, action: PressAction): Promise<InteractionResult> {
    await page.keyboard.press(action.key, { delay: action.delayMs ?? 0 });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle navigate action
   */
  private async handleNavigate(page: Page, action: NavigateAction): Promise<InteractionResult> {
    const timeout = Math.max(1000, Math.min(120_000, action.timeoutMs ?? 20_000));
    await page.goto(action.url, {
      timeout,
    });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle wait action
   */
  private async handleWait(page: Page, action: WaitAction): Promise<InteractionResult> {
    const timeout = action.timeoutMs ?? 20000;

    if (typeof action.timeMs === 'number') {
      await page.waitForTimeout(action.timeMs);
    }
    if (action.text) {
      await page.getByText(action.text).first().waitFor({ state: 'visible', timeout });
    }
    if (action.textGone) {
      await page.getByText(action.textGone).first().waitFor({ state: 'hidden', timeout });
    }
    if (action.selector) {
      await page.locator(action.selector).first().waitFor({ state: 'visible', timeout });
    }
    if (action.url) {
      await page.waitForURL(action.url, { timeout });
    }
    if (action.loadState) {
      await page.waitForLoadState(action.loadState, { timeout });
    }
    if (action.fn) {
      await page.waitForFunction(action.fn, { timeout });
    }

    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle evaluate action
   */
  private async handleEvaluate(
    page: Page,
    action: EvaluateAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    if (action.ref) {
      const locator = this.refLocator(page, action.ref, locateRef);
      const result = await locator.evaluate((el, fnBody) => {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = new Function('el', `return (${fnBody})(el)`);
        return fn(el);
      }, action.fn);
      return { ok: true, targetId: undefined, url: page.url(), result };
    }

    const result = await page.evaluate((fnBody) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(`return (${fnBody})()`);
      return fn();
    }, action.fn);

    return { ok: true, targetId: undefined, url: page.url(), result };
  }

  /**
   * Handle drag action
   */
  private async handleDrag(
    page: Page,
    action: DragAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    const startLocator = this.refLocator(page, action.startRef, locateRef);
    const endLocator = this.refLocator(page, action.endRef, locateRef);
    await startLocator.dragTo(endLocator, { timeout: action.timeoutMs ?? 8000 });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle select action
   */
  private async handleSelect(
    page: Page,
    action: SelectAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, locateRef);
    await locator.selectOption(action.values, { timeout: action.timeoutMs ?? 8000 });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle scroll action
   */
  private async handleScroll(
    page: Page,
    action: ScrollAction,
    locateRef?: (ref: string) => Locator,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, locateRef);
    await locator.scrollIntoViewIfNeeded({ timeout: action.timeoutMs ?? 8000 });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle resize action
   */
  private async handleResize(page: Page, action: ResizeAction): Promise<InteractionResult> {
    await page.setViewportSize({
      width: Math.max(1, Math.floor(action.width)),
      height: Math.max(1, Math.floor(action.height)),
    });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle close action
   */
  private async handleClose(page: Page): Promise<InteractionResult> {
    await page.close();
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Create locator from reference
   */
  private refLocator(page: Page, ref: string, locateRef?: (ref: string) => Locator) {
    const normalized = ref.startsWith('@')
      ? ref.slice(1)
      : ref.startsWith('ref=')
        ? ref.slice(4)
        : ref;

    if (locateRef) {
      return locateRef(normalized);
    }

    return page.locator(`[aria-ref="${normalized}"]`);
  }
}
