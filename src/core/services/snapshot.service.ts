/**
 * Snapshot Service
 * 
 * Captures page snapshots for AI processing.
 * Extracted from: src/browser/pw-tools-core.snapshot.ts
 */

import type { Page } from 'playwright-core';
import { buildRoleSnapshotFromAiSnapshot } from '../../adapters/playwright/playwright.role-snapshot.adapter.js';
import type { RoleRefMap } from '../ports/session-store.port.js';

/**
 * Snapshot options
 */
export type SnapshotOptions = {
  /**
   * Timeout in milliseconds
   */
  timeoutMs?: number;

  /**
   * Maximum characters in snapshot
   */
  maxChars?: number;

  /**
   * Only include interactive elements
   */
  interactiveOnly?: boolean;

  /**
   * Compact snapshot format
   */
  compact?: boolean;

  /**
   * Maximum depth to traverse
   */
  maxDepth?: number;
};

/**
 * Snapshot result
 */
export type SnapshotResult = {
  /**
   * Snapshot string
   */
  snapshot: string;

  /**
   * Role references map
   */
  refs: RoleRefMap;

  /**
   * Whether snapshot was truncated
   */
  truncated?: boolean;

  /**
   * Snapshot statistics
   */
  stats?: {
    lines: number;
    chars: number;
    refs: number;
    interactive: number;
  };
};

/**
 * Aria snapshot options
 */
export type AriaSnapshotOptions = {
  /**
   * Maximum number of nodes
   */
  limit?: number;
};

/**
 * Aria snapshot result
 */
export type AriaSnapshotResult = {
  /**
   * Array of accessibility nodes
   */
  nodes: unknown[];
};

/**
 * Snapshot Service
 * 
 * Captures page snapshots in various formats for AI processing.
 */
export class SnapshotService {
  /**
   * Capture AI-friendly snapshot using Playwright's _snapshotForAI
   * @param page - Page to snapshot
   * @param options - Snapshot options
   * @returns Snapshot result
   */
  async captureSnapshot(page: Page, options: SnapshotOptions): Promise<SnapshotResult> {
    const timeout = options.timeoutMs ?? 5000;
    const maxChars = options.maxChars;

    // Cast page to include internal _snapshotForAI method
    const pageWithSnapshot = page as unknown as {
      _snapshotForAI?: (opts: { timeout?: number; track?: string }) => Promise<{ full?: string }>;
    };

    if (!pageWithSnapshot._snapshotForAI) {
      throw new Error('Playwright _snapshotForAI is not available. Upgrade playwright-core.');
    }

    // Call Playwright's internal snapshot method
    const result = await pageWithSnapshot._snapshotForAI({
      timeout: Math.max(500, Math.min(60_000, timeout)),
      track: 'response',
    });

    let snapshot = String(result?.full ?? '');
    let truncated = false;

    // Truncate if needed
    if (maxChars && snapshot.length > maxChars) {
      snapshot = `${snapshot.slice(0, maxChars)}\n\n[...TRUNCATED - page too large]`;
      truncated = true;
    }

    // Build role refs from snapshot
    const built = buildRoleSnapshotFromAiSnapshot(snapshot, {
      interactive: options.interactiveOnly,
      compact: options.compact,
      maxDepth: options.maxDepth,
    });

    return truncated
      ? {
          snapshot,
          refs: built.refs,
          truncated,
        }
      : {
          snapshot,
          refs: built.refs,
        };
  }

  /**
   * Capture accessibility tree snapshot via CDP
   * @param page - Page to snapshot
   * @param limit - Maximum number of nodes
   * @returns Aria snapshot result
   */
  async captureAriaSnapshot(page: Page, limit: number = 500): Promise<AriaSnapshotResult> {
    const session = await page.context().newCDPSession(page);

    try {
      await session.send('Accessibility.enable');
      const res = await session.send('Accessibility.getFullAXTree');
      const nodes = Array.isArray(res?.nodes) ? res.nodes : [];

      return {
        nodes: this.formatAriaSnapshot(nodes, limit),
      };
    } finally {
      await session.detach().catch(() => {});
    }
  }

  /**
   * Format aria snapshot nodes
   * @param nodes - Raw AX nodes
   * @param limit - Maximum nodes to return
   * @returns Formatted nodes
   */
  private formatAriaSnapshot(nodes: any[], limit: number): any[] {
    // Limit nodes and format
    return nodes.slice(0, limit).map((node) => ({
      role: node.role?.value ?? node.role,
      name: node.name?.value ?? node.name,
      children: node.children?.map((child: any) => child.backendDOMNodeId),
    }));
  }
}
