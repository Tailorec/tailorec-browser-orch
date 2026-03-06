/**
 * Interaction Service
 *
 * Performs user interactions on browser pages.
 * Extracted from: src/browser/pw-tools-core.interactions.ts
 */

import type { Page } from 'playwright-core';
import type { RoleRefMap } from '../ports/session-store.port.js';

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
   * @param refs - Role references for element lookup
   * @returns Interaction result
   */
  async executeAction(
    page: Page,
    action: BrowserAction,
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    switch (action.kind) {
      case 'click':
        return this.handleClick(page, action, refs);
      case 'type':
        return this.handleType(page, action, refs);
      case 'fill':
        return this.handleFill(page, action, refs);
      case 'hover':
        return this.handleHover(page, action, refs);
      case 'press':
        return this.handlePress(page, action);
      case 'navigate':
        return this.handleNavigate(page, action);
      case 'wait':
        return this.handleWait(page, action);
      case 'evaluate':
        return this.handleEvaluate(page, action, refs);
      case 'drag':
        return this.handleDrag(page, action, refs);
      case 'select':
        return this.handleSelect(page, action, refs);
      case 'scrollIntoView':
        return this.handleScroll(page, action, refs);
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
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, refs);
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
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, refs);
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
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    const results: FillResult[] = [];
    const timeout = action.timeoutMs ?? 8000;

    for (const field of action.fields) {
      const locator = this.refLocator(page, field.ref, refs);
      const value = String(field.value ?? '');

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
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, refs);
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
    await page.goto(action.url, {
      waitUntil: 'networkidle',
      timeout: action.timeoutMs ?? 30000,
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
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    if (action.ref) {
      const locator = this.refLocator(page, action.ref, refs);
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
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    const startLocator = this.refLocator(page, action.startRef, refs);
    const endLocator = this.refLocator(page, action.endRef, refs);
    await startLocator.dragTo(endLocator, { timeout: action.timeoutMs ?? 8000 });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle select action
   */
  private async handleSelect(
    page: Page,
    action: SelectAction,
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, refs);
    await locator.selectOption(action.values, { timeout: action.timeoutMs ?? 8000 });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  /**
   * Handle scroll action
   */
  private async handleScroll(
    page: Page,
    action: ScrollAction,
    refs?: RoleRefMap,
  ): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref, refs);
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
  private refLocator(page: Page, ref: string, refs?: RoleRefMap) {
    const normalized = ref.startsWith('@')
      ? ref.slice(1)
      : ref.startsWith('ref=')
        ? ref.slice(4)
        : ref;

    // Handle e-style refs (e1, e2, etc.)
    if (/^e\d+$/.test(normalized) && refs) {
      const info = refs[normalized];
      if (!info) {
        throw new Error(`Unknown ref "${normalized}". Run a new snapshot first.`);
      }
      const locator = info.name
        ? page.getByRole(info.role as any, { name: info.name, exact: true })
        : page.getByRole(info.role as any);
      return info.nth !== undefined ? locator.nth(info.nth) : locator;
    }

    // Dynamic refs (d1, d2, etc.) or aria-ref
    return page.locator(`[aria-ref="${normalized}"]`);
  }
}
