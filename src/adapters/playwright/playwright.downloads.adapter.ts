/**
 * Playwright Downloads Adapter
 * 
 * Handles file downloads and uploads via Playwright.
 * Extracted from: src/browser/pw-tools-core.downloads.ts
 */

import type { Page } from 'playwright-core';
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
  },
): Promise<void> {
  const started = Date.now();
  log.info('arm file upload started', {
    paths_count: opts.paths?.length ?? 0,
    timeout_ms: opts.timeoutMs,
  });

  const timeout = Math.max(500, Math.min(120_000, opts.timeoutMs ?? 120_000));
  const armId = Date.now();

  void page
    .waitForEvent('filechooser', { timeout })
    .then(async (fileChooser) => {
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
  },
): Promise<void> {
  const started = Date.now();
  log.info('arm dialog started', {
    accept: opts.accept,
    timeout_ms: opts.timeoutMs,
  });

  const timeout = Math.max(500, Math.min(120_000, opts.timeoutMs ?? 120_000));
  const armId = Date.now();

  void page
    .waitForEvent('dialog', { timeout })
    .then(async (dialog) => {
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

    const suggested = download.suggestedFilename?.() || 'download.bin';
    const outPath = opts.path?.trim() || buildTempDownloadPath(suggested);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await download.saveAs?.(outPath);

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

    const suggested = download.suggestedFilename?.() || 'download.bin';
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await download.saveAs?.(outPath);

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
