import type { Page } from 'playwright-core';
import { createSubsystemLogger } from '../logging/logger.adapter.js';
import { formatAriaSnapshot, type AriaSnapshotNode, type RawAXNode } from '../utils/cdp.types.js';
import {
  buildRoleSnapshotFromAiSnapshot,
  buildRoleSnapshotFromAriaSnapshot,
  getRoleSnapshotStats,
  type RoleSnapshotOptions,
  type RoleRefMap,
} from './playwright.role-snapshot.adapter.js';
const log = createSubsystemLogger('pw-snapshot-adapter');

/**
 * Options for capturing a snapshot.
 */
export type SnapshotOptions = {
  timeoutMs?: number;
  maxChars?: number;
};

/**
 * Result of capturing a snapshot.
 */
export type SnapshotResult = {
  snapshot: string;
  refs: RoleRefMap;
  truncated?: boolean;
  stats: {
    lines: number;
    chars: number;
    refs: number;
    interactive: number;
  };
};

/**
 * Result of capturing an aria snapshot.
 */
export type AriaSnapshotResult = {
  nodes: AriaSnapshotNode[];
};

/**
 * Type for pages that support Playwright's _snapshotForAI method.
 */
export type WithSnapshotForAI = {
  _snapshotForAI?: (options?: { timeout?: number; track?: string }) => Promise<{ full: string; incremental?: string }>;
};

/**
 * PlaywrightSnapshotAdapter provides snapshot functionality for web pages.
 * 
 * This adapter extracts logic from pw-tools-core.snapshot.ts to provide:
 * - AI-friendly snapshot capture
 * - Accessibility tree snapshot
 * - Role-based snapshot with refs
 */
export class PlaywrightSnapshotAdapter {
  /**
   * Capture an AI-friendly snapshot of the page.
   * 
   * Uses Playwright's internal _snapshotForAI method to generate
   * a text representation of the page with role-based refs.
   */
  async captureSnapshot(page: Page, options: SnapshotOptions = {}): Promise<SnapshotResult> {
    const started = Date.now();
    log.debug('captureSnapshot started', {
      url: page.url(),
      options: JSON.stringify(options),
    });

    try {
      const timeout = options.timeoutMs ?? 5000;
      const maxChars = options.maxChars;

      const maybe = page as unknown as WithSnapshotForAI;
      if (!maybe._snapshotForAI) {
        throw new Error('Playwright _snapshotForAI is not available. Upgrade playwright-core.');
      }

      const result = await maybe._snapshotForAI({
        timeout: Math.max(500, Math.min(60_000, timeout)),
        track: 'response',
      });

      let snapshot = String(result?.full ?? '');
      let truncated = false;

      if (maxChars && snapshot.length > maxChars) {
        snapshot = `${snapshot.slice(0, maxChars)}\n\n[...TRUNCATED - page too large]`;
        truncated = true;
      }

      // Build role refs from the snapshot
      const refs = this.buildRoleRefsFromSnapshot(snapshot);

      const response: SnapshotResult = {
        snapshot,
        refs,
        truncated,
        stats: {
          lines: snapshot.split('\n').length,
          chars: snapshot.length,
          refs: Object.keys(refs).length,
          interactive: this.countInteractiveElements(refs),
        },
      };

      log.info('captureSnapshot succeeded', {
        url: page.url(),
        chars: snapshot.length,
        refs: Object.keys(refs).length,
        duration_ms: Date.now() - started,
      });

      return response;
    } catch (error) {
      log.exception('captureSnapshot failed', error, { url: page.url() });
      throw error;
    }
  }

  /**
   * Capture accessibility tree snapshot using CDP.
   * 
   * Uses Chrome DevTools Protocol to get the full accessibility tree.
   */
  async captureAriaSnapshot(page: Page, limit: number = 500): Promise<AriaSnapshotResult> {
    const started = Date.now();
    log.debug('captureAriaSnapshot started', { url: page.url(), limit });

    const session = await page.context().newCDPSession(page);

    try {
      await session.send('Accessibility.enable');
      const res = await session.send('Accessibility.getFullAXTree');
      const nodes = (Array.isArray(res?.nodes) ? res.nodes : []) as unknown as RawAXNode[];

      const formatted = formatAriaSnapshot(nodes, limit);

      log.info('captureAriaSnapshot succeeded', {
        url: page.url(),
        nodes: formatted.length,
        duration_ms: Date.now() - started,
      });

      return { nodes: formatted };
    } finally {
      await session.detach().catch(() => {});
    }
  }

  /**
   * Capture a role-based snapshot with refs.
   * 
   * Supports two modes:
   * - 'aria': Uses Playwright's _snapshotForAI
   * - 'role': Uses Playwright's ariaSnapshot API
   */
  async captureRoleSnapshot(
    page: Page,
    options: {
      refsMode?: 'role' | 'aria';
      selector?: string;
      frameSelector?: string;
      snapshotOptions?: RoleSnapshotOptions;
    } = {},
  ): Promise<{
    snapshot: string;
    refs: RoleRefMap;
    stats: {
      lines: number;
      chars: number;
      refs: number;
      interactive: number;
    };
  }> {
    const started = Date.now();
    const refsMode = options.refsMode ?? 'role';
    log.debug('captureRoleSnapshot started', {
      url: page.url(),
      refs_mode: refsMode,
      selector: options.selector,
      frame_selector: options.frameSelector,
    });

    if (refsMode === 'aria') {
      if (options.selector?.trim() || options.frameSelector?.trim()) {
        throw new Error('refs=aria does not support selector/frame snapshots yet.');
      }

      const maybe = page as unknown as WithSnapshotForAI;
      if (!maybe._snapshotForAI) {
        throw new Error('refs=aria requires Playwright _snapshotForAI support.');
      }

      const result = await maybe._snapshotForAI({
        timeout: 5000,
        track: 'response',
      });

      const built = buildRoleSnapshotFromAiSnapshot(
        String(result?.full ?? ''),
        options.snapshotOptions,
      );

      const out = {
        snapshot: built.snapshot,
        refs: built.refs,
        stats: getRoleSnapshotStats(built.snapshot, built.refs),
      };

      log.info('captureRoleSnapshot succeeded', {
        url: page.url(),
        refs: Object.keys(out.refs).length,
        chars: out.snapshot.length,
        duration_ms: Date.now() - started,
      });

      return out;
    }

    // Role mode using ariaSnapshot API
    const frameSelector = options.frameSelector?.trim() || '';
    const selector = options.selector?.trim() || '';

    const locator = frameSelector
      ? selector
        ? page.frameLocator(frameSelector).locator(selector)
        : page.frameLocator(frameSelector).locator(':root')
      : selector
        ? page.locator(selector)
        : page.locator(':root');

    const ariaSnapshot = await locator.ariaSnapshot();
    const built = buildRoleSnapshotFromAriaSnapshot(
      String(ariaSnapshot ?? ''),
      options.snapshotOptions,
    );

    const out = {
      snapshot: built.snapshot,
      refs: built.refs,
      stats: getRoleSnapshotStats(built.snapshot, built.refs),
    };

    log.info('captureRoleSnapshot succeeded', {
      url: page.url(),
      refs: Object.keys(out.refs).length,
      chars: out.snapshot.length,
      duration_ms: Date.now() - started,
    });

    return out;
  }

  private buildRoleRefsFromSnapshot(
    snapshot: string,
  ): RoleRefMap {
    const refs: RoleRefMap = {};
    const refPattern = /\[ref=(e\d+)\]/g;
    const lines = snapshot.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const refMatch = line.match(refPattern);
      if (refMatch) {
        const ref = refMatch[0].match(/e\d+/)?.[0];
        if (ref) {
          const roleMatch = line.match(/^- (\w+)/);
          const nameMatch = line.match(/"([^"]+)"/);

          refs[ref] = {
            role: roleMatch?.[1] ?? 'unknown',
            name: nameMatch?.[1],
            nth: 0,
          };
        }
      }
    }

    return refs;
  }

  private countInteractiveElements(refs: RoleRefMap): number {
    const interactiveRoles = [
      'button',
      'link',
      'textbox',
      'combobox',
      'listbox',
      'checkbox',
      'radio',
    ];
    return Object.values(refs).filter((r) => interactiveRoles.includes(r.role)).length;
  }
}
