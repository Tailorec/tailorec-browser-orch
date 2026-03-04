# 📋 Task Document: Worktree A — Core Domain Layer

**Branch:** `refactor/worktree-a-core`  
**Priority:** 🔴 P0 (Must complete first)  
**Estimated Time:** 2-3 days  
**Owner:** Senior Developer 1

---

## 🎯 Objective

Create the **Core Domain Layer** containing entities, services, ports (interfaces), and use cases. This layer defines the business logic and contracts that all other layers will depend on.

### Why This Must Be First

All other worktrees depend on the interfaces and types defined here:
- **Worktree B (Adapters)** implements the ports defined here
- **Worktree C (API)** calls the use cases created here
- **Worktree D (Shared)** provides utilities used here
- **Worktree E (Integration)** wires everything together

---

## 📁 Deliverables

### Directory Structure to Create

```
src/core/
├── entities/
│   ├── browser-session.entity.ts      # ~80 lines
│   ├── tab.entity.ts                  # ~60 lines
│   ├── profile.entity.ts              # ~70 lines
│   └── index.ts                       # ~20 lines
│
├── services/
│   ├── snapshot.service.ts            # ~350 lines
│   ├── interaction.service.ts         # ~450 lines
│   ├── discovery.service.ts           # ~400 lines
│   ├── navigation.service.ts          # ~200 lines
│   └── session.service.ts             # ~300 lines
│
├── ports/
│   ├── browser-driver.port.ts         # ~100 lines
│   ├── session-store.port.ts          # ~80 lines
│   ├── event-bus.port.ts              # ~50 lines
│   └── index.ts                       # ~20 lines
│
└── use-cases/
    ├── execute-action.use-case.ts     # ~200 lines
    ├── start-session.use-case.ts      # ~150 lines
    └── take-snapshot.use-case.ts      # ~120 lines
```

---

## 🔨 Implementation Details

### Step 1: Create Entities (Day 1, Morning)

#### `src/core/entities/browser-session.entity.ts`

**Source:** Extract from `src/browser/pw-session.ts` (types only)

```typescript
// Expected content (~80 lines)
import type { Page } from 'playwright-core';

export type BrowserConsoleMessage = {
  type: string;
  text: string;
  timestamp: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
};

export type BrowserPageError = {
  message: string;
  name?: string;
  stack?: string;
  timestamp: string;
};

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

export type PageState = {
  console: BrowserConsoleMessage[];
  errors: BrowserPageError[];
  requests: BrowserNetworkRequest[];
  roleRefs?: Record<string, { role: string; name?: string; nth?: number }>;
  roleRefsMode?: 'role' | 'aria';
  roleRefsFrameSelector?: string;
};

export class BrowserSession {
  constructor(
    public readonly id: string,
    public readonly cdpUrl: string,
    public page: Page,
  ) {}

  private state: PageState = {
    console: [],
    errors: [],
    requests: [],
  };

  getState(): PageState {
    return this.state;
  }

  setState(state: PageState): void {
    this.state = state;
  }
}
```

#### `src/core/entities/tab.entity.ts`

```typescript
// Expected content (~60 lines)
export type TabInfo = {
  targetId: string;
  type?: string;
  title?: string;
  url?: string;
  attached?: boolean;
};

export class Tab {
  constructor(
    public readonly targetId: string,
    public type: string = 'page',
    public title: string = '',
    public url: string = 'about:blank',
    public attached: boolean = false,
  ) {}

  static fromTargetInfo(info: TabInfo): Tab {
    return new Tab(
      info.targetId,
      info.type ?? 'page',
      info.title ?? '',
      info.url ?? 'about:blank',
      info.attached ?? false,
    );
  }

  toTargetInfo(): TabInfo {
    return {
      targetId: this.targetId,
      type: this.type,
      title: this.title,
      url: this.url,
      attached: this.attached,
    };
  }
}
```

#### `src/core/entities/profile.entity.ts`

```typescript
// Expected content (~70 lines)
export type ProfileConfig = {
  name: string;
  cdpPort: number;
  cdpUrl: string;
  driver: 'chrome' | 'extension';
  color?: string;
};

export type ResolvedProfile = {
  name: string;
  cdpPort: number;
  cdpUrl: string;
  cdpIsLoopback: boolean;
  driver: 'chrome' | 'extension';
  color: string;
};

export class Profile {
  constructor(
    public readonly config: ProfileConfig,
  ) {}

  get name(): string {
    return this.config.name;
  }

  get cdpUrl(): string {
    return this.config.cdpUrl;
  }

  get cdpPort(): number {
    return this.config.cdpPort;
  }

  resolve(): ResolvedProfile {
    return {
      name: this.config.name,
      cdpPort: this.config.cdpPort,
      cdpUrl: this.config.cdpUrl,
      cdpIsLoopback: this.config.cdpUrl.includes('127.0.0.1') || 
                     this.config.cdpUrl.includes('localhost'),
      driver: this.config.driver,
      color: this.config.color ?? 'blue',
    };
  }
}
```

---

### Step 2: Create Ports (Interfaces) (Day 1, Afternoon)

#### `src/core/ports/browser-driver.port.ts`

**Purpose:** Define interface for browser automation (implemented by Playwright adapter)

```typescript
// Expected content (~100 lines)
import type { Page, Locator, Browser } from 'playwright-core';
import type { TabInfo } from '../entities/tab.entity.js';
import type { SnapshotOptions, SnapshotResult } from '../services/snapshot.service.js';
import type { InteractionOptions, InteractionResult } from '../services/interaction.service.js';

/**
 * Port: Browser Driver
 * 
 * Defines the contract for browser automation implementations.
 * Implemented by: PlaywrightBrowserDriverAdapter
 */
export interface IBrowserDriver {
  /**
   * Connect to browser via CDP
   */
  connect(cdpUrl: string): Promise<Browser>;
  
  /**
   * Disconnect from browser
   */
  disconnect(browser: Browser): Promise<void>;
  
  /**
   * Create new page/tab
   */
  createPage(browser: Browser, url?: string): Promise<Page>;
  
  /**
   * Close page
   */
  closePage(page: Page): Promise<void>;
  
  /**
   * Focus/activate page
   */
  focusPage(page: Page): Promise<void>;
  
  /**
   * List all pages
   */
  listPages(browser: Browser): Promise<TabInfo[]>;
  
  /**
   * Get page by target ID
   */
  getPage(browser: Browser, targetId?: string): Promise<Page>;
  
  /**
   * Create locator from reference
   */
  refLocator(page: Page, ref: string): Locator;
}

/**
 * Port: Snapshot Capability
 */
export interface ISnapshotCapability {
  /**
   * Capture page snapshot
   */
  captureSnapshot(page: Page, options: SnapshotOptions): Promise<SnapshotResult>;
  
  /**
   * Capture accessibility tree snapshot
   */
  captureAriaSnapshot(page: Page, limit?: number): Promise<{ nodes: unknown[] }>;
}

/**
 * Port: Interaction Capability
 */
export interface IInteractionCapability {
  /**
   * Perform interaction on page
   */
  interact(page: Page, options: InteractionOptions): Promise<InteractionResult>;
}
```

#### `src/core/ports/session-store.port.ts`

```typescript
// Expected content (~80 lines)
import type { BrowserSession } from '../entities/browser-session.entity.js';
import type { RoleRefMap } from '../services/snapshot.service.js';

/**
 * Port: Session Store
 * 
 * Defines the contract for session state persistence.
 * Implemented by: InMemorySessionStoreAdapter
 */
export interface ISessionStore {
  /**
   * Get session by target ID
   */
  getSession(targetId?: string): Promise<BrowserSession | null>;
  
  /**
   * Store session
   */
  storeSession(session: BrowserSession): Promise<void>;
  
  /**
   * Remove session
   */
  removeSession(targetId: string): Promise<void>;
  
  /**
   * Store role references for session
   */
  storeRoleRefs(session: BrowserSession, refs: RoleRefMap, mode: 'role' | 'aria'): Promise<void>;
  
  /**
   * Restore role references for session
   */
  restoreRoleRefs(session: BrowserSession): Promise<RoleRefMap | null>;
}

export type RoleRefMap = Record<string, { role: string; name?: string; nth?: number }>;
```

#### `src/core/ports/event-bus.port.ts`

```typescript
// Expected content (~50 lines)
/**
 * Port: Event Bus
 * 
 * Defines the contract for domain event publishing.
 * Implemented by: InMemoryEventBusAdapter
 */
export interface IEventBus {
  /**
   * Publish event to all subscribers
   */
  publish<T>(event: T): void;
  
  /**
   * Subscribe to event type
   */
  subscribe<T>(eventType: string, handler: (event: T) => void): void;
  
  /**
   * Unsubscribe from event type
   */
  unsubscribe<T>(eventType: string, handler: (event: T) => void): void;
}

/**
 * Base interface for all domain events
 */
export interface IDomainEvent {
  type: string;
  timestamp: string;
  aggregateId: string;
}
```

---

### Step 3: Create Services (Day 2)

#### `src/core/services/session.service.ts`

**Source:** Extract logic from `src/browser/pw-session.ts`

```typescript
// Expected content (~300 lines)
import type { Page, Locator } from 'playwright-core';
import type { IBrowserDriver } from '../ports/browser-driver.port.js';
import type { ISessionStore, RoleRefMap } from '../ports/session-store.port.js';
import { BrowserSession } from '../entities/browser-session.entity.js';
import { Tab } from '../entities/tab.entity.js';
import type { TabInfo } from '../entities/tab.entity.js';

export class SessionService {
  private sessions = new Map<string, BrowserSession>();

  constructor(
    private browserDriver: IBrowserDriver,
    private sessionStore: ISessionStore,
  ) {}

  /**
   * Get or create session for target ID
   */
  async getSession(targetId?: string): Promise<BrowserSession> {
    // Check in-memory cache first
    if (targetId && this.sessions.has(targetId)) {
      return this.sessions.get(targetId)!;
    }

    // Try to get existing page
    const browser = await this.getBrowser();
    const page = await this.browserDriver.getPage(browser, targetId);
    
    const session = new BrowserSession(
      targetId ?? this.generateTargetId(),
      browser._connection._url,
      page,
    );

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Create new session
   */
  async createSession(url: string = 'about:blank'): Promise<{ targetId: string; url: string }> {
    const browser = await this.getBrowser();
    const page = await this.browserDriver.createPage(browser, url);
    
    const targetId = this.generateTargetId();
    const session = new BrowserSession(targetId, browser._connection._url, page);
    
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
  async listSessions(): Promise<TabInfo[]> {
    const browser = await this.getBrowser();
    return await this.browserDriver.listPages(browser);
  }

  /**
   * Store role references
   */
  async storeRoleRefs(targetId: string, refs: RoleRefMap, mode: 'role' | 'aria'): Promise<void> {
    const session = await this.getSession(targetId);
    await this.sessionStore.storeRoleRefs(session, refs, mode);
  }

  /**
   * Restore role references
   */
  async restoreRoleRefs(targetId: string): Promise<RoleRefMap | null> {
    const session = await this.getSession(targetId);
    return await this.sessionStore.restoreRoleRefs(session);
  }

  /**
   * Create locator from reference
   */
  refLocator(targetId: string, ref: string): Locator {
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Session not found: ${targetId}`);
    }
    return this.browserDriver.refLocator(session.page, ref);
  }

  private async getBrowser(): Promise<any> {
    // Implementation depends on browser connection management
    // This is a simplified version
    throw new Error('Not implemented - use adapter');
  }

  private generateTargetId(): string {
    return `target_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
```

#### `src/core/services/snapshot.service.ts`

**Source:** Extract from `src/browser/pw-tools-core.snapshot.ts`

```typescript
// Expected content (~350 lines)
import type { Page } from 'playwright-core';
import type { RoleRefMap } from '../ports/session-store.port.js';

export type SnapshotOptions = {
  timeoutMs?: number;
  maxChars?: number;
  interactiveOnly?: boolean;
  compact?: boolean;
  maxDepth?: number;
};

export type SnapshotResult = {
  snapshot: string;
  refs: RoleRefMap;
  truncated?: boolean;
  stats?: {
    lines: number;
    chars: number;
    refs: number;
    interactive: number;
  };
};

export type AriaSnapshotOptions = {
  limit?: number;
};

export type AriaSnapshotResult = {
  nodes: unknown[];
};

export class SnapshotService {
  /**
   * Capture AI-friendly snapshot
   */
  async captureSnapshot(page: Page, options: SnapshotOptions): Promise<SnapshotResult> {
    // Implementation extracted from pw-tools-core.snapshot.ts
    // Uses page._snapshotForAI if available
    const timeout = options.timeoutMs ?? 5000;
    const maxChars = options.maxChars;
    
    // Call Playwright's internal snapshot method
    const result = await (page as any)._snapshotForAI({
      timeout: Math.max(500, Math.min(60_000, timeout)),
      track: 'response',
    });
    
    let snapshot = String(result?.full ?? '');
    let truncated = false;
    
    if (maxChars && snapshot.length > maxChars) {
      snapshot = `${snapshot.slice(0, maxChars)}\n\n[...TRUNCATED - page too large]`;
      truncated = true;
    }
    
    // Build role refs from snapshot
    const refs = this.buildRoleRefsFromSnapshot(snapshot);
    
    return {
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
  }

  /**
   * Capture accessibility tree snapshot
   */
  async captureAriaSnapshot(page: Page, limit: number = 500): Promise<AriaSnapshotResult> {
    // Implementation extracted from pw-tools-core.snapshot.ts
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

  private buildRoleRefsFromSnapshot(snapshot: string): RoleRefMap {
    // Extract refs from snapshot string
    // Pattern: [ref=e12] -> { e12: { role: 'button', name: 'Login' } }
    const refs: RoleRefMap = {};
    const refPattern = /\[ref=(e\d+)\]/g;
    const lines = snapshot.split('\n');
    
    let match;
    for (const line of lines) {
      const refMatch = line.match(refPattern);
      if (refMatch) {
        const ref = refMatch[0].match(/e\d+/)?.[0];
        if (ref) {
          // Extract role and name from line
          const roleMatch = line.match(/^- (\w+)/);
          const nameMatch = line.match(/"([^"]+)"/);
          
          refs[ref] = {
            role: roleMatch?.[1] ?? 'unknown',
            name: nameMatch?.[1],
          };
        }
      }
    }
    
    return refs;
  }

  private countInteractiveElements(refs: RoleRefMap): number {
    const interactiveRoles = ['button', 'link', 'textbox', 'combobox', 'listbox', 'checkbox', 'radio'];
    return Object.values(refs).filter(r => interactiveRoles.includes(r.role)).length;
  }

  private formatAriaSnapshot(nodes: any[], limit: number): any[] {
    // Implementation from cdp.ts formatAriaSnapshot
    return nodes.slice(0, limit);
  }
}
```

#### `src/core/services/interaction.service.ts`

**Source:** Extract from `src/browser/pw-tools-core.interactions.ts`

```typescript
// Expected content (~450 lines)
import type { Page } from 'playwright-core';
import type { BrowserAction } from './types.js';

export type InteractionOptions = {
  targetId?: string;
  timeoutMs?: number;
};

export type InteractionResult = {
  ok: true;
  targetId?: string;
  url?: string;
};

export type ClickAction = {
  kind: 'click';
  ref: string;
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
};

export type TypeAction = {
  kind: 'type';
  ref: string;
  text: string;
  clear?: boolean;
};

export type FillAction = {
  kind: 'fill';
  fields: Array<{
    ref: string;
    value: string;
    type?: 'text' | 'email' | 'phone' | 'date' | 'password';
  }>;
};

export class InteractionService {
  /**
   * Execute browser action
   */
  async executeAction(page: Page, action: BrowserAction): Promise<InteractionResult> {
    switch (action.kind) {
      case 'click':
        return this.handleClick(page, action);
      case 'type':
        return this.handleType(page, action);
      case 'fill':
        return this.handleFill(page, action);
      case 'hover':
        return this.handleHover(page, action);
      case 'press':
        return this.handlePress(page, action);
      case 'navigate':
        return this.handleNavigate(page, action);
      case 'wait':
        return this.handleWait(page, action);
      case 'evaluate':
        return this.handleEvaluate(page, action);
      default:
        throw new Error(`Unknown action kind: ${(action as any).kind}`);
    }
  }

  private async handleClick(page: Page, action: ClickAction): Promise<InteractionResult> {
    // Implementation extracted from pw-tools-core.interactions.ts
    const locator = this.refLocator(page, action.ref);
    const timeout = action.timeoutMs ?? 8000;
    
    if (action.doubleClick) {
      await locator.dblclick({ timeout, button: action.button });
    } else {
      await locator.click({ timeout, button: action.button, modifiers: action.modifiers });
    }
    
    return { ok: true, targetId: undefined, url: page.url() };
  }

  private async handleType(page: Page, action: TypeAction): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref);
    const timeout = action.timeoutMs ?? 8000;
    
    if (action.clear) {
      await locator.clear({ timeout });
    }
    
    await locator.fill(action.text, { timeout });
    
    return { ok: true, targetId: undefined, url: page.url() };
  }

  private async handleFill(page: Page, action: FillAction): Promise<InteractionResult> {
    // Complex fill logic with verification
    for (const field of action.fields) {
      const locator = this.refLocator(page, field.ref);
      await locator.fill(field.value);
      
      // Verify fill succeeded
      const actualValue = await locator.inputValue();
      if (actualValue !== field.value) {
        throw new Error(`Failed to fill field [ref=${field.ref}]: expected "${field.value}", got "${actualValue}"`);
      }
    }
    
    return { ok: true, targetId: undefined, url: page.url() };
  }

  private async handleHover(page: Page, action: any): Promise<InteractionResult> {
    const locator = this.refLocator(page, action.ref);
    await locator.hover({ timeout: action.timeoutMs ?? 8000 });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  private async handlePress(page: Page, action: any): Promise<InteractionResult> {
    await page.keyboard.press(action.key);
    return { ok: true, targetId: undefined, url: page.url() };
  }

  private async handleNavigate(page: Page, action: any): Promise<InteractionResult> {
    await page.goto(action.url, { waitUntil: 'networkidle' });
    return { ok: true, targetId: undefined, url: page.url() };
  }

  private async handleWait(page: Page, action: any): Promise<InteractionResult> {
    if (action.loadState) {
      await page.waitForLoadState(action.loadState);
    }
    return { ok: true, targetId: undefined, url: page.url() };
  }

  private async handleEvaluate(page: Page, action: any): Promise<InteractionResult> {
    const result = await page.evaluate(action.fn);
    return { ok: true, targetId: undefined, url: page.url(), result };
  }

  private refLocator(page: Page, ref: string): any {
    // Implementation from pw-session.ts
    // Uses aria-ref or role-based lookup
    return page.locator(`[aria-ref="${ref}"]`);
  }
}
```

#### `src/core/services/discovery.service.ts`

**Source:** Extract from `src/browser/pw-tools-core.dom-observer.ts`

```typescript
// Expected content (~400 lines)
import type { Page } from 'playwright-core';

export type IncrementalElement = {
  tagName: string;
  role: string | null;
  text: string;
  className: string;
  ariaInvalid: string | null;
  isError: boolean;
  ref?: string;
  rect?: { x: number; y: number; width: number; height: number };
  ariaLabel?: string;
  ariaSelected?: string;
  dataValue?: string;
  isInteractable?: boolean;
};

export type DomDelta = {
  addedElements: IncrementalElement[];
  removedElements: Array<{ ref?: string; text: string; tagName: string }>;
  modifiedElements: Array<{
    ref: string | null;
    tagName: string;
    attr: string;
    oldValue: string | null;
    newValue: string | null;
    text: string;
  }>;
  urlChanged: boolean;
  previousUrl: string;
  currentUrl: string;
  observationDurationMs: number;
};

export type DropdownOption = {
  ref: string;
  text: string;
  value?: string;
  selected?: boolean;
};

export type BlockerInfo = {
  type: 'modal' | 'overlay' | 'popup' | 'cookie-banner';
  selector: string;
  closeSelector?: string;
  suggestedStrategy: 'click-close' | 'press-escape' | 'click-outside';
};

export class DiscoveryService {
  /**
   * Start DOM delta observation
   */
  async startDomObserver(page: Page, anchorRef?: string): Promise<{ observing: true }> {
    // Inject observer JS from pw-tools-core.dom-observer.ts
    await page.evaluate((anchorRef) => {
      // OBSERVER_JS from source
      (window as any).__skyvernDeltaObserver?.start(anchorRef);
    }, anchorRef);
    
    return { observing: true };
  }

  /**
   * Stop DOM observation and get delta
   */
  async stopDomObserver(page: Page): Promise<DomDelta> {
    const delta = await page.evaluate(() => {
      return (window as any).__skyvernDeltaObserver?.stop();
    });
    
    return delta as DomDelta;
  }

  /**
   * Discover dropdown options
   */
  async discoverDropdownOptions(page: Page, ref: string): Promise<DropdownOption[]> {
    // Implementation from pw-tools-core.interactions.ts discoverDropdownOptionsViaPlaywright
    const options = await page.evaluate((ref) => {
      // Find dropdown and extract options
      const element = document.querySelector(`[aria-ref="${ref}"]`);
      if (!element) return [];
      
      // Find option elements
      const optionElements = element.querySelectorAll('[role="option"]');
      return Array.from(optionElements).map((opt, idx) => ({
        ref: `d${idx}`,
        text: opt.textContent?.trim() ?? '',
        value: (opt as any).value,
        selected: opt.getAttribute('aria-selected') === 'true',
      }));
    }, ref);
    
    return options;
  }

  /**
   * Close dropdown
   */
  async closeDropdown(page: Page, ref: string): Promise<void> {
    await page.evaluate((ref) => {
      const element = document.querySelector(`[aria-ref="${ref}"]`);
      if (element) {
        // Dispatch close event
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, ref);
  }

  /**
   * Detect blocking elements
   */
  async detectBlockingElement(page: Page): Promise<BlockerInfo | null> {
    // Implementation from pw-tools-core.interactions.ts detectBlockingElementViaPlaywright
    const blocker = await page.evaluate(() => {
      // Find topmost element at center of viewport
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const topElement = document.elementFromPoint(centerX, centerY);
      
      if (!topElement || topElement === document.body) {
        return null;
      }
      
      // Check if it's a blocker
      const computedStyle = window.getComputedStyle(topElement);
      const isBlocking = 
        computedStyle.position === 'fixed' ||
        computedStyle.position === 'absolute' ||
        computedStyle.zIndex !== 'auto' && parseInt(computedStyle.zIndex) > 100;
      
      if (!isBlocking) return null;
      
      return {
        type: this.classifyBlocker(topElement),
        selector: this.getElementSelector(topElement),
        closeSelector: this.findCloseButton(topElement),
      };
    });
    
    return blocker as BlockerInfo | null;
  }

  /**
   * Dismiss blocker
   */
  async dismissBlocker(page: Page, strategy?: string): Promise<boolean> {
    // Implementation from pw-tools-core.interactions.ts dismissBlockerViaPlaywright
    if (strategy === 'click-close') {
      // Click close button
      return true;
    } else if (strategy === 'press-escape') {
      await page.keyboard.press('Escape');
      return true;
    } else if (strategy === 'click-outside') {
      // Click outside blocker
      return true;
    }
    
    return false;
  }

  /**
   * Query element state
   */
  async queryElementState(page: Page, ref: string, state: string): Promise<boolean> {
    return await page.evaluate((params) => {
      const element = document.querySelector(`[aria-ref="${params.ref}"]`);
      if (!element) return false;
      
      switch (params.state) {
        case 'visible': return element.checkVisibility();
        case 'enabled': return !(element as any).disabled;
        case 'editable': return !(element as any).readOnly;
        case 'obscured': return false; // Complex check
        default: return false;
      }
    }, { ref, state });
  }

  private classifyBlocker(element: Element): 'modal' | 'overlay' | 'popup' | 'cookie-banner' {
    // Classification logic
    return 'modal';
  }

  private getElementSelector(element: Element): string {
    // Generate selector
    return element.id ? `#${element.id}` : element.className ? `.${element.className}` : element.tagName.toLowerCase();
  }

  private findCloseButton(element: Element): string | null {
    // Find close button
    const closeBtn = element.querySelector('[class*="close"], [aria-label*="close"]');
    return closeBtn ? this.getElementSelector(closeBtn) : null;
  }
}
```

#### `src/core/services/navigation.service.ts`

```typescript
// Expected content (~200 lines)
import type { Page } from 'playwright-core';

export type NavigationOptions = {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeoutMs?: number;
};

export type DownloadOptions = {
  acceptDownloads?: boolean;
  downloadsPath?: string;
};

export class NavigationService {
  /**
   * Navigate to URL
   */
  async navigate(page: Page, url: string, options: NavigationOptions = {}): Promise<void> {
    await page.goto(url, {
      waitUntil: options.waitUntil ?? 'networkidle',
      timeout: options.timeoutMs ?? 30000,
    });
  }

  /**
   * Wait for condition
   */
  async wait(page: Page, options: {
    loadState?: string;
    selector?: string;
    timeoutMs?: number;
  }): Promise<void> {
    if (options.loadState) {
      await page.waitForLoadState(options.loadState as any, {
        timeout: options.timeoutMs ?? 30000,
      });
    }
    
    if (options.selector) {
      await page.waitForSelector(options.selector, {
        timeout: options.timeoutMs ?? 30000,
      });
    }
  }

  /**
   * Handle download
   */
  async waitForDownload(page: Page, downloadPath: string): Promise<string> {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      // Trigger download action
    ]);
    
    await download.saveAs(downloadPath);
    return download.suggestedFilename();
  }

  /**
   * Resize viewport
   */
  async resizeViewport(page: Page, width: number, height: number): Promise<void> {
    await page.setViewportSize({ width, height });
  }

  /**
   * Take screenshot
   */
  async screenshot(page: Page, options?: {
    fullPage?: boolean;
    path?: string;
  }): Promise<Buffer> {
    return await page.screenshot({
      fullPage: options?.fullPage,
      path: options?.path,
    });
  }

  /**
   * Generate PDF
   */
  async pdf(page: Page, options?: {
    path?: string;
    printBackground?: boolean;
  }): Promise<Buffer> {
    return await page.pdf({
      path: options?.path,
      printBackground: options?.printBackground,
    });
  }
}
```

---

### Step 4: Create Use Cases (Day 3, Morning)

#### `src/core/use-cases/execute-action.use-case.ts`

```typescript
// Expected content (~200 lines)
import type { SessionService } from '../services/session.service.js';
import type { InteractionService } from '../services/interaction.service.js';
import type { BrowserAction, InteractionResult } from '../services/interaction.service.js';

export type ExecuteActionInput = {
  action: BrowserAction;
  targetId?: string;
};

export type ExecuteActionResult = InteractionResult;

export class ExecuteActionUseCase {
  constructor(
    private sessionService: SessionService,
    private interactionService: InteractionService,
  ) {}

  async execute(input: ExecuteActionInput): Promise<ExecuteActionResult> {
    // Get session
    const session = await this.sessionService.getSession(input.targetId);
    
    // Execute action
    const result = await this.interactionService.executeAction(
      session.page,
      input.action,
    );
    
    return result;
  }
}
```

#### `src/core/use-cases/take-snapshot.use-case.ts`

```typescript
// Expected content (~120 lines)
import type { SessionService } from '../services/session.service.js';
import type { SnapshotService, SnapshotOptions, SnapshotResult } from '../services/snapshot.service.js';

export type TakeSnapshotInput = {
  targetId?: string;
  options?: SnapshotOptions;
};

export type TakeSnapshotResult = SnapshotResult;

export class TakeSnapshotUseCase {
  constructor(
    private sessionService: SessionService,
    private snapshotService: SnapshotService,
  ) {}

  async execute(input: TakeSnapshotInput): Promise<TakeSnapshotResult> {
    const session = await this.sessionService.getSession(input.targetId);
    const result = await this.snapshotService.captureSnapshot(session.page, input.options ?? {});
    return result;
  }
}
```

#### `src/core/use-cases/start-session.use-case.ts`

```typescript
// Expected content (~150 lines)
import type { SessionService } from '../services/session.service.js';

export type StartSessionInput = {
  url?: string;
  profileName?: string;
};

export type StartSessionResult = {
  targetId: string;
  url: string;
  cdpUrl: string;
};

export class StartSessionUseCase {
  constructor(private sessionService: SessionService) {}

  async execute(input: StartSessionInput): Promise<StartSessionResult> {
    const { targetId, url } = await this.sessionService.createSession(input.url ?? 'about:blank');
    
    return {
      targetId,
      url,
      cdpUrl: '', // Would come from browser connection
    };
  }
}
```

---

## ✅ Tests That Must Pass

### Unit Tests

```bash
# Session tests
npm run test:unit -- src/__tests__/unit/pw-session.unit.test.ts
npm run test:unit -- src/__tests__/unit/pw-session-advanced.unit.test.ts

# Snapshot tests
npm run test:unit -- src/__tests__/unit/pw-tools-snapshot.unit.test.ts

# Interaction tests
npm run test:unit -- src/__tests__/unit/pw-tools-interactions.unit.test.ts

# DOM Observer tests
npm run test:unit -- src/__tests__/unit/pw-tools-dom-observer.unit.test.ts

# Config tests (verify nothing broken)
npm run test:unit -- src/__tests__/unit/config.unit.test.ts
```

### Integration Tests

```bash
# Snapshot integration
npm run test:integration -- src/__tests__/integration/agent-snapshot.integration.test.ts

# Interaction integration
npm run test:integration -- src/__tests__/integration/pw-tools-interactions.integration.test.ts
npm run test:integration -- src/__tests__/integration/agent-act-validation.integration.test.ts

# DOM Observer integration
npm run test:integration -- src/__tests__/integration/pw-tools-dom-observer.integration.test.ts
```

### Contract Tests

```bash
# Act contract
npm run test:contract -- src/__tests__/contract/act.contract.test.ts

# Status contract
npm run test:contract -- src/__tests__/contract/status.contract.test.ts
```

---

## 🤖 AI Agent Prompt

Use this prompt to get AI assistance with Worktree A:

```
You are helping refactor the Tailorec Browser Service to Clean Architecture.

CONTEXT:
- We are implementing Worktree A: Core Domain Layer
- Branch: refactor/worktree-a-core
- Goal: Create entities, services, ports, and use cases
- Max file size: 700 lines
- Source files are in src/browser/

TASK:
Help me create the following files in src/core/:

1. src/core/entities/browser-session.entity.ts
2. src/core/entities/tab.entity.ts
3. src/core/entities/profile.entity.ts
4. src/core/ports/browser-driver.port.ts
5. src/core/ports/session-store.port.ts
6. src/core/ports/event-bus.port.ts
7. src/core/services/session.service.ts
8. src/core/services/snapshot.service.ts
9. src/core/services/interaction.service.ts
10. src/core/services/discovery.service.ts
11. src/core/services/navigation.service.ts
12. src/core/use-cases/execute-action.use-case.ts
13. src/core/use-cases/take-snapshot.use-case.ts
14. src/core/use-cases/start-session.use-case.ts

CONSTRAINTS:
- Extract logic from existing files (don't rewrite from scratch)
- Maintain backward compatibility
- Keep files under 700 lines
- Use TypeScript strict mode
- Follow existing naming conventions
- Preserve all functionality

SOURCE FILES:
- src/browser/pw-session.ts (711 lines)
- src/browser/pw-tools-core.interactions.ts (1298 lines)
- src/browser/pw-tools-core.snapshot.ts (279 lines)
- src/browser/pw-tools-core.dom-observer.ts (393 lines)

Please help me create [SPECIFIC_FILE] by extracting logic from [SOURCE_FILE].
```

---

## 📝 Definition of Done

- [ ] All 14 files created
- [ ] All entities are pure data objects (no business logic)
- [ ] All services contain business logic
- [ ] All ports are TypeScript interfaces
- [ ] All use cases orchestrate service calls
- [ ] No file exceeds 700 lines
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All contract tests pass
- [ ] TypeScript compilation succeeds (`npm run check`)
- [ ] No circular dependencies (`npm run deps:circular`)
- [ ] Code reviewed by team member

---

## 🚀 Getting Started

```bash
# 1. Create worktree
cd /home/faishal/tailorec/tailorec-source/agents/openclaw-browser
git worktree add -b refactor/worktree-a-core ../refactor/worktree-a-core

# 2. Navigate to worktree
cd ../refactor/worktree-a-core

# 3. Install dependencies
npm install

# 4. Create directory structure
mkdir -p src/core/{entities,services,ports,use-cases}

# 5. Start with entities
# Follow the implementation details above

# 6. Run tests frequently
npm run test:unit -- src/__tests__/unit/config.unit.test.ts

# 7. Commit often
git add .
git commit -m "refactor(core): create browser-session entity"
```

---

## 📞 Support

- **Blockers:** Tag tech lead in Slack
- **Questions:** Refer to `REFACTORING_PLAN.md`
- **Daily Sync:** 10 AM local time

---

**Created:** 2026-03-04  
**Version:** 1.0  
**Status:** Ready for Implementation
