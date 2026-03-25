/**
 * Navigation Service
 * 
 * Handles page navigation and URL management.
 * Extracted from: src/browser/pw-tools-core.snapshot.ts (navigateViaPlaywright)
 */

import type { Page } from 'playwright-core';

/**
 * Navigation options
 */
export type NavigationOptions = {
  /**
   * Timeout in milliseconds
   */
  timeoutMs?: number;

  /**
   * Wait until state
   */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
};

/**
 * Navigation result
 */
export type NavigationResult = {
  /**
   * Final URL after navigation
   */
  url: string;

  /**
   * Navigation status code
   */
  status?: number | null;

  /**
   * Whether navigation was successful
   */
  ok: boolean;
};

/**
 * Navigation history entry
 */
export type NavigationHistoryEntry = {
  url: string;
  title: string;
  timestamp: string;
};

/**
 * Navigation Service
 * 
 * Handles page navigation and URL management.
 */
export class NavigationService {
  private history = new Map<string, NavigationHistoryEntry[]>();

  /**
   * Navigate to URL
   * @param page - Page to navigate
   * @param url - URL to navigate to
   * @param options - Navigation options
   * @returns Navigation result
   */
  async navigate(page: Page, url: string, options?: NavigationOptions): Promise<NavigationResult> {
    const timeout = Math.max(1000, Math.min(120_000, options?.timeoutMs ?? 20_000));
    const waitUntil = options?.waitUntil;

    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      throw new Error('URL is required for navigation');
    }

    // Handle special URLs
    if (normalizedUrl === 'about:blank') {
      await page.goto('about:blank', { timeout });
      return {
        url: page.url(),
        status: 200,
        ok: true,
      };
    }

    // Navigate to URL
    const response = await page.goto(normalizedUrl, {
      timeout,
      ...(waitUntil ? { waitUntil } : {}),
    });

    // Record history
    this.recordHistory(page.url(), await page.title().catch(() => ''));

    return {
      url: page.url(),
      status: response?.status() ?? null,
      ok: response?.ok() ?? false,
    };
  }

  /**
   * Go back in history
   * @param page - Page to navigate back
   * @param options - Navigation options
   * @returns Navigation result
   */
  async goBack(page: Page, options?: NavigationOptions): Promise<NavigationResult> {
    const timeout = options?.timeoutMs ?? 30000;

    await page.goBack({ timeout });

    return {
      url: page.url(),
      status: null,
      ok: true,
    };
  }

  /**
   * Go forward in history
   * @param page - Page to navigate forward
   * @param options - Navigation options
   * @returns Navigation result
   */
  async goForward(page: Page, options?: NavigationOptions): Promise<NavigationResult> {
    const timeout = options?.timeoutMs ?? 30000;

    await page.goForward({ timeout });

    return {
      url: page.url(),
      status: null,
      ok: true,
    };
  }

  /**
   * Reload page
   * @param page - Page to reload
   * @param options - Navigation options
   * @returns Navigation result
   */
  async reload(page: Page, options?: NavigationOptions): Promise<NavigationResult> {
    const timeout = Math.max(1000, Math.min(120_000, options?.timeoutMs ?? 20_000));
    const waitUntil = options?.waitUntil;

    const response = await page.reload({
      timeout,
      ...(waitUntil ? { waitUntil } : {}),
    });

    return {
      url: page.url(),
      status: response?.status() ?? null,
      ok: response?.ok() ?? false,
    };
  }

  /**
   * Get current URL
   * @param page - Page to get URL from
   * @returns Current URL
   */
  getCurrentUrl(page: Page): string {
    return page.url();
  }

  /**
   * Get current title
   * @param page - Page to get title from
   * @returns Current title
   */
  async getCurrentTitle(page: Page): Promise<string> {
    return await page.title();
  }

  /**
   * Wait for URL
   * @param page - Page to wait on
   * @param urlPattern - URL pattern to wait for
   * @param options - Wait options
   */
  async waitForUrl(
    page: Page,
    urlPattern: string | RegExp,
    options?: { timeoutMs?: number },
  ): Promise<void> {
    const timeout = options?.timeoutMs ?? 30000;
    await page.waitForURL(urlPattern, { timeout });
  }

  /**
   * Wait for navigation
   * @param page - Page to wait on
   * @param options - Wait options
   */
  async waitForNavigation(
    page: Page,
    options?: { timeoutMs?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' },
  ): Promise<void> {
    const timeout = options?.timeoutMs ?? 30000;
    const waitUntil = options?.waitUntil ?? 'networkidle';
    await page.waitForNavigation({ timeout, waitUntil });
  }

  /**
   * Record navigation history
   * @param url - URL visited
   * @param title - Page title
   */
  private recordHistory(url: string, title: string): void {
    const entry: NavigationHistoryEntry = {
      url,
      title,
      timestamp: new Date().toISOString(),
    };

    // Get or create history array
    let history = this.history.get(url);
    if (!history) {
      history = [];
      this.history.set(url, history);
    }

    history.push(entry);

    // Limit history size
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get navigation history for URL
   * @param url - URL to get history for
   * @returns Navigation history entries
   */
  getHistory(url: string): NavigationHistoryEntry[] {
    return this.history.get(url) ?? [];
  }

  /**
   * Clear navigation history
   */
  clearHistory(): void {
    this.history.clear();
  }
}
