import type { Page } from 'playwright-core';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('pw-discovery-adapter');

/**
 * Represents a dropdown option.
 */
export type DropdownOption = {
  ref: string;
  text: string;
  value?: string;
  selected?: boolean;
};

/**
 * Information about a blocking element.
 */
export type BlockerInfo = {
  type: 'modal' | 'overlay' | 'popup' | 'cookie-banner';
  selector: string;
  closeSelector?: string | null;
  suggestedStrategy: 'click-close' | 'press-escape' | 'click-outside';
};

/**
 * PlaywrightDiscoveryAdapter provides element discovery functionality.
 * 
 * This adapter extracts discovery-related logic to provide:
 * - Dropdown option discovery
 * - Blocking element detection
 * - Element state queries
 */
export class PlaywrightDiscoveryAdapter {
  /**
   * Discover dropdown options.
   * 
   * Returns a list of options with refs that can be used for selection.
   */
  async discoverDropdownOptions(page: Page, ref: string): Promise<DropdownOption[]> {
    log.debug('discoverDropdownOptions started', { ref });

    try {
      const options = await page.evaluate((ref) => {
        const element = document.querySelector(`[aria-ref="${ref}"]`);
        if (!element) return [];

        const optionElements = element.querySelectorAll('[role="option"]');
        return Array.from(optionElements).map((opt, idx) => ({
          ref: `d${idx}`,
          text: opt.textContent?.trim() ?? '',
          value: (opt as any).value,
          selected: opt.getAttribute('aria-selected') === 'true',
        }));
      }, ref);

      log.info('discoverDropdownOptions succeeded', { ref, options_count: options.length });
      return options;
    } catch (error) {
      log.exception('discoverDropdownOptions failed', error, { ref });
      return [];
    }
  }

  /**
   * Close a dropdown.
   * 
   * Dispatches a blur event to close the dropdown.
   */
  async closeDropdown(page: Page, ref: string): Promise<void> {
    log.debug('closeDropdown started', { ref });

    try {
      await page.evaluate((ref) => {
        const element = document.querySelector(`[aria-ref="${ref}"]`);
        if (element) {
          element.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, ref);

      log.info('closeDropdown succeeded', { ref });
    } catch (error) {
      log.exception('closeDropdown failed', error, { ref });
      throw error;
    }
  }

  /**
   * Detect a blocking element.
   * 
   * Checks the center of the viewport for blocking elements like modals,
   * overlays, popups, or cookie banners.
   */
  async detectBlockingElement(page: Page): Promise<BlockerInfo | null> {
    log.debug('detectBlockingElement started', { url: page.url() });

    try {
      const blocker = await page.evaluate(() => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const topElement = document.elementFromPoint(centerX, centerY);

        if (!topElement || topElement === document.body) {
          return null;
        }

        const computedStyle = window.getComputedStyle(topElement);
        const isBlocking =
          computedStyle.position === 'fixed' ||
          computedStyle.position === 'absolute' ||
          (computedStyle.zIndex !== 'auto' && parseInt(computedStyle.zIndex) > 100);

        if (!isBlocking) return null;

        return {
          type: classifyBlocker(topElement),
          selector: getElementSelector(topElement),
          closeSelector: findCloseButton(topElement),
          suggestedStrategy: 'click-close' as const,
        };
      });

      if (blocker) {
        log.info('detectBlockingElement found blocker', {
          type: blocker.type,
          selector: blocker.selector,
        });
      } else {
        log.debug('detectBlockingElement no blocker found');
      }

      return blocker;
    } catch (error) {
      log.exception('detectBlockingElement failed', error, { url: page.url() });
      return null;
    }
  }

  /**
   * Dismiss a blocking element.
   * 
   * Supports multiple strategies:
   * - click-close: Click the close button
   * - press-escape: Press Escape key
   * - click-outside: Click outside the blocker
   */
  async dismissBlocker(page: Page, strategy: string = 'click-close'): Promise<boolean> {
    log.debug('dismissBlocker started', { strategy });

    try {
      if (strategy === 'click-close') {
        // Click close button
        await page.evaluate(() => {
          const closeBtn = document.querySelector('[class*="close"], [aria-label*="close"], [class*="dismiss"], [aria-label*="dismiss"]');
          if (closeBtn) {
            (closeBtn as HTMLElement).click();
          }
        });
        log.info('dismissBlocker succeeded with click-close');
        return true;
      } else if (strategy === 'press-escape') {
        await page.keyboard.press('Escape');
        log.info('dismissBlocker succeeded with press-escape');
        return true;
      } else if (strategy === 'click-outside') {
        await page.evaluate(() => {
          document.body.click();
        });
        log.info('dismissBlocker succeeded with click-outside');
        return true;
      }

      log.warn('dismissBlocker unknown strategy', { strategy });
      return false;
    } catch (error) {
      log.exception('dismissBlocker failed', error, { strategy });
      return false;
    }
  }

  /**
   * Query element state.
   * 
   * Checks if an element is in a specific state:
   * - visible: Element is visible on the page
   * - enabled: Element is not disabled
   * - editable: Element is not read-only
   * - obscured: Element is covered by another element
   */
  async queryElementState(page: Page, ref: string, state: string): Promise<boolean> {
    log.debug('queryElementState started', { ref, state });

    try {
      const result = await page.evaluate(({ ref, state }) => {
        const element = document.querySelector(`[aria-ref="${ref}"]`);
        if (!element) return false;

        switch (state) {
          case 'visible':
            // Check if element is actually visible (not just in DOM)
            if (!(element as any).checkVisibility?.()) {
              return false;
            }
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

          case 'enabled':
            return !(element as any).disabled;

          case 'editable':
            return !(element as any).readOnly;

          case 'obscured':
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const topElement = document.elementFromPoint(centerX, centerY);
            return topElement !== element && !element.contains(topElement);

          default:
            return false;
        }
      }, { ref, state });

      log.debug('queryElementState result', { ref, state, result });
      return result;
    } catch (error) {
      log.exception('queryElementState failed', error, { ref, state });
      return false;
    }
  }

  /**
   * Wait for an element to appear.
   */
  async waitForElement(page: Page, ref: string, timeoutMs: number = 5000): Promise<boolean> {
    log.debug('waitForElement started', { ref, timeoutMs });

    try {
      const locator = page.locator(`[aria-ref="${ref}"]`);
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });
      log.info('waitForElement succeeded', { ref });
      return true;
    } catch (error) {
      log.warn('waitForElement timeout', { ref, timeoutMs });
      return false;
    }
  }

  /**
   * Check if an element exists.
   */
  async elementExists(page: Page, ref: string): Promise<boolean> {
    try {
      const locator = page.locator(`[aria-ref="${ref}"]`);
      return (await locator.count()) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get element text content.
   */
  async getElementText(page: Page, ref: string): Promise<string | null> {
    try {
      const locator = page.locator(`[aria-ref="${ref}"]`);
      return await locator.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Get element attribute.
   */
  async getElementAttribute(page: Page, ref: string, attribute: string): Promise<string | null> {
    try {
      const locator = page.locator(`[aria-ref="${ref}"]`);
      return await locator.getAttribute(attribute);
    } catch {
      return null;
    }
  }
}

/**
 * Classify a blocker type based on its class name.
 */
function classifyBlocker(element: Element): 'modal' | 'overlay' | 'popup' | 'cookie-banner' {
  const className = element.className.toLowerCase();
  if (className.includes('cookie')) return 'cookie-banner';
  if (className.includes('modal')) return 'modal';
  if (className.includes('overlay')) return 'overlay';
  return 'popup';
}

/**
 * Get a CSS selector for an element.
 */
function getElementSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  if (element.className) {
    const firstClass = element.className.split(' ')[0];
    if (firstClass) return `.${firstClass}`;
  }
  return element.tagName.toLowerCase();
}

/**
 * Find a close button within an element.
 */
function findCloseButton(element: Element): string | null {
  const closeBtn = element.querySelector('[class*="close"], [aria-label*="close"], [class*="dismiss"], [aria-label*="dismiss"]');
  return closeBtn ? getElementSelector(closeBtn) : null;
}
