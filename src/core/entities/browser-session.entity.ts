/**
 * Browser Session Entity
 * 
 * Represents an active browser session with a page and its state.
 * Extracted from: src/browser/pw-session.ts
 */

import type { Page } from 'playwright-core';

/**
 * Console message from the browser page
 */
export type BrowserConsoleMessage = {
  type: string;
  text: string;
  timestamp: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
};

/**
 * Error from the browser page
 */
export type BrowserPageError = {
  message: string;
  name?: string;
  stack?: string;
  timestamp: string;
};

/**
 * Network request from the browser page
 */
export type BrowserNetworkRequest = {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  resourceType?: string;
  status?: number;
  ok?: boolean;
  failureText?: string;
};

/**
 * Role reference map for element identification
 */
export type RoleRefMap = Record<string, { role: string; name?: string; nth?: number }>;

/**
 * Page state containing console messages, errors, and network requests
 */
export type PageState = {
  console: BrowserConsoleMessage[];
  errors: BrowserPageError[];
  requests: BrowserNetworkRequest[];
  roleRefs?: RoleRefMap;
  roleRefsMode?: 'role' | 'aria';
  roleRefsFrameSelector?: string;
};

/**
 * Browser Session Entity
 * 
 * Encapsulates a browser page and its state for a specific session.
 */
export class BrowserSession {
  private state: PageState;

  constructor(
    public readonly id: string,
    public readonly cdpUrl: string,
    public readonly page: Page,
  ) {
    this.state = {
      console: [],
      errors: [],
      requests: [],
    };
  }

  /**
   * Get the current page state
   */
  getState(): PageState {
    return this.state;
  }

  /**
   * Set the page state
   */
  setState(state: PageState): void {
    this.state = state;
  }

  /**
   * Get role references from state
   */
  getRoleRefs(): RoleRefMap | undefined {
    return this.state.roleRefs;
  }

  /**
   * Set role references in state
   */
  setRoleRefs(refs: RoleRefMap | undefined): void {
    this.state.roleRefs = refs;
  }

  /**
   * Get role refs mode
   */
  getRoleRefsMode(): 'role' | 'aria' | undefined {
    return this.state.roleRefsMode;
  }

  /**
   * Set role refs mode
   */
  setRoleRefsMode(mode: 'role' | 'aria' | undefined): void {
    this.state.roleRefsMode = mode;
  }

  /**
   * Get role refs frame selector
   */
  getRoleRefsFrameSelector(): string | undefined {
    return this.state.roleRefsFrameSelector;
  }

  /**
   * Set role refs frame selector
   */
  setRoleRefsFrameSelector(selector: string | undefined): void {
    this.state.roleRefsFrameSelector = selector;
  }
}
