/**
 * Session Service (Enhanced)
 * 
 * Manages browser sessions including creation, retrieval, and cleanup.
 * Includes complete state management with WeakMap tracking for console messages,
 * errors, network requests, and role references.
 * 
 * Extracted from: src/browser/pw-session.ts
 */

import type { Page, Locator, Browser, BrowserContext, Request, Response, ConsoleMessage } from 'playwright-core';
import type { IBrowserDriver } from '../ports/browser-driver.port.js';
import type { ISessionStore, RoleRefMap } from '../ports/session-store.port.js';
import { BrowserSession } from '../entities/browser-session.entity.js';
import type { TabInfo } from '../entities/tab.entity.js';
import type {
  BrowserConsoleMessage,
  BrowserPageError,
  BrowserNetworkRequest,
  PageState,
} from '../entities/browser-session.entity.js';

/**
 * Session creation result
 */
export type CreateSessionResult = {
  targetId: string;
  url: string;
};

/**
 * Role refs cache entry for cross-request stability
 */
type RoleRefsCacheEntry = {
  refs: RoleRefMap;
  frameSelector?: string;
  mode?: 'role' | 'aria';
};

/**
 * Page state with internal tracking
 */
type InternalPageState = {
  console: BrowserConsoleMessage[];
  errors: BrowserPageError[];
  requests: BrowserNetworkRequest[];
  requestIds: WeakMap<Request, string>;
  nextRequestId: number;
  armIdUpload: number;
  armIdDialog: number;
  armIdDownload: number;
  roleRefs?: RoleRefMap;
  roleRefsMode?: 'role' | 'aria';
  roleRefsFrameSelector?: string;
};

/**
 * Context state for trace management
 */
type ContextState = {
  traceActive: boolean;
};

/**
 * Session Service
 * 
 * Orchestrates session lifecycle operations using the browser driver port.
 * Includes complete state management with WeakMap tracking.
 */
export class SessionService {
  private sessions = new Map<string, BrowserSession>();
  private browser: Browser | null = null;

  // WeakMap state tracking (from legacy pw-session.ts)
  private pageStates = new WeakMap<Page, InternalPageState>();
  private contextStates = new WeakMap<BrowserContext, ContextState>();
  private observedContexts = new WeakSet<BrowserContext>();
  private observedPages = new WeakSet<Page>();

  // Role refs cache for cross-request stability
  private roleRefsByTarget = new Map<string, RoleRefsCacheEntry>();
  private readonly MAX_ROLE_REFS_CACHE = 50;

  // State limits
  private readonly MAX_CONSOLE_MESSAGES = 500;
  private readonly MAX_PAGE_ERRORS = 200;
  private readonly MAX_NETWORK_REQUESTS = 500;

  constructor(
    private browserDriver: IBrowserDriver,
    private sessionStore: ISessionStore,
  ) {}

  /**
   * Get or create session for target ID
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

    // Initialize page state tracking
    this.initializePageState(page);

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Create new session
   */
  async createSession(cdpUrl: string, url: string = 'about:blank'): Promise<CreateSessionResult> {
    const browser = await this.getBrowser(cdpUrl);
    const page = await this.browserDriver.createPage(browser, url);

    const targetId = this.generateTargetId();
    const session = new BrowserSession(targetId, cdpUrl, page);

    // Initialize page state tracking
    this.initializePageState(page);

    this.sessions.set(targetId, session);

    return { targetId, url: page.url() };
  }

  /**
   * Close session
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
   */
  async listSessions(cdpUrl: string): Promise<TabInfo[]> {
    const browser = await this.getBrowser(cdpUrl);
    return await this.browserDriver.listPages(browser);
  }

  /**
   * Store role references
   */
  async storeRoleRefs(
    targetId: string,
    refs: RoleRefMap,
    mode: 'role' | 'aria',
    cdpUrl?: string,
    frameSelector?: string,
  ): Promise<void> {
    const session = await this.getSession(targetId, cdpUrl);
    session.setRoleRefs(refs);
    session.setRoleRefsMode(mode);
    session.setRoleRefsFrameSelector(frameSelector);

    // Cache for cross-request stability
    if (targetId.trim()) {
      this.rememberRoleRefsForTarget({
        cdpUrl: cdpUrl ?? session.cdpUrl,
        targetId,
        refs,
        frameSelector,
        mode,
      });
    }

    await this.sessionStore.storeRoleRefs(session, refs, mode, frameSelector);
  }

  /**
   * Restore role references
   */
  async restoreRoleRefs(targetId: string, cdpUrl?: string): Promise<RoleRefMap | null> {
    const session = await this.getSession(targetId, cdpUrl);

    // Try cache first for stability
    if (targetId.trim() && cdpUrl) {
      const cached = this.restoreRoleRefsForTarget({
        cdpUrl,
        targetId,
        page: session.page,
      });
      if (cached) {
        return cached;
      }
    }

    const stored = await this.sessionStore.restoreRoleRefs(session);
    if (stored) {
      session.setRoleRefs(stored.refs);
      session.setRoleRefsMode(stored.mode);
      session.setRoleRefsFrameSelector(stored.frameSelector);
      const state = this.pageStates.get(session.page);
      if (state) {
        state.roleRefs = stored.refs;
        state.roleRefsMode = stored.mode;
        state.roleRefsFrameSelector = stored.frameSelector;
      }
      return stored.refs;
    }
    return null;
  }

  /**
   * Create locator from reference
   */
  refLocator(targetId: string, ref: string): Locator {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    return this.resolveRefLocator(session.page, ref, state);
  }

  /**
   * Get page for target ID
   */
  async getPage(targetId: string | undefined, cdpUrl: string): Promise<Page> {
    const session = await this.getSession(targetId, cdpUrl);
    return session.page;
  }

  /**
   * Focus page by target ID
   */
  async focusPage(targetId: string, cdpUrl: string): Promise<void> {
    const session = await this.getSession(targetId, cdpUrl);
    await this.browserDriver.focusPage(session.page);
  }

  /**
   * Get console messages for session
   */
  getConsoleMessages(targetId: string): BrowserConsoleMessage[] {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    return state?.console ?? [];
  }

  /**
   * Get page errors for session
   */
  getPageErrors(targetId: string): BrowserPageError[] {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    return state?.errors ?? [];
  }

  /**
   * Get network requests for session
   */
  getNetworkRequests(targetId: string): BrowserNetworkRequest[] {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    return state?.requests ?? [];
  }

  /**
   * Get page state
   */
  getPageState(targetId: string): PageState | null {
    const session = this.sessions.get(targetId);
    if (!session) {
      return null;
    }
    const state = this.pageStates.get(session.page);
    if (!state) {
      return null;
    }
    return {
      console: state.console,
      errors: state.errors,
      requests: state.requests,
      roleRefs: state.roleRefs,
      roleRefsMode: state.roleRefsMode,
      roleRefsFrameSelector: state.roleRefsFrameSelector,
    };
  }

  /**
   * Get upload arm ID
   */
  getUploadArmId(targetId: string): number {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    return state?.armIdUpload ?? 0;
  }

  /**
   * Get dialog arm ID
   */
  getDialogArmId(targetId: string): number {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    return state?.armIdDialog ?? 0;
  }

  /**
   * Get download arm ID
   */
  getDownloadArmId(targetId: string): number {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    return state?.armIdDownload ?? 0;
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

  /**
   * Initialize page state tracking
   */
  private initializePageState(page: Page): InternalPageState {
    const existing = this.pageStates.get(page);
    if (existing) {
      return existing;
    }

    const state: InternalPageState = {
      console: [],
      errors: [],
      requests: [],
      requestIds: new WeakMap(),
      nextRequestId: 0,
      armIdUpload: 0,
      armIdDialog: 0,
      armIdDownload: 0,
    };
    this.pageStates.set(page, state);

    // Set up observers if not already done
    if (!this.observedPages.has(page)) {
      this.observedPages.add(page);
      this.setupPageObservers(page, state);
    }

    return state;
  }

  /**
   * Set up page observers for console, errors, and network
   */
  private setupPageObservers(page: Page, state: InternalPageState): void {
    page.on('console', (msg: ConsoleMessage) => {
      const entry: BrowserConsoleMessage = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location(),
      };
      state.console.push(entry);
      if (state.console.length > this.MAX_CONSOLE_MESSAGES) {
        state.console.shift();
      }
    });

    page.on('pageerror', (err: Error) => {
      state.errors.push({
        message: err?.message ? String(err.message) : String(err),
        name: err?.name ? String(err.name) : undefined,
        stack: err?.stack ? String(err.stack) : undefined,
        timestamp: new Date().toISOString(),
      });
      if (state.errors.length > this.MAX_PAGE_ERRORS) {
        state.errors.shift();
      }
    });

    page.on('request', (req: Request) => {
      state.nextRequestId += 1;
      const id = `r${state.nextRequestId}`;
      state.requestIds.set(req, id);
      state.requests.push({
        id,
        timestamp: new Date().toISOString(),
        method: req.method(),
        url: req.url(),
        resourceType: req.resourceType(),
      });
      if (state.requests.length > this.MAX_NETWORK_REQUESTS) {
        state.requests.shift();
      }
    });

    page.on('response', (resp: Response) => {
      const req = resp.request();
      const id = state.requestIds.get(req);
      if (!id) {
        return;
      }
      let rec: BrowserNetworkRequest | undefined;
      for (let i = state.requests.length - 1; i >= 0; i -= 1) {
        const candidate = state.requests[i];
        if (candidate && candidate.id === id) {
          rec = candidate;
          break;
        }
      }
      if (!rec) {
        return;
      }
      rec.status = resp.status();
      rec.ok = resp.ok();
    });

    page.on('requestfailed', (req: Request) => {
      const id = state.requestIds.get(req);
      if (!id) {
        return;
      }
      let rec: BrowserNetworkRequest | undefined;
      for (let i = state.requests.length - 1; i >= 0; i -= 1) {
        const candidate = state.requests[i];
        if (candidate && candidate.id === id) {
          rec = candidate;
          break;
        }
      }
      if (!rec) {
        return;
      }
      rec.failureText = req.failure()?.errorText;
      rec.ok = false;
    });
  }

  /**
   * Remember role refs for target (cross-request stability)
   */
  private rememberRoleRefsForTarget(opts: {
    cdpUrl: string;
    targetId: string;
    refs: RoleRefMap;
    frameSelector?: string;
    mode?: 'role' | 'aria';
  }): void {
    const targetId = opts.targetId.trim();
    if (!targetId) {
      return;
    }
    const key = this.roleRefsKey(opts.cdpUrl, targetId);
    this.roleRefsByTarget.set(key, {
      refs: opts.refs,
      ...(opts.frameSelector ? { frameSelector: opts.frameSelector } : {}),
      ...(opts.mode ? { mode: opts.mode } : {}),
    });

    // Prune cache if too large
    while (this.roleRefsByTarget.size > this.MAX_ROLE_REFS_CACHE) {
      const first = this.roleRefsByTarget.keys().next();
      if (first.done) {
        break;
      }
      this.roleRefsByTarget.delete(first.value);
    }
  }

  /**
   * Restore role refs for target from cache
   */
  private restoreRoleRefsForTarget(opts: {
    cdpUrl: string;
    targetId?: string;
    page: Page;
  }): RoleRefMap | null {
    const targetId = opts.targetId?.trim() || '';
    if (!targetId) {
      return null;
    }
    const cached = this.roleRefsByTarget.get(this.roleRefsKey(opts.cdpUrl, targetId));
    if (!cached) {
      return null;
    }
    const state = this.pageStates.get(opts.page);
    if (!state) {
      return null;
    }
    if (state.roleRefs) {
      return state.roleRefs;
    }
    state.roleRefs = cached.refs;
    state.roleRefsFrameSelector = cached.frameSelector;
    state.roleRefsMode = cached.mode;
    return cached.refs;
  }

  /**
   * Generate role refs cache key
   */
  private roleRefsKey(cdpUrl: string, targetId: string): string {
    return `${this.normalizeCdpUrl(cdpUrl)}::${targetId}`;
  }

  /**
   * Normalize CDP URL
   */
  private normalizeCdpUrl(raw: string): string {
    return raw.replace(/\/$/, '');
  }

  private resolveRefLocator(page: Page, ref: string, state?: InternalPageState): Locator {
    const normalized = ref.startsWith('@')
      ? ref.slice(1)
      : ref.startsWith('ref=')
        ? ref.slice(4)
        : ref;

    if (/^e\d+$/.test(normalized)) {
      if (state?.roleRefsMode === 'aria') {
        const scope = state.roleRefsFrameSelector
          ? page.frameLocator(state.roleRefsFrameSelector)
          : page;
        return scope.locator(`aria-ref=${normalized}`);
      }

      const info = state?.roleRefs?.[normalized];
      if (!info) {
        throw new Error(`Unknown ref "${normalized}". Run a new snapshot and use a ref from that snapshot.`);
      }

      const scope = state?.roleRefsFrameSelector
        ? page.frameLocator(state.roleRefsFrameSelector)
        : page;
      const scoped = scope as unknown as {
        getByRole: (
          role: never,
          opts?: { name?: string; exact?: boolean },
        ) => ReturnType<Page['getByRole']>;
      };
      const locator = info.name
        ? scoped.getByRole(info.role as never, { name: info.name, exact: true })
        : scoped.getByRole(info.role as never);
      return info.nth !== undefined ? locator.nth(info.nth) : locator;
    }

    if (normalized.startsWith('d')) {
      return page.locator(`[aria-ref="${normalized}"]`);
    }

    return page.locator(`aria-ref=${normalized}`);
  }

  /**
   * Bump upload arm ID
   */
  bumpUploadArmId(targetId: string): number {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    if (!state) {
      throw new Error(`Page state not initialized: ${targetId}`);
    }
    state.armIdUpload += 1;
    return state.armIdUpload;
  }

  /**
   * Bump dialog arm ID
   */
  bumpDialogArmId(targetId: string): number {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    if (!state) {
      throw new Error(`Page state not initialized: ${targetId}`);
    }
    state.armIdDialog += 1;
    return state.armIdDialog;
  }

  /**
   * Bump download arm ID
   */
  bumpDownloadArmId(targetId: string): number {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    const state = this.pageStates.get(session.page);
    if (!state) {
      throw new Error(`Page state not initialized: ${targetId}`);
    }
    state.armIdDownload += 1;
    return state.armIdDownload;
  }
}
