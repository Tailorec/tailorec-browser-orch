import type { Browser, BrowserContext, Page, Locator } from 'playwright-core';
import { chromium } from 'playwright-core';
import { createSubsystemLogger } from '../logging/logger.adapter.js';
import {
  getHeadersWithAuth,
  normalizeCdpUrl,
  resolvePlaywrightCdpEndpoint,
} from '../utils/cdp.utils.js';
import { redactBrowserEndpoint } from '../../shared/utils/browser-endpoint.utils.js';

const log = createSubsystemLogger('pw-browser-driver');

/**
 * Tab information.
 */
export type TabInfo = {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
};

/**
 * Represents a connected browser instance over CDP.
 */
export type ConnectedBrowser = {
  browser: Browser;
  cdpUrl: string;
};

/**
 * PlaywrightBrowserDriverAdapter implements browser driver functionality
 * by connecting to Chrome over CDP using Playwright.
 * 
 * This adapter extracts logic from pw-session.ts to provide:
 * - CDP connection management
 * - Page creation/closure
 * - Tab listing and management
 */
export class PlaywrightBrowserDriverAdapter {
  private cachedByCdpUrl = new Map<string, Browser>();
  private connectingByCdpUrl = new Map<string, Promise<{ browser: Browser; cdpUrl: string }>>();
  private observedContexts = new WeakSet<BrowserContext>();
  private observedPages = new WeakSet<Page>();

  /**
   * Connect to a browser over CDP.
   */
  async connect(cdpUrl: string): Promise<Browser> {
    const normalized = normalizeCdpUrl(cdpUrl);

    const cached = this.cachedByCdpUrl.get(normalized);
    if (cached?.isConnected()) {
      log.debug('reusing cached cdp browser connection', { cdp_url: normalized });
      return cached;
    }
    if (cached && !cached.isConnected()) {
      this.cachedByCdpUrl.delete(normalized);
    }

    const inFlight = this.connectingByCdpUrl.get(normalized);
    if (inFlight) {
      log.debug('awaiting in-flight cdp connection', { cdp_url: normalized });
      const connected = await inFlight;
      return connected.browser;
    }

    const connectWithRetry = async (): Promise<{ browser: Browser; cdpUrl: string }> => {
      let lastErr: unknown;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const timeout = 5000 + attempt * 2000;
          log.info('connecting over CDP', {
            browser_endpoint: redactBrowserEndpoint(normalized),
            attempt: attempt + 1,
            timeout_ms: timeout,
          });

          const endpoint = await resolvePlaywrightCdpEndpoint(normalized);
          const headers = getHeadersWithAuth(endpoint);

          const browser = await chromium.connectOverCDP(endpoint, { timeout, headers });
          const connected = { browser, cdpUrl: normalized };

          this.cachedByCdpUrl.set(normalized, browser);
          this.observeBrowser(browser);

          browser.on('disconnected', () => {
            if (this.cachedByCdpUrl.get(normalized) === browser) {
              this.cachedByCdpUrl.delete(normalized);
            }
            log.warn('cdp browser disconnected', {
              browser_endpoint: redactBrowserEndpoint(normalized),
            });
          });
          
          log.info('cdp connect succeeded', {
            browser_endpoint: redactBrowserEndpoint(normalized),
            connect_endpoint: redactBrowserEndpoint(endpoint),
          });
          return connected;
        } catch (err) {
          lastErr = err;
          log.warn('cdp connect attempt failed', {
            browser_endpoint: redactBrowserEndpoint(normalized),
            attempt: attempt + 1,
            error: String(err),
          });
          const delay = 250 + attempt * 250;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      
      if (lastErr instanceof Error) {
        throw lastErr;
      }
      throw new Error(lastErr ? `CDP connect failed: ${String(lastErr)}` : 'CDP connect failed');
    };

    const promise = connectWithRetry().finally(() => {
      this.connectingByCdpUrl.delete(normalized);
    });
    this.connectingByCdpUrl.set(normalized, promise);

    const result = await promise;
    return result.browser;
  }

  /**
   * Disconnect and close a browser.
   */
  async disconnect(browser: Browser): Promise<void> {
    const cachedEntry = Array.from(this.cachedByCdpUrl.entries()).find(([, cached]) => cached === browser);
    const cdpUrl = cachedEntry?.[0];
    log.info('closing playwright browser connection', { cdp_url: cdpUrl });
    
    try {
      await browser.close();
    } catch {
      // Ignore close errors
    }
    
    if (cdpUrl && this.cachedByCdpUrl.get(cdpUrl) === browser) {
      this.cachedByCdpUrl.delete(cdpUrl);
    }
  }

  async disconnectByCdpUrl(cdpUrl: string): Promise<void> {
    const normalized = normalizeCdpUrl(cdpUrl);
    const browser = this.cachedByCdpUrl.get(normalized);
    if (!browser) {
      return;
    }
    await this.disconnect(browser);
  }

  /**
   * Create a new page in the browser.
   */
  async createPage(browser: Browser, url: string = 'about:blank'): Promise<Page> {
    const contexts = browser.contexts();
    const context = contexts[0] ?? await browser.newContext();
    
    this.ensureContextState(context);
    
    const page = await context.newPage();
    this.ensurePageState(page);
    
    if (url !== 'about:blank') {
      await page.goto(url, { timeout: 30_000 }).catch(() => {
        // Navigation might fail for some URLs, but page is still created
      });
    }
    
    return page;
  }

  /**
   * Close a page.
   */
  async closePage(page: Page): Promise<void> {
    await page.close();
  }

  /**
   * Bring a page to the front.
   */
  async focusPage(page: Page): Promise<void> {
    await page.bringToFront();
  }

  /**
   * List all pages/tabs in the browser.
   */
  async listPages(browser: Browser): Promise<TabInfo[]> {
    const contexts = browser.contexts();
    const pages = contexts.flatMap((c) => c.pages());
    const results: TabInfo[] = [];

    for (const page of pages) {
      try {
        const targetId = await this.getPageTargetId(page);
        if (targetId) {
          results.push({
            targetId,
            type: 'page',
            title: await page.title().catch(() => ''),
            url: page.url(),
            attached: true,
          });
        }
      } catch {
        // Skip pages that can't be queried
      }
    }

    return results;
  }

  /**
   * Get a page by target ID.
   */
  async getPage(browser: Browser, targetId?: string, cdpUrl?: string): Promise<Page> {
    const pages = await this.getAllPages(browser);
    
    if (!pages.length) {
      throw new Error('No pages available in the connected browser.');
    }
    
    if (!targetId) {
      return pages[0];
    }
    
    const found = await this.findPageByTargetId(browser, targetId, cdpUrl);
    
    if (!found) {
      throw new Error('tab not found');
    }
    
    return found;
  }

  /**
   * Create locator from reference.
   */
  refLocator(page: Page, ref: string): Locator {
    const normalized = ref.startsWith('@')
      ? ref.slice(1)
      : ref.startsWith('ref=')
        ? ref.slice(4)
        : ref;

    // Handle aria-ref locator as the primary mechanism
    return page.locator(`[aria-ref="${normalized}"]`);
  }

  private async getAllPages(browser: Browser): Promise<Page[]> {
    const contexts = browser.contexts();
    return contexts.flatMap((c) => c.pages());
  }

  private async getPageTargetId(page: Page): Promise<string | null> {
    try {
      const session = await page.context().newCDPSession(page);
      try {
        const info = await session.send('Target.getTargetInfo');
        const targetId = String(info?.targetInfo?.targetId ?? '').trim();
        return targetId || null;
      } finally {
        await session.detach().catch(() => {});
      }
    } catch {
      return null;
    }
  }

  private async findPageByTargetId(
    browser: Browser,
    targetId: string,
    _cdpUrl?: string,
  ): Promise<Page | null> {
    const pages = await this.getAllPages(browser);
    
    // First, try the standard CDP session approach
    for (const page of pages) {
      const tid = await this.getPageTargetId(page).catch(() => null);
      if (tid && tid === targetId) {
        return page;
      }
    }
    
    return null;
  }

  private observeBrowser(browser: Browser) {
    for (const context of browser.contexts()) {
      this.observeContext(context);
    }
  }

  private observeContext(context: BrowserContext) {
    if (this.observedContexts.has(context)) {
      return;
    }
    this.observedContexts.add(context);
    
    for (const page of context.pages()) {
      this.ensurePageState(page);
    }
    
    context.on('page', (page) => this.ensurePageState(page));
  }

  private ensurePageState(page: Page): void {
    // Placeholder for page state management
    // In full implementation, this would set up console/error/request observers
    if (!this.observedPages.has(page)) {
      this.observedPages.add(page);
      // State observation logic would go here
    }
  }

  private ensureContextState(context: BrowserContext): void {
    // Placeholder for context state management
  }

}
