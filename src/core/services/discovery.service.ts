/**
 * Discovery Service
 * 
 * Discovers and analyzes DOM elements, dropdowns, and blocking elements.
 * Extracted from: src/browser/pw-tools-core.dom-observer.ts
 */

import type { Locator, Page } from 'playwright-core';

/**
 * Incremental element detected by the MutationObserver
 */
export type IncrementalElement = {
  tagName: string;
  role: string | null;
  text: string;
  className: string;
  ariaInvalid: string | null;
  isError: boolean;
  ref?: string;
  rect?: { x: number; y: number; width: number; height: number };
  ariaLabel?: string;
  ariaSelected?: string;
  dataValue?: string;
  isInteractable?: boolean;
};

/**
 * DOM delta results after stopping the observer
 */
export type DomDelta = {
  addedElements: IncrementalElement[];
  removedElements: Array<{ ref?: string; text: string; tagName: string }>;
  modifiedElements: Array<{
    ref: string | null;
    tagName: string;
    attr: string;
    oldValue: string | null;
    newValue: string | null;
    text: string;
  }>;
  urlChanged: boolean;
  previousUrl: string;
  currentUrl: string;
  observationDurationMs: number;
};

/**
 * Dropdown option
 */
export type DropdownOption = {
  ref: string;
  text: string;
  value?: string;
  selected?: boolean;
};

/**
 * Blocking element information
 */
export type BlockerInfo = {
  type: 'modal' | 'overlay' | 'popup' | 'cookie-banner';
  selector: string;
  closeSelector?: string;
  suggestedStrategy: 'click-close' | 'press-escape' | 'click-outside';
};

/**
 * Element state
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
 * Blocking element info
 */
export type BlockingElementInfo = {
  isBlocked: boolean;
  blockerTagName?: string;
  blockerRole?: string;
  blockerText?: string;
  blockerClassName?: string;
  blockerZIndex?: number;
  blockerRect?: { x: number; y: number; width: number; height: number };
  dismissStrategy?: 'click_close' | 'press_escape' | 'click_outside' | 'scroll' | 'unknown';
  closeButtonText?: string;
  closeButtonAriaLabel?: string;
};

/**
 * Observer JS to inject into page
 */
const OBSERVER_JS = `
(function() {
  window.__skyvernDeltaObserver = {
    added: [],
    removed: [],
    modified: [],
    startUrl: window.location.href,
    startTime: 0,
    observer: null,

    start(anchorElement) {
      this.added = [];
      this.removed = [];
      this.modified = [];
      this.startUrl = window.location.href;
      this.startTime = Date.now();

      if (this.observer) {
        this.observer.disconnect();
      }

      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            this._processAddedNode(node);
          }
          for (const node of mutation.removedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            this.removed.push({
              tagName: node.tagName?.toLowerCase() || '',
              text: (node.textContent || '').trim().slice(0, 100),
              ref: node.getAttribute?.('aria-ref') || null,
            });
          }
          if (mutation.type === 'attributes') {
            const target = mutation.target;
            if (target.nodeType !== Node.ELEMENT_NODE) continue;
            const attr = mutation.attributeName;
            const interestingAttrs = [
              'value', 'class', 'disabled', 'readonly', 'aria-invalid',
              'aria-expanded', 'aria-hidden', 'aria-selected', 'style', 'hidden'
            ];
            if (interestingAttrs.includes(attr)) {
              this.modified.push({
                tagName: target.tagName?.toLowerCase() || '',
                attr,
                oldValue: mutation.oldValue,
                newValue: target.getAttribute(attr),
                ref: target.getAttribute('aria-ref') || null,
                text: (target.textContent || '').trim().slice(0, 80),
              });
            }
          }
        }
      });

      this.observer.observe(anchorElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        attributeFilter: [
          'value', 'class', 'disabled', 'readonly', 'aria-invalid',
          'aria-expanded', 'aria-hidden', 'aria-selected', 'style', 'hidden',
        ],
      });
    },

    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      return {
        addedElements: this.added.slice(0, 200),
        removedElements: this.removed.slice(0, 50),
        modifiedElements: this.modified.slice(0, 100),
        urlChanged: window.location.href !== this.startUrl,
        previousUrl: this.startUrl,
        currentUrl: window.location.href,
        observationDurationMs: Date.now() - (this.startTime || Date.now()),
      };
    },

    _processAddedNode(node) {
      const rect = node.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      if (isVisible) {
          this.added.push(this._serializeElement(node, rect));
      }
      for (const child of node.querySelectorAll('*')) {
        const childRect = child.getBoundingClientRect();
        if (childRect.width > 0 && childRect.height > 0) {
          this.added.push(this._serializeElement(child, childRect));
        }
      }
    },

    _serializeElement(el, rect) {
      return {
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text: (el.textContent || '').trim().slice(0, 200),
        className: (el.className?.toString?.() || '').slice(0, 80),
        ariaInvalid: el.getAttribute('aria-invalid'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaSelected: el.getAttribute('aria-selected'),
        dataValue: el.getAttribute('data-value') || el.getAttribute('value'),
        ref: el.getAttribute('aria-ref'),
        isError: (
          (el.className?.toString?.() || '').match(/error|invalid|danger|warning/i) !== null ||
          el.getAttribute('role') === 'alert' ||
          el.getAttribute('aria-invalid') === 'true'
        ),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        isInteractable: (
          el.tagName === 'BUTTON' ||
          el.tagName === 'A' ||
          el.tagName === 'INPUT' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'OPTION' ||
          el.getAttribute('role') === 'button' ||
          el.getAttribute('role') === 'link' ||
          el.getAttribute('role') === 'checkbox' ||
          el.getAttribute('role') === 'menuitem' ||
          el.getAttribute('role') === 'option' ||
          el.getAttribute('tabindex') !== null ||
          el.onclick !== null ||
          window.getComputedStyle(el).cursor === 'pointer'
        ),
      };
    }
  };
})();
`;

/**
 * Discovery Service
 * 
 * Discovers and analyzes DOM elements, dropdowns, and blocking elements.
 */
export class DiscoveryService {
  private resolveLocator(page: Page, ref: string, resolveRef?: (ref: string) => Locator): Locator {
    return resolveRef ? resolveRef(ref) : page.locator(`[aria-ref="${ref}"]`);
  }

  /**
   * Start DOM delta observation
   * @param page - Page to observe
   * @param anchorRef - Optional anchor reference for scoped observation
   * @returns Observer status
   */
  async startDomObserver(
    page: Page,
    anchorRef?: string,
    resolveRef?: (ref: string) => Locator,
  ): Promise<{ observing: true }> {
    await page.evaluate(OBSERVER_JS);

    let anchorElement = null;
    if (anchorRef) {
      try {
        const locator = this.resolveLocator(page, anchorRef, resolveRef);
        anchorElement = await locator.elementHandle();
      } catch {
        // Fallback to body if anchor not found
      }
    }

    await page.evaluate(
      (anchor) => {
        (window as any).__skyvernDeltaObserver.start(anchor);
      },
      anchorElement,
    );

    return { observing: true };
  }

  /**
   * Stop DOM observation and get delta
   * @param page - Page that was observed
   * @returns DOM delta
   */
  async stopDomObserver(page: Page): Promise<DomDelta> {
    const delta = await page.evaluate(() => {
      const observer = (window as any).__skyvernDeltaObserver;
      if (!observer) return null;
      return observer.stop();
    });

    if (!delta) {
      throw new Error('Delta observer not started or lost due to navigation/refresh');
    }

    return delta as DomDelta;
  }

  /**
   * Discover dropdown options by triggering and observing DOM changes
   * @param page - Page containing dropdown
   * @param ref - Dropdown element reference
   * @param searchText - Optional search text for typeahead
   * @param timeoutMs - Timeout in milliseconds
   * @returns Discovered options
   */
  async discoverDropdownOptions(
    page: Page,
    ref: string,
    searchText?: string,
    timeoutMs?: number,
    resolveRef?: (ref: string) => Locator,
  ): Promise<{
    options: IncrementalElement[];
    dropdownOpen: boolean;
    triggerMethod: 'click' | 'arrowdown' | 'typeahead' | 'none';
  }> {
    const locator = this.resolveLocator(page, ref, resolveRef);
    let triggerMethod: 'click' | 'arrowdown' | 'typeahead' | 'none' = 'none';
    let options: IncrementalElement[] = [];

    await locator.scrollIntoViewIfNeeded({ timeout: 5000 });

    // Try click
    triggerMethod = 'click';
    await this.startDomObserver(page, undefined, resolveRef);
    await locator.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    let incremental = await this.stopDomObserver(page);
    options = incremental.addedElements;

    // Try ArrowDown if no new elements
    if (options.length === 0) {
      triggerMethod = 'arrowdown';
      await this.startDomObserver(page, undefined, resolveRef);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(500);
      incremental = await this.stopDomObserver(page);
      options = incremental.addedElements;
    }

    // Try typing if still no new elements
    if (options.length === 0 && searchText) {
      triggerMethod = 'typeahead';
      await this.startDomObserver(page, undefined, resolveRef);
      await locator.pressSequentially(searchText, { delay: 50 });
      await page.waitForTimeout(500);
      incremental = await this.stopDomObserver(page);
      options = incremental.addedElements;
    }

    // Filter and assign refs
    options = options.filter((o) => o.isInteractable || o.text.length > 0);

    if (options.length > 0) {
      await this.injectIncrementalRefs(page, options);
    }

    return {
      options,
      dropdownOpen: options.length > 0,
      triggerMethod,
    };
  }

  /**
   * Close dropdown
   * @param page - Page containing dropdown
   * @param ref - Dropdown element reference
   */
  async closeDropdown(page: Page, ref: string, resolveRef?: (ref: string) => Locator): Promise<void> {
    const locator = this.resolveLocator(page, ref, resolveRef);
    await page.keyboard.press('Escape');
    await locator.blur().catch(() => {});
  }

  /**
   * Detect blocking element
   * @param page - Page to check
   * @param ref - Target element reference
   * @returns Blocking element info or null
   */
  async detectBlockingElement(
    page: Page,
    ref: string,
    resolveRef?: (ref: string) => Locator,
  ): Promise<BlockingElementInfo | null> {
    const locator = this.resolveLocator(page, ref, resolveRef);

    const result = await locator.evaluate((target: Element) => {
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return { isBlocked: false, reason: 'target_not_visible' };
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);

      if (!topElement) return { isBlocked: false };
      if (topElement === target || target.contains(topElement) || topElement.contains(target)) {
        return { isBlocked: false };
      }

      // Walk up to find modal/overlay container
      let container = topElement;
      let depth = 0;
      while (container.parentElement && depth < 10) {
        const style = getComputedStyle(container);
        const role = container.getAttribute('role');
        if (
          role === 'dialog' ||
          role === 'alertdialog' ||
          style.position === 'fixed' ||
          style.position === 'absolute' ||
          (style.zIndex && parseInt(style.zIndex) > 100)
        )
          break;
        container = container.parentElement;
        depth++;
      }

      // Look for close buttons
      const closeSelectors = [
        'button[aria-label*="close" i]',
        'button[aria-label*="dismiss" i]',
        'button[aria-label*="accept" i]',
        'button[class*="close" i]',
        'button[class*="dismiss" i]',
        '[role="button"][aria-label*="close" i]',
        'a[class*="close" i]',
        'button:has(svg)',
      ];

      let closeButton: Element | null = null;
      for (const selector of closeSelectors) {
        const found = container.querySelector(selector);
        if (found) {
          const foundRect = found.getBoundingClientRect();
          if (foundRect.width > 0 && foundRect.height > 0) {
            closeButton = found;
            break;
          }
        }
      }

      if (!closeButton) {
        const acceptPatterns = /accept|ok|got it|i agree|i understand|continue|dismiss|close/i;
        const buttons = container.querySelectorAll("button, a[role='button'], [role='button']");
        for (const btn of Array.from(buttons)) {
          if (acceptPatterns.test(btn.textContent || '')) {
            const btnRect = btn.getBoundingClientRect();
            if (btnRect.width > 0 && btnRect.height > 0) {
              closeButton = btn;
              break;
            }
          }
        }
      }

      const containerRect = container.getBoundingClientRect();
      const containerStyle = getComputedStyle(container);
      const role = container.getAttribute('role');

      let dismissStrategy = 'unknown';
      if (closeButton) dismissStrategy = 'click_close';
      else if (role === 'dialog' || role === 'alertdialog') dismissStrategy = 'press_escape';
      else if (containerStyle.position === 'fixed') dismissStrategy = 'press_escape';

      return {
        isBlocked: true,
        blockerTagName: container.tagName.toLowerCase(),
        blockerRole: role || undefined,
        blockerText: (container.textContent || '').trim().slice(0, 200),
        blockerClassName: (container.className?.toString?.() || '').slice(0, 100),
        blockerZIndex: parseInt(containerStyle.zIndex) || undefined,
        blockerRect: {
          x: containerRect.x,
          y: containerRect.y,
          width: containerRect.width,
          height: containerRect.height,
        },
        dismissStrategy,
        closeButtonText: closeButton
          ? (closeButton.textContent || '').trim().slice(0, 50)
          : undefined,
        closeButtonAriaLabel: closeButton?.getAttribute('aria-label') || undefined,
      };
    });

    return result as BlockingElementInfo | null;
  }

  /**
   * Dismiss blocker
   * @param page - Page with blocker
   * @param targetRef - Target element reference
   * @param strategy - Optional dismiss strategy
   * @param closeButtonRef - Optional close button reference
   * @returns Dismissal result
   */
  async dismissBlocker(
    page: Page,
    targetRef: string,
    strategy?: 'click_close' | 'press_escape' | 'click_outside',
    closeButtonRef?: string,
    resolveRef?: (ref: string) => Locator,
  ): Promise<{ dismissed: boolean; strategy: string }> {
    const strategies = strategy
      ? [strategy]
      : (['click_close', 'press_escape', 'click_outside'] as const);

    for (const strat of strategies) {
      try {
        if (strat === 'click_close' && closeButtonRef) {
          await this.resolveLocator(page, closeButtonRef, resolveRef).click({ timeout: 3000 });
        } else if (strat === 'press_escape') {
          await page.keyboard.press('Escape');
        } else if (strat === 'click_outside') {
          await page.mouse.click(1, 1);
        }

        await page.waitForTimeout(500);

        const check = await this.detectBlockingElement(page, targetRef, resolveRef);
        if (!check?.isBlocked) {
          return { dismissed: true, strategy: strat };
        }
      } catch {
        // Try next strategy
      }
    }

    return { dismissed: false, strategy: 'all_failed' };
  }

  /**
   * Query element state
   * @param page - Page containing element
   * @param ref - Element reference
   * @returns Element state
   */
  async queryElementState(
    page: Page,
    ref: string,
    resolveRef?: (ref: string) => Locator,
  ): Promise<ElementState> {
    const locator = this.resolveLocator(page, ref, resolveRef);

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
   * Inject incremental refs into discovered elements
   * @param page - Page containing elements
   * @param elements - Elements to inject refs into
   */
  private async injectIncrementalRefs(page: Page, elements: IncrementalElement[]): Promise<void> {
    await page.evaluate((els) => {
      for (const el of els) {
        if (!el.rect) continue;
        const centerX = el.rect.x + el.rect.width / 2;
        const centerY = el.rect.y + el.rect.height / 2;
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        if (elementAtPoint) {
          let target: Element | null = elementAtPoint;
          while (target && target !== document.body) {
            if (
              target.tagName.toLowerCase() === el.tagName &&
              (target.textContent || '').trim().slice(0, 200) === el.text
            ) {
              if (el.ref) {
                target.setAttribute('aria-ref', el.ref);
              }
              break;
            }
            target = target.parentElement;
          }
        }
      }
    }, elements);
  }
}
