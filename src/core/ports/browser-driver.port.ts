/**
 * Browser Driver Port
 * 
 * Defines the contract for browser automation implementations.
 * Implemented by: PlaywrightBrowserDriverAdapter
 * 
 * Extracted from: src/browser/pw-session.ts
 */

import type { Page, Locator, Browser } from 'playwright-core';
import type { TabInfo } from '../entities/tab.entity.js';
import type { SnapshotOptions, SnapshotResult } from '../services/snapshot.service.js';
import type { InteractionOptions, InteractionResult } from '../services/interaction.service.js';

/**
 * Port: Browser Driver
 * 
 * Defines the contract for browser automation implementations.
 * All adapter implementations must conform to this interface.
 */
export interface IBrowserDriver {
  /**
   * Connect to browser via CDP
   * @param cdpUrl - The CDP WebSocket URL
   * @returns Connected browser instance
   */
  connect(cdpUrl: string): Promise<Browser>;

  /**
   * Disconnect from browser
   * @param browser - The browser to disconnect
   */
  disconnect(browser: Browser): Promise<void>;

  /**
   * Create new page/tab
   * @param browser - The browser instance
   * @param url - Optional URL to navigate to
   * @returns Created page
   */
  createPage(browser: Browser, url?: string): Promise<Page>;

  /**
   * Close page
   * @param page - The page to close
   */
  closePage(page: Page): Promise<void>;

  /**
   * Focus/activate page
   * @param page - The page to focus
   */
  focusPage(page: Page): Promise<void>;

  /**
   * List all pages/tabs
   * @param browser - The browser instance
   * @returns Array of tab info
   */
  listPages(browser: Browser): Promise<TabInfo[]>;

  /**
   * Get page by target ID
   * @param browser - The browser instance
   * @param targetId - Optional target ID to find
   * @returns The matching page
   */
  getPage(browser: Browser, targetId?: string): Promise<Page>;

  /**
   * Create locator from reference
   * @param page - The page containing the element
   * @param ref - The element reference
   * @returns Locator for the element
   */
  refLocator(page: Page, ref: string): Locator;
}

/**
 * Port: Snapshot Capability
 * 
 * Defines the contract for capturing page snapshots.
 */
export interface ISnapshotCapability {
  /**
   * Capture page snapshot
   * @param page - The page to snapshot
   * @param options - Snapshot options
   * @returns Snapshot result
   */
  captureSnapshot(page: Page, options: SnapshotOptions): Promise<SnapshotResult>;

  /**
   * Capture accessibility tree snapshot
   * @param page - The page to snapshot
   * @param limit - Maximum number of nodes
   * @returns Accessibility snapshot result
   */
  captureAriaSnapshot(page: Page, limit?: number): Promise<{ nodes: unknown[] }>;
}

/**
 * Port: Interaction Capability
 * 
 * Defines the contract for performing interactions on pages.
 */
export interface IInteractionCapability {
  /**
   * Perform interaction on page
   * @param page - The page to interact with
   * @param options - Interaction options
   * @returns Interaction result
   */
  interact(page: Page, options: InteractionOptions): Promise<InteractionResult>;
}
