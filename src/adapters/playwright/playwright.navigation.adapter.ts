import type { Page } from 'playwright-core';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('pw-navigation-adapter');

/**
 * Options for navigation.
 */
export type NavigationOptions = {
  timeoutMs?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
};

/**
 * Result of navigation.
 */
export type NavigationResult = {
  url: string;
  title?: string;
  status?: number;
};

/**
 * PlaywrightNavigationAdapter provides navigation functionality for web pages.
 * 
 * This adapter extracts navigation-related logic to provide:
 * - Page navigation
 * - Viewport resizing
 * - Page closure
 * - PDF generation
 * - Screenshot capture
 */
export class PlaywrightNavigationAdapter {
  /**
   * Navigate to a URL.
   */
  async navigate(
    page: Page,
    url: string,
    options: NavigationOptions = {},
  ): Promise<NavigationResult> {
    const started = Date.now();
    const targetUrl = url.trim();
    
    if (!targetUrl) {
      throw new Error('url is required');
    }

    log.info('navigate started', { url: targetUrl });

    try {
      const timeout = options.timeoutMs ?? 20_000;
      const waitUntil = options.waitUntil ?? 'load';

      await page.goto(targetUrl, {
        timeout: Math.max(1000, Math.min(120_000, timeout)),
        waitUntil,
      });

      const result: NavigationResult = {
        url: page.url(),
        title: await page.title().catch(() => undefined),
      };

      log.info('navigate succeeded', {
        url: result.url,
        title: result.title,
        duration_ms: Date.now() - started,
      });

      return result;
    } catch (error) {
      log.exception('navigate failed', error, { url: targetUrl });
      throw error;
    }
  }

  /**
   * Resize the viewport.
   */
  async resizeViewport(
    page: Page,
    width: number,
    height: number,
  ): Promise<void> {
    const started = Date.now();
    log.debug('resize started', { width, height });

    try {
      await page.setViewportSize({
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      });

      log.info('resize succeeded', { duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('resize failed', error, { width, height });
      throw error;
    }
  }

  /**
   * Close a page.
   */
  async closePage(page: Page): Promise<void> {
    const started = Date.now();
    log.info('close page started', { url: page.url() });

    try {
      await page.close();
      log.info('close page succeeded', { duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('close page failed', error, { url: page.url() });
      throw error;
    }
  }

  /**
   * Generate a PDF of the page.
   */
  async generatePdf(page: Page): Promise<{ buffer: Buffer }> {
    const started = Date.now();
    log.debug('pdf generation started', { url: page.url() });

    try {
      const buffer = await page.pdf({
        printBackground: true,
        format: 'A4',
      });

      log.info('pdf generation succeeded', {
        bytes: buffer.length,
        duration_ms: Date.now() - started,
      });

      return { buffer };
    } catch (error) {
      log.exception('pdf generation failed', error, { url: page.url() });
      throw error;
    }
  }

  /**
   * Take a screenshot of the page.
   */
  async takeScreenshot(
    page: Page,
    options: {
      fullPage?: boolean;
      type?: 'png' | 'jpeg';
      quality?: number;
    } = {},
  ): Promise<{ buffer: Buffer }> {
    const started = Date.now();
    log.debug('screenshot started', {
      full_page: options.fullPage,
      type: options.type,
    });

    try {
      const type = options.type ?? 'png';
      const quality = options.quality ?? 85;

      const buffer = await page.screenshot({
        type,
        fullPage: options.fullPage ?? false,
        ...(type === 'jpeg' ? { quality } : {}),
      });

      log.info('screenshot succeeded', {
        bytes: buffer.length,
        duration_ms: Date.now() - started,
      });

      return { buffer };
    } catch (error) {
      log.exception('screenshot failed', error, { url: page.url() });
      throw error;
    }
  }

  /**
   * Take a screenshot of an element.
   */
  async screenshotElement(
    page: Page,
    ref: string,
    options: {
      type?: 'png' | 'jpeg';
    } = {},
  ): Promise<{ buffer: Buffer }> {
    const started = Date.now();
    log.debug('element screenshot started', { ref });

    try {
      const type = options.type ?? 'png';
      const locator = page.locator(`[aria-ref="${ref}"]`);
      const buffer = await locator.screenshot({ type });

      log.info('element screenshot succeeded', {
        ref,
        bytes: buffer.length,
        duration_ms: Date.now() - started,
      });

      return { buffer };
    } catch (error) {
      log.exception('element screenshot failed', error, { ref });
      throw error;
    }
  }

  /**
   * Reload the page.
   */
  async reload(
    page: Page,
    options: {
      timeoutMs?: number;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    } = {},
  ): Promise<NavigationResult> {
    const started = Date.now();
    log.info('reload started', { url: page.url() });

    try {
      const timeout = options.timeoutMs ?? 20_000;
      const waitUntil = options.waitUntil ?? 'load';

      await page.reload({
        timeout: Math.max(1000, Math.min(120_000, timeout)),
        waitUntil,
      });

      const result: NavigationResult = {
        url: page.url(),
        title: await page.title().catch(() => undefined),
      };

      log.info('reload succeeded', {
        url: result.url,
        duration_ms: Date.now() - started,
      });

      return result;
    } catch (error) {
      log.exception('reload failed', error, { url: page.url() });
      throw error;
    }
  }

  /**
   * Go back in history.
   */
  async goBack(
    page: Page,
    options: {
      timeoutMs?: number;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    } = {},
  ): Promise<NavigationResult | null> {
    const started = Date.now();
    log.info('go back started', { url: page.url() });

    try {
      const timeout = options.timeoutMs ?? 20_000;
      const waitUntil = options.waitUntil ?? 'load';

      await page.goBack({
        timeout: Math.max(1000, Math.min(120_000, timeout)),
        waitUntil,
      });

      const result: NavigationResult = {
        url: page.url(),
        title: await page.title().catch(() => undefined),
      };

      log.info('go back succeeded', {
        url: result.url,
        duration_ms: Date.now() - started,
      });

      return result;
    } catch (error) {
      log.exception('go back failed', error, { url: page.url() });
      throw error;
    }
  }

  /**
   * Go forward in history.
   */
  async goForward(
    page: Page,
    options: {
      timeoutMs?: number;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    } = {},
  ): Promise<NavigationResult | null> {
    const started = Date.now();
    log.info('go forward started', { url: page.url() });

    try {
      const timeout = options.timeoutMs ?? 20_000;
      const waitUntil = options.waitUntil ?? 'load';

      await page.goForward({
        timeout: Math.max(1000, Math.min(120_000, timeout)),
        waitUntil,
      });

      const result: NavigationResult = {
        url: page.url(),
        title: await page.title().catch(() => undefined),
      };

      log.info('go forward succeeded', {
        url: result.url,
        duration_ms: Date.now() - started,
      });

      return result;
    } catch (error) {
      log.exception('go forward failed', error, { url: page.url() });
      throw error;
    }
  }
}
