/**
 * Playwright Activity Adapter
 * 
 * Handles activity tracking and detection for browser interactions.
 * Extracted from: src/browser/pw-tools-core.activity.ts
 */

import type { Page } from 'playwright-core';
import { createSubsystemLogger } from '../logging/pino-logger.adapter.js';

const log = createSubsystemLogger('pw-activity');

/**
 * Activity detection options
 */
export type ActivityOptions = {
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Minimum idle time before considering activity complete */
  idleMs?: number;
  /** Polling interval in milliseconds */
  pollIntervalMs?: number;
};

/**
 * Activity result
 */
export type ActivityResult = {
  /** Whether activity was detected */
  hasActivity: boolean;
  /** Duration of activity in milliseconds */
  durationMs: number;
  /** Number of activity events detected */
  eventCount: number;
};

/**
 * Wait for page to be idle (no network activity, animations, etc.)
 */
export async function waitForIdle(
  page: Page,
  options: ActivityOptions = {},
): Promise<void> {
  const { timeoutMs = 10000, idleMs = 500, pollIntervalMs = 100 } = options;

  log.debug('waitForIdle started', { timeoutMs, idleMs, pollIntervalMs });

  const startTime = Date.now();
  let lastActivityTime = Date.now();

  // Monitor network activity
  const onNetworkActivity = () => {
    lastActivityTime = Date.now();
  };

  page.on('request', onNetworkActivity);
  page.on('response', onNetworkActivity);
  page.on('requestfailed', onNetworkActivity);

  try {
    while (Date.now() - startTime < timeoutMs) {
      // Check if page is loading
      const isLoading = await page.evaluate(() => document.readyState !== 'complete');

      // Check if enough idle time has passed
      const idleTime = Date.now() - lastActivityTime;

      if (!isLoading && idleTime >= idleMs) {
        log.debug('waitForIdle completed', {
          duration_ms: Date.now() - startTime,
          idle_time_ms: idleTime,
        });
        return;
      }

      await sleep(pollIntervalMs);
    }

    log.warn('waitForIdle timed out', {
      duration_ms: Date.now() - startTime,
      timeout_ms: timeoutMs,
    });
  } finally {
    page.off('request', onNetworkActivity);
    page.off('response', onNetworkActivity);
    page.off('requestfailed', onNetworkActivity);
  }
}

/**
 * Detect if page has activity (network, animations, etc.)
 */
export async function detectActivity(
  page: Page,
  options: ActivityOptions = {},
): Promise<ActivityResult> {
  const { timeoutMs = 5000, pollIntervalMs = 100 } = options;

  log.debug('detectActivity started', { timeoutMs });

  const startTime = Date.now();
  let eventCount = 0;
  let hasActivity = false;

  const onNetworkActivity = () => {
    eventCount++;
    hasActivity = true;
  };

  page.on('request', onNetworkActivity);
  page.on('response', onNetworkActivity);
  page.on('requestfailed', onNetworkActivity);

  try {
    while (Date.now() - startTime < timeoutMs) {
      // Check page ready state
      const isLoading = await page.evaluate(() => document.readyState !== 'complete');
      if (isLoading) {
        hasActivity = true;
        eventCount++;
      }

      await sleep(pollIntervalMs);
    }

    const result: ActivityResult = {
      hasActivity,
      durationMs: Date.now() - startTime,
      eventCount,
    };

    log.debug('detectActivity completed', result);
    return result;
  } finally {
    page.off('request', onNetworkActivity);
    page.off('response', onNetworkActivity);
    page.off('requestfailed', onNetworkActivity);
  }
}

/**
 * Wait for text to appear on page
 */
export async function waitForText(
  page: Page,
  text: string,
  options: { timeoutMs?: number; visible?: boolean } = {},
): Promise<void> {
  const { timeoutMs = 5000, visible = false } = options;

  log.debug('waitForText started', { text, timeoutMs, visible });

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const found = await page.evaluate(
      ({ text, visible }) => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          const content = el.textContent || '';
          if (content.includes(text)) {
            if (!visible || isElementVisible(el as HTMLElement)) {
              return true;
            }
          }
        }
        return false;
      },
      { text, visible },
    );

    if (found) {
      log.debug('waitForText completed', {
        text,
        duration_ms: Date.now() - startTime,
      });
      return;
    }

    await sleep(100);
  }

  log.warn('waitForText timed out', {
    text,
    duration_ms: Date.now() - startTime,
    timeout_ms: timeoutMs,
  });
}

/**
 * Wait for text to disappear from page
 */
export async function waitForTextGone(
  page: Page,
  text: string,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 5000 } = options;

  log.debug('waitForTextGone started', { text, timeoutMs });

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const gone = await page.evaluate((text) => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const content = el.textContent || '';
        if (content.includes(text)) {
          return false;
        }
      }
      return true;
    }, text);

    if (gone) {
      log.debug('waitForTextGone completed', {
        text,
        duration_ms: Date.now() - startTime,
      });
      return;
    }

    await sleep(100);
  }

  log.warn('waitForTextGone timed out', {
    text,
    duration_ms: Date.now() - startTime,
    timeout_ms: timeoutMs,
  });
}

/**
 * Check if element is visible
 */
function isElementVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
