/**
 * Playwright Downloads Adapter
 * 
 * Handles file downloads and uploads via Playwright.
 * Extracted from: src/browser/pw-tools-core.downloads.ts
 */

import type { Page } from 'playwright-core';
import { setTimeout as delay } from 'node:timers/promises';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('pw-downloads');

/**
 * Download result
 */
export type DownloadResult = {
  url: string;
  suggestedFilename: string;
  path: string;
};

/**
 * Build temporary download path
 */
function buildTempDownloadPath(fileName: string): string {
  const id = crypto.randomUUID();
  const safeName = fileName.trim() ? fileName.trim() : 'download.bin';
  return path.join('/tmp/openclaw/downloads', `${id}-${safeName}`);
}

/**
 * Create a download waiter for a page
 */
function createPageDownloadWaiter(page: Page, timeoutMs: number) {
  let done = false;
  let timer: NodeJS.Timeout | undefined;
  let handler: ((download: unknown) => void) | undefined;

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = undefined;
    if (handler) {
      page.off('download', handler as never);
      handler = undefined;
    }
  };

  const promise = new Promise<unknown>((resolve, reject) => {
    handler = (download: unknown) => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve(download);
    };

    page.on('download', handler as never);
    timer = setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(new Error('Timeout waiting for download'));
    }, timeoutMs);
  });

  return {
    promise,
    cancel: () => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
    },
  };
}

type BrowserDownload = {
  url?: () => string;
  suggestedFilename?: () => string;
  saveAs?: (outPath: string) => Promise<void>;
};

function shouldFallbackToHttpDownload(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('playwright-artifacts') && message.includes('ENOENT');
}

async function downloadViaHttp(page: Page, url: string, outPath: string): Promise<void> {
  const cookies = await page.context().cookies([url]).catch(() => []);
  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const referer = /^https?:\/\//i.test(page.url()) ? page.url() : undefined;
  const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => '');

  const controller = new AbortController();
  const timeoutMs = Math.max(2_000, Math.min(120_000, Number(process.env.BROWSER_UPLOAD_DOWNLOAD_TIMEOUT_MS || 45_000)));
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(referer ? { referer } : {}),
        ...(userAgent ? { 'user-agent': userAgent } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Download fallback failed with status ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, bytes);
  } finally {
    clearTimeout(timer);
  }
}

async function persistDownload(page: Page, download: BrowserDownload, outPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  try {
    await download.saveAs?.(outPath);
    return;
  } catch (error) {
    if (!shouldFallbackToHttpDownload(error)) {
      throw error;
    }

    const url = download.url?.() || '';
    if (!/^https?:\/\//i.test(url)) {
      throw error;
    }

    log.warn('download saveAs failed, falling back to direct http fetch', { url, path: outPath });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await downloadViaHttp(page, url, outPath);
        return;
      } catch (fallbackError) {
        if (attempt === 2) {
          throw fallbackError;
        }
        await delay(100 * (attempt + 1));
      }
    }
  }
}

/**
 * Arm file upload handler
 * 
 * @param page - Playwright page instance
 * @param paths - Optional file paths to set
 * @param timeoutMs - Timeout in milliseconds
 */
export async function armFileUpload(
  page: Page,
  opts: {
    paths?: string[];
    timeoutMs?: number;
    isActive?: () => boolean;
  },
): Promise<void> {
  const started = Date.now();
  log.info('arm file upload started', {
    paths_count: opts.paths?.length ?? 0,
    timeout_ms: opts.timeoutMs,
  });

  const timeout = Math.max(500, Math.min(120_000, opts.timeoutMs ?? 120_000));
  void page
    .waitForEvent('filechooser', { timeout })
    .then(async (fileChooser) => {
      if (opts.isActive && !opts.isActive()) {
        return;
      }
      if (!opts.paths?.length) {
        // Playwright removed `FileChooser.cancel()`; best-effort close the chooser instead.
        try {
          await page.keyboard.press('Escape');
        } catch {
          // Best-effort.
        }
        return;
      }
      await fileChooser.setFiles(opts.paths);
      try {
        const input =
          typeof fileChooser.element === 'function'
            ? await Promise.resolve(fileChooser.element())
            : null;
        if (input) {
          await input.evaluate((el) => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
        }
      } catch {
        // Best-effort for sites that don't react to setFiles alone.
      }
    })
    .catch(() => {
      // Ignore timeouts; the chooser may never appear.
    });

  log.info('arm file upload registered', {
    duration_ms: Date.now() - started,
  });
}

/**
 * Arm dialog handler
 * 
 * @param page - Playwright page instance
 * @param accept - Whether to accept or dismiss the dialog
 * @param promptText - Optional prompt text (for prompt dialogs)
 * @param timeoutMs - Timeout in milliseconds
 */
export async function armDialog(
  page: Page,
  opts: {
    accept: boolean;
    promptText?: string;
    timeoutMs?: number;
    isActive?: () => boolean;
  },
): Promise<void> {
  const started = Date.now();
  log.info('arm dialog started', {
    accept: opts.accept,
    timeout_ms: opts.timeoutMs,
  });

  const timeout = Math.max(500, Math.min(120_000, opts.timeoutMs ?? 120_000));
  void page
    .waitForEvent('dialog', { timeout })
    .then(async (dialog) => {
      if (opts.isActive && !opts.isActive()) {
        return;
      }
      if (opts.accept) {
        await dialog.accept(opts.promptText);
      } else {
        await dialog.dismiss();
      }
    })
    .catch(() => {
      // Ignore timeouts; the dialog may never appear.
    });

  log.info('arm dialog registered', {
    duration_ms: Date.now() - started,
  });
}

/**
 * Wait for download to complete
 * 
 * @param page - Playwright page instance
 * @param path - Optional output path
 * @param timeoutMs - Timeout in milliseconds
 * @returns Download result with URL, filename, and path
 */
export async function waitForDownload(
  page: Page,
  opts: {
    path?: string;
    timeoutMs?: number;
    isActive?: () => boolean;
  },
): Promise<DownloadResult> {
  const started = Date.now();
  log.info('wait for download started', {
    timeout_ms: opts.timeoutMs,
    path: opts.path,
  });

  const timeout = Math.max(500, Math.min(120_000, opts.timeoutMs ?? 120_000));

  const waiter = createPageDownloadWaiter(page, timeout);
  try {
    const download = (await waiter.promise) as {
      url?: () => string;
      suggestedFilename?: () => string;
      saveAs?: (outPath: string) => Promise<void>;
    };
    if (opts.isActive && !opts.isActive()) {
      throw new Error('Download was superseded by another waiter');
    }

    const suggested = download.suggestedFilename?.() || 'download.bin';
    const outPath = opts.path?.trim() || buildTempDownloadPath(suggested);
    await persistDownload(page, download, outPath);

    const result: DownloadResult = {
      url: download.url?.() || '',
      suggestedFilename: suggested,
      path: path.resolve(outPath),
    };

    log.info('wait for download succeeded', {
      path: result.path,
      suggested_filename: result.suggestedFilename,
      duration_ms: Date.now() - started,
    });

    return result;
  } catch (err) {
    waiter.cancel();
    log.exception('wait for download failed', err);
    throw err;
  }
}

/**
 * Click element and wait for download
 * 
 * @param page - Playwright page instance
 * @param ref - Element reference
 * @param outPath - Output path for downloaded file
 * @param refLocator - Function to get locator from ref
 * @param timeoutMs - Timeout in milliseconds
 * @returns Download result
 */
export async function download(
  page: Page,
  opts: {
    ref: string;
    path: string;
    refLocator: (page: Page, ref: string) => any;
    timeoutMs?: number;
    isActive?: () => boolean;
  },
): Promise<DownloadResult> {
  const started = Date.now();
  log.info('download action started', {
    ref: opts.ref,
    path: opts.path,
  });

  const ref = opts.ref.trim();
  if (!ref) {
    throw new Error('ref is required');
  }

  const outPath = opts.path.trim();
  if (!outPath) {
    throw new Error('path is required');
  }

  const timeout = Math.max(500, Math.min(120_000, opts.timeoutMs ?? 120_000));

  const waiter = createPageDownloadWaiter(page, timeout);
  try {
    const locator = opts.refLocator(page, ref);
    try {
      await locator.click({ timeout });
    } catch (err) {
      throw new Error(`Element not found: ${ref}. ${err instanceof Error ? err.message : String(err)}`);
    }

    const download = (await waiter.promise) as {
      url?: () => string;
      suggestedFilename?: () => string;
      saveAs?: (outPath: string) => Promise<void>;
    };
    if (opts.isActive && !opts.isActive()) {
      throw new Error('Download was superseded by another waiter');
    }

    const suggested = download.suggestedFilename?.() || 'download.bin';
    await persistDownload(page, download, outPath);

    const result: DownloadResult = {
      url: download.url?.() || '',
      suggestedFilename: suggested,
      path: path.resolve(outPath),
    };

    log.info('download action succeeded', {
      ref,
      path: result.path,
      suggested_filename: result.suggestedFilename,
      duration_ms: Date.now() - started,
    });

    return result;
  } catch (err) {
    waiter.cancel();
    log.exception('download action failed', err, { ref: opts.ref });
    throw err;
  }
}
