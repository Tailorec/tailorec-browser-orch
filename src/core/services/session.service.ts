/**
 * Session Service
 * 
 * Manages browser sessions including creation, retrieval, and cleanup.
 * Extracted from: src/browser/pw-session.ts
 */

import type { Page, Locator, Browser } from 'playwright-core';
import type { IBrowserDriver } from '../ports/browser-driver.port.js';
import type { ISessionStore, RoleRefMap } from '../ports/session-store.port.js';
import { BrowserSession } from '../entities/browser-session.entity.js';
import { Tab } from '../entities/tab.entity.js';
import type { TabInfo } from '../entities/tab.entity.js';

/**
 * Session creation result
 */
export type CreateSessionResult = {
  targetId: string;
  url: string;
};

/**
 * Session Service
 * 
 * Orchestrates session lifecycle operations using the browser driver port.
 */
export class SessionService {
  private sessions = new Map<string, BrowserSession>();
  private browser: Browser | null = null;

  constructor(
    private browserDriver: IBrowserDriver,
    private sessionStore: ISessionStore,
  ) {}

  /**
   * Get or create session for target ID
   * @param targetId - Optional target ID to look up
   * @param cdpUrl - CDP URL for connection
   * @returns Browser session
   */
  async getSession(targetId?: string, cdpUrl?: string): Promise<BrowserSession> {
    // Check in-memory cache first
    if (targetId && this.sessions.has(targetId)) {
      return this.sessions.get(targetId)!;
    }

    // Get browser connection
    const browser = await this.getBrowser(cdpUrl);

    // Get existing page
    const page = await this.browserDriver.getPage(browser, targetId);

    // Create new session
    const session = new BrowserSession(
      targetId ?? this.generateTargetId(),
      cdpUrl ?? '',
      page,
    );

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Create new session
   * @param cdpUrl - CDP URL for connection
   * @param url - Optional URL to navigate to
   * @returns Session creation result
   */
  async createSession(cdpUrl: string, url: string = 'about:blank'): Promise<CreateSessionResult> {
    const browser = await this.getBrowser(cdpUrl);
    const page = await this.browserDriver.createPage(browser, url);

    const targetId = this.generateTargetId();
    const session = new BrowserSession(
      targetId,
      cdpUrl,
      page,
    );

    this.sessions.set(targetId, session);

    return { targetId, url: page.url() };
  }

  /**
   * Close session
   * @param targetId - Target ID of session to close
   */
  async closeSession(targetId: string): Promise<void> {
    const session = this.sessions.get(targetId);
    if (session) {
      await this.browserDriver.closePage(session.page);
      this.sessions.delete(targetId);
    }
  }

  /**
   * List all sessions
   * @param cdpUrl - CDP URL for connection
   * @returns Array of tab info
   */
  async listSessions(cdpUrl: string): Promise<TabInfo[]> {
    const browser = await this.getBrowser(cdpUrl);
    return await this.browserDriver.listPages(browser);
  }

  /**
   * Store role references
   * @param targetId - Target ID
   * @param refs - Role references to store
   * @param mode - Refs mode
   */
  async storeRoleRefs(
    targetId: string,
    refs: RoleRefMap,
    mode: 'role' | 'aria',
  ): Promise<void> {
    const session = await this.getSession(targetId);
    session.setRoleRefs(refs);
    session.setRoleRefsMode(mode);
    await this.sessionStore.storeRoleRefs(session, refs, mode);
  }

  /**
   * Restore role references
   * @param targetId - Target ID
   * @returns Restored role references or null
   */
  async restoreRoleRefs(targetId: string): Promise<RoleRefMap | null> {
    const session = await this.getSession(targetId);
    const refs = await this.sessionStore.restoreRoleRefs(session);
    if (refs) {
      session.setRoleRefs(refs);
    }
    return refs;
  }

  /**
   * Create locator from reference
   * @param targetId - Target ID
   * @param ref - Element reference
   * @returns Locator for the element
   */
  refLocator(targetId: string, ref: string): Locator {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    return this.browserDriver.refLocator(session.page, ref);
  }

  /**
   * Get page for target ID
   * @param targetId - Target ID
   * @param cdpUrl - CDP URL for connection
   * @returns Page instance
   */
  async getPage(targetId: string | undefined, cdpUrl: string): Promise<Page> {
    const session = await this.getSession(targetId, cdpUrl);
    return session.page;
  }

  /**
   * Focus page by target ID
   * @param targetId - Target ID
   * @param cdpUrl - CDP URL for connection
   */
  async focusPage(targetId: string, cdpUrl: string): Promise<void> {
    const session = await this.getSession(targetId, cdpUrl);
    await this.browserDriver.focusPage(session.page);
  }

  /**
   * Get browser instance
   */
  private async getBrowser(cdpUrl?: string): Promise<Browser> {
    if (!this.browser && cdpUrl) {
      this.browser = await this.browserDriver.connect(cdpUrl);
    }
    if (!this.browser) {
      throw new Error('Browser not connected. Provide cdpUrl to connect.');
    }
    return this.browser;
  }

  /**
   * Generate unique target ID
   */
  private generateTargetId(): string {
    return `target_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Clear all sessions
   */
  async clearAll(): Promise<void> {
    const sessionEntries = Array.from(this.sessions.entries());
    for (const [targetId, session] of sessionEntries) {
      try {
        await this.browserDriver.closePage(session.page);
      } catch {
        // Ignore close errors
      }
    }
    this.sessions.clear();
  }
}
