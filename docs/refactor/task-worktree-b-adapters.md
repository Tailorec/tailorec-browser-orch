# 📋 Task Document: Worktree B — Infrastructure Adapters

**Branch:** `refactor/worktree-b-adapters`  
**Priority:** 🔴 P0 (Can parallelize with A after day 1)  
**Estimated Time:** 3-4 days  
**Owner:** Senior Developer 2

---

## 🎯 Objective

Create the **Infrastructure Adapters** layer containing implementations for all ports defined in Worktree A. This includes Playwright adapters, Chrome launchers, extension relay, HTTP server, and logging.

### Dependencies

- **Blocks:** Worktree C (API), Worktree E (Integration)
- **Blocked by:** Worktree A (needs port interfaces)
- **Can start:** After Worktree A defines ports (Day 1-2)

---

## 📁 Deliverables

### Directory Structure to Create

```
src/adapters/
├── playwright/
│   ├── playwright.browser-driver.adapter.ts     # ~150 lines
│   ├── playwright.snapshot.adapter.ts           # ~300 lines
│   ├── playwright.interactions.adapter.ts       # ~450 lines
│   ├── playwright.discovery.adapter.ts          # ~350 lines
│   ├── playwright.navigation.adapter.ts         # ~150 lines
│   ├── cdp.client.ts                            # ~200 lines
│   ├── cdp.types.ts                             # ~150 lines
│   └── index.ts                                 # ~30 lines
│
├── chrome/
│   ├── chrome-launcher.adapter.ts               # ~250 lines
│   ├── chrome-executables.adapter.ts            # ~65 lines
│   ├── chrome-profile.adapter.ts                # ~100 lines
│   ├── extension-relay.types.ts                 # ~120 lines
│   ├── extension-relay.utils.ts                 # ~100 lines
│   ├── extension-relay.server.ts                # ~300 lines
│   ├── extension-relay.router.ts                # ~270 lines
│   └── index.ts                                 # ~20 lines
│
├── http/
│   ├── express.server.adapter.ts                # ~150 lines
│   └── express.middleware.adapter.ts            # ~200 lines
│
└── logging/
    └── pino-logger.adapter.ts                   # ~150 lines
```

---

## 🔨 Implementation Details

### Step 1: Playwright Adapters (Day 1-2)

#### `src/adapters/playwright/playwright.browser-driver.adapter.ts`

**Source:** Extract from `src/browser/pw-session.ts`, `src/browser/chrome.ts`

```typescript
// Expected content (~150 lines)
import type { Browser, Page, Locator } from 'playwright-core';
import { chromium } from 'playwright-core';
import type { IBrowserDriver } from '../../core/ports/browser-driver.port.js';
import type { TabInfo } from '../../core/entities/tab.entity.js';

export class PlaywrightBrowserDriverAdapter implements IBrowserDriver {
  private browsers = new Map<string, Browser>();

  async connect(cdpUrl: string): Promise<Browser> {
    const browser = await chromium.connectOverCDP(cdpUrl);
    this.browsers.set(cdpUrl, browser);
    return browser;
  }

  async disconnect(browser: Browser): Promise<void> {
    await browser.close();
    // Remove from map
    for (const [url, b] of this.browsers.entries()) {
      if (b === browser) {
        this.browsers.delete(url);
        break;
      }
    }
  }

  async createPage(browser: Browser, url: string = 'about:blank'): Promise<Page> {
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = await context.newPage();
    if (url !== 'about:blank') {
      await page.goto(url);
    }
    return page;
  }

  async closePage(page: Page): Promise<void> {
    await page.close();
  }

  async focusPage(page: Page): Promise<void> {
    await page.bringToFront();
  }

  async listPages(browser: Browser): Promise<TabInfo[]> {
    const contexts = browser.contexts();
    const pages = contexts.flatMap(ctx => ctx.pages());
    return pages.map(page => ({
      targetId: page.guid,
      type: 'page',
      title: page.title(),
      url: page.url(),
      attached: true,
    }));
  }

  async getPage(browser: Browser, targetId?: string): Promise<Page> {
    if (!targetId) {
      // Return first available page
      const pages = this.listPages(browser);
      if (pages.length === 0) {
        return this.createPage(browser);
      }
      const context = browser.contexts()[0];
      return context.pages()[0];
    }

    // Find page by targetId
    const contexts = browser.contexts();
    for (const context of contexts) {
      for (const page of context.pages()) {
        if (page.guid === targetId) {
          return page;
        }
      }
    }

    throw new Error(`Page not found: ${targetId}`);
  }

  refLocator(page: Page, ref: string): Locator {
    // Implementation from pw-session.ts refLocator
    return page.locator(`[aria-ref="${ref}"]`);
  }
}
```

#### `src/adapters/playwright/playwright.snapshot.adapter.ts`

**Source:** Extract from `src/browser/pw-tools-core.snapshot.ts`

```typescript
// Expected content (~300 lines)
import type { Page } from 'playwright-core';
import type {
  SnapshotService,
  SnapshotOptions,
  SnapshotResult,
  AriaSnapshotOptions,
  AriaSnapshotResult,
} from '../../core/services/snapshot.service.js';
import { createSubsystemLogger } from '../logging/pino-logger.adapter.js';

const log = createSubsystemLogger('pw-snapshot-adapter');

export class PlaywrightSnapshotAdapter {
  /**
   * Capture AI-friendly snapshot
   */
  async captureSnapshot(page: Page, options: SnapshotOptions): Promise<SnapshotResult> {
    const started = Date.now();
    log.debug('captureSnapshot started', { 
      url: page.url(), 
      options: JSON.stringify(options) 
    });

    try {
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

      // Build role refs
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
   * Capture accessibility tree snapshot
   */
  async captureAriaSnapshot(page: Page, limit: number = 500): Promise<AriaSnapshotResult> {
    const started = Date.now();
    log.debug('captureAriaSnapshot started', { url: page.url(), limit });

    const session = await page.context().newCDPSession(page);

    try {
      await session.send('Accessibility.enable');
      const res = await session.send('Accessibility.getFullAXTree');
      const nodes = Array.isArray(res?.nodes) ? res.nodes : [];

      const formatted = this.formatAriaSnapshot(nodes, limit);

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

  private buildRoleRefsFromSnapshot(snapshot: string): Record<string, { role: string; name?: string; nth?: number }> {
    // Implementation from pw-tools-core.snapshot.ts
    const refs: Record<string, { role: string; name?: string; nth?: number }> = {};
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

  private countInteractiveElements(refs: Record<string, any>): number {
    const interactiveRoles = ['button', 'link', 'textbox', 'combobox', 'listbox', 'checkbox', 'radio'];
    return Object.values(refs).filter(r => interactiveRoles.includes(r.role)).length;
  }

  private formatAriaSnapshot(nodes: any[], limit: number): any[] {
    // Implementation from cdp.ts formatAriaSnapshot
    return nodes.slice(0, limit);
  }
}
```

#### `src/adapters/playwright/playwright.interactions.adapter.ts`

**Source:** Extract from `src/browser/pw-tools-core.interactions.ts` (basic actions)

```typescript
// Expected content (~450 lines)
import type { Page, Locator } from 'playwright-core';
import { createSubsystemLogger } from '../logging/pino-logger.adapter.js';

const log = createSubsystemLogger('pw-interactions-adapter');

export type ClickOptions = {
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  timeoutMs?: number;
};

export type TypeOptions = {
  text: string;
  clear?: boolean;
  timeoutMs?: number;
};

export type FillOptions = {
  value: string;
  type?: 'text' | 'email' | 'phone' | 'date' | 'password';
  timeoutMs?: number;
};

export class PlaywrightInteractionsAdapter {
  /**
   * Click element
   */
  async click(page: Page, ref: string, options: ClickOptions = {}): Promise<void> {
    const started = Date.now();
    log.debug('click started', { ref, options: JSON.stringify(options) });

    const locator = this.refLocator(page, ref);
    const timeout = options.timeoutMs ?? 8000;

    try {
      if (options.doubleClick) {
        await locator.dblclick({ timeout, button: options.button });
      } else {
        await locator.click({ timeout, button: options.button, modifiers: options.modifiers });
      }

      log.info('click succeeded', { ref, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('click failed', error, { ref, duration_ms: Date.now() - started });
      throw this.wrapError(error, ref, 'click');
    }
  }

  /**
   * Type text
   */
  async type(page: Page, ref: string, options: TypeOptions): Promise<void> {
    const started = Date.now();
    log.debug('type started', { ref, text: options.text.substring(0, 20) });

    const locator = this.refLocator(page, ref);
    const timeout = options.timeoutMs ?? 8000;

    try {
      if (options.clear) {
        await locator.clear({ timeout });
      }
      await locator.fill(options.text, { timeout });

      log.info('type succeeded', { ref, duration_ms: Date.now() - started });
    } catch (error) {
      log.exception('type failed', error, { ref, duration_ms: Date.now() - started });
      throw this.wrapError(error, ref, 'type');
    }
  }

  /**
   * Fill field with verification
   */
  async fill(page: Page, ref: string, options: FillOptions): Promise<{ matched: boolean; actualValue: string }> {
    const started = Date.now();
    log.debug('fill started', { ref, value: options.value });

    const locator = this.refLocator(page, ref);
    const timeout = options.timeoutMs ?? 8000;

    try {
      // Try direct fill
      await locator.fill(options.value, { timeout });

      // Verify
      const actualValue = await locator.inputValue();
      const matched = actualValue === options.value;

      if (!matched) {
        // Fallback: sequential typing
        log.warn('fill verification failed, trying sequential typing', { ref, expected: options.value, actual: actualValue });
        await locator.pressSequentially(options.value, { timeout });
        const retryValue = await locator.inputValue();
        
        return {
          matched: retryValue === options.value,
          actualValue: retryValue,
        };
      }

      log.info('fill succeeded', { ref, duration_ms: Date.now() - started });
      return { matched: true, actualValue };
    } catch (error) {
      log.exception('fill failed', error, { ref, duration_ms: Date.now() - started });
      throw this.wrapError(error, ref, 'fill');
    }
  }

  /**
   * Hover element
   */
  async hover(page: Page, ref: string, timeoutMs: number = 8000): Promise<void> {
    const locator = this.refLocator(page, ref);
    await locator.hover({ timeout: timeoutMs });
  }

  /**
   * Drag element
   */
  async drag(page: Page, startRef: string, endRef: string, timeoutMs: number = 8000): Promise<void> {
    const startLocator = this.refLocator(page, startRef);
    const endLocator = this.refLocator(page, endRef);
    await startLocator.dragTo(endLocator, { timeout: timeoutMs });
  }

  /**
   * Select option
   */
  async selectOption(page: Page, ref: string, values: string[], timeoutMs: number = 8000): Promise<void> {
    const locator = this.refLocator(page, ref);
    await locator.selectOption(values, { timeout: timeoutMs });
  }

  /**
   * Press keyboard key
   */
  async pressKey(page: Page, key: string): Promise<void> {
    await page.keyboard.press(key);
  }

  private refLocator(page: Page, ref: string): Locator {
    return page.locator(`[aria-ref="${ref}"]`);
  }

  private wrapError(error: any, ref: string, action: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`Failed to ${action} [ref=${ref}]: ${message}`);
  }
}
```

#### `src/adapters/playwright/playwright.discovery.adapter.ts`

**Source:** Extract from `src/browser/pw-tools-core.interactions.ts` (discovery actions)

```typescript
// Expected content (~350 lines)
import type { Page } from 'playwright-core';

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

export class PlaywrightDiscoveryAdapter {
  /**
   * Discover dropdown options
   */
  async discoverDropdownOptions(page: Page, ref: string): Promise<DropdownOption[]> {
    return await page.evaluate((ref) => {
      const element = document.querySelector(`[aria-ref="${ref}"]`);
      if (!element) return [];

      const optionElements = element.querySelectorAll('[role="option"]');
      return Array.from(optionElements).map((opt, idx) => ({
        ref: `d${idx}`,
        text: opt.textContent?.trim() ?? '',
        value: (opt as any).value,
        selected: opt.getAttribute('aria-selected') === 'true',
      }));
    }, ref);
  }

  /**
   * Close dropdown
   */
  async closeDropdown(page: Page, ref: string): Promise<void> {
    await page.evaluate((ref) => {
      const element = document.querySelector(`[aria-ref="${ref}"]`);
      if (element) {
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, ref);
  }

  /**
   * Detect blocking element
   */
  async detectBlockingElement(page: Page): Promise<BlockerInfo | null> {
    return await page.evaluate(() => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const topElement = document.elementFromPoint(centerX, centerY);

      if (!topElement || topElement === document.body) {
        return null;
      }

      const computedStyle = window.getComputedStyle(topElement);
      const isBlocking =
        computedStyle.position === 'fixed' ||
        computedStyle.position === 'absolute' ||
        (computedStyle.zIndex !== 'auto' && parseInt(computedStyle.zIndex) > 100);

      if (!isBlocking) return null;

      return {
        type: classifyBlocker(topElement),
        selector: getElementSelector(topElement),
        closeSelector: findCloseButton(topElement),
        suggestedStrategy: 'click-close',
      };
    });
  }

  /**
   * Dismiss blocker
   */
  async dismissBlocker(page: Page, strategy: string = 'click-close'): Promise<boolean> {
    if (strategy === 'click-close') {
      // Click close button
      await page.evaluate(() => {
        const closeBtn = document.querySelector('[class*="close"], [aria-label*="close"]');
        if (closeBtn) {
          (closeBtn as HTMLElement).click();
        }
      });
      return true;
    } else if (strategy === 'press-escape') {
      await page.keyboard.press('Escape');
      return true;
    } else if (strategy === 'click-outside') {
      await page.evaluate(() => {
        document.body.click();
      });
      return true;
    }
    return false;
  }

  /**
   * Query element state
   */
  async queryElementState(page: Page, ref: string, state: string): Promise<boolean> {
    return await page.evaluate(({ ref, state }) => {
      const element = document.querySelector(`[aria-ref="${ref}"]`);
      if (!element) return false;

      switch (state) {
        case 'visible':
          return (element as any).checkVisibility?.() ?? true;
        case 'enabled':
          return !(element as any).disabled;
        case 'editable':
          return !(element as any).readOnly;
        case 'obscured':
          return false;
        default:
          return false;
      }
    }, { ref, state });
  }
}

function classifyBlocker(element: Element): 'modal' | 'overlay' | 'popup' | 'cookie-banner' {
  const className = element.className.toLowerCase();
  if (className.includes('cookie')) return 'cookie-banner';
  if (className.includes('modal')) return 'modal';
  if (className.includes('overlay')) return 'overlay';
  return 'popup';
}

function getElementSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  if (element.className) return `.${element.className.split(' ')[0]}`;
  return element.tagName.toLowerCase();
}

function findCloseButton(element: Element): string | null {
  const closeBtn = element.querySelector('[class*="close"], [aria-label*="close"]');
  return closeBtn ? getElementSelector(closeBtn) : null;
}
```

---

### Step 2: Chrome Adapters (Day 2-3)

#### `src/adapters/chrome/chrome-launcher.adapter.ts`

**Source:** Extract from `src/browser/chrome.ts`

```typescript
// Expected content (~250 lines)
import { spawn, type ChildProcess } from 'node:child_process';
import { createSubsystemLogger } from '../logging/pino-logger.adapter.js';

const log = createSubsystemLogger('chrome-launcher');

export type RunningChrome = {
  pid: number;
  cdpPort: number;
  process: ChildProcess;
};

export type ChromeLaunchOptions = {
  cdpPort: number;
  headless: boolean;
  userDataDir: string;
  viewport?: { width: number; height: number };
  noSandbox?: boolean;
};

export class ChromeLauncherAdapter {
  private running = new Map<number, RunningChrome>();

  async launch(options: ChromeLaunchOptions): Promise<RunningChrome> {
    const { cdpPort, headless, userDataDir, viewport, noSandbox } = options;

    log.info('launching Chrome', {
      cdpPort,
      headless,
      userDataDir,
      viewport: viewport ? `${viewport.width}x${viewport.height}` : 'default',
    });

    const args = [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--no-first-run',
    ];

    if (headless) {
      args.push('--headless=new');
    }

    if (viewport) {
      args.push(`--window-size=${viewport.width},${viewport.height}`);
    }

    if (noSandbox) {
      args.push('--no-sandbox');
      args.push('--disable-setuid-sandbox');
    }

    const chromePath = await this.findChromeExecutable();
    const process = spawn(chromePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    process.stderr?.on('data', (data) => {
      log.debug('chrome stderr', { message: data.toString().trim() });
    });

    const running: RunningChrome = {
      pid: process.pid!,
      cdpPort,
      process,
    };

    this.running.set(cdpPort, running);

    // Wait for Chrome to be ready
    await this.waitForChromeReady(`http://127.0.0.1:${cdpPort}`);

    log.info('Chrome launched successfully', { pid: process.pid, cdpPort });
    return running;
  }

  async stop(chrome: RunningChrome): Promise<void> {
    log.info('stopping Chrome', { pid: chrome.pid, cdpPort: chrome.cdpPort });

    try {
      chrome.process.kill('SIGTERM');

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        chrome.process.on('exit', () => resolve());
        setTimeout(resolve, 5000); // Timeout after 5s
      });

      this.running.delete(chrome.cdpPort);
      log.info('Chrome stopped', { pid: chrome.pid });
    } catch (error) {
      log.exception('Chrome stop failed', error, { pid: chrome.pid });
      // Force kill
      try {
        chrome.process.kill('SIGKILL');
      } catch {
        // Ignore
      }
    }
  }

  async isReachable(cdpUrl: string, timeoutMs: number = 500): Promise<boolean> {
    try {
      const response = await fetch(`${cdpUrl}/json/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async findChromeExecutable(): Promise<string> {
    // Implementation from chrome.executables.ts
    const platforms = {
      linux: '/usr/bin/google-chrome',
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    };

    const platform = process.platform as keyof typeof platforms;
    return platforms[platform] ?? 'google-chrome';
  }

  private async waitForChromeReady(cdpUrl: string, maxAttempts: number = 20): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const reachable = await this.isReachable(cdpUrl, 500);
      if (reachable) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Chrome failed to start');
  }
}
```

#### `src/adapters/chrome/extension-relay.*.ts` (4 files)

**Source:** Split `src/browser/extension-relay.ts` (790 lines)

See the main refactoring plan for detailed splitting strategy.

---

### Step 3: HTTP & Logging Adapters (Day 3-4)

#### `src/adapters/http/express.server.adapter.ts`

**Source:** Extract from `src/browser/server.ts`

```typescript
// Expected content (~150 lines)
import type { Server } from 'node:http';
import express from 'express';
import { createSubsystemLogger } from '../logging/pino-logger.adapter.js';

const log = createSubsystemLogger('express-server');

export type ExpressServerOptions = {
  port: number;
  host?: string;
};

export class ExpressServerAdapter {
  private server: Server | null = null;
  private app: express.Application;

  constructor() {
    this.app = express();
    this.app.use(express.json({ limit: '50mb' }));
  }

  async start(options: ExpressServerOptions): Promise<{ port: number; server: Server }> {
    const { port, host = '127.0.0.1' } = options;

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, host, () => {
        log.info('server started', { port, host });
        resolve({ port, server: this.server! });
      });

      this.server.once('error', (err) => {
        log.exception('server failed to start', err, { port, host });
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => {
          log.info('server stopped');
          resolve();
        });
      });
      this.server = null;
    }
  }

  use(middleware: express.RequestHandler): void {
    this.app.use(middleware);
  }

  get(path: string, handler: express.RequestHandler): void {
    this.app.get(path, handler);
  }

  post(path: string, handler: express.RequestHandler): void {
    this.app.post(path, handler);
  }
}
```

#### `src/adapters/logging/pino-logger.adapter.ts`

**Source:** Replace `src/logging/subsystem.ts`

```typescript
// Expected content (~150 lines)
import pino from 'pino';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  exception(message: string, err: unknown, extra?: Record<string, unknown>): void;
}

let logger: pino.Logger | null = null;

export function createSubsystemLogger(subsystem: string): Logger {
  if (!logger) {
    logger = pino({
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.LOG_FORMAT === 'json' ? undefined : {
        target: 'pino-pretty',
      },
    });
  }

  const child = logger.child({ subsystem });

  return {
    debug(message, extra) {
      child.debug(extra, message);
    },
    info(message, extra) {
      child.info(extra, message);
    },
    warn(message, extra) {
      child.warn(extra, message);
    },
    error(message, extra) {
      child.error(extra, message);
    },
    exception(message, err, extra) {
      child.error({ err, ...extra }, message);
    },
  };
}
```

---

## ✅ Tests That Must Pass

### Unit Tests

```bash
# Chrome launcher tests
npm run test:unit -- src/__tests__/unit/chrome-launcher.unit.test.ts

# Session tests
npm run test:unit -- src/__tests__/unit/pw-session.unit.test.ts

# Snapshot tests
npm run test:unit -- src/__tests__/unit/pw-tools-snapshot.unit.test.ts

# Interaction tests
npm run test:unit -- src/__tests__/unit/pw-tools-interactions.unit.test.ts

# DOM Observer tests
npm run test:unit -- src/__tests__/unit/pw-tools-dom-observer.unit.test.ts
```

### Integration Tests

```bash
# Interaction integration
npm run test:integration -- src/__tests__/integration/pw-tools-interactions.integration.test.ts

# DOM Observer integration
npm run test:integration -- src/__tests__/integration/pw-tools-dom-observer.integration.test.ts
```

---

## 🤖 AI Agent Prompt

```
You are helping refactor the Tailorec Browser Service to Clean Architecture.

CONTEXT:
- We are implementing Worktree B: Infrastructure Adapters
- Branch: refactor/worktree-b-adapters
- Goal: Create adapter implementations for all ports
- Max file size: 700 lines
- Worktree A defines the ports/interfaces

TASK:
Help me create the following files in src/adapters/:

1. src/adapters/playwright/playwright.browser-driver.adapter.ts
2. src/adapters/playwright/playwright.snapshot.adapter.ts
3. src/adapters/playwright/playwright.interactions.adapter.ts
4. src/adapters/playwright/playwright.discovery.adapter.ts
5. src/adapters/playwright/playwright.navigation.adapter.ts
6. src/adapters/chrome/chrome-launcher.adapter.ts
7. src/adapters/chrome/chrome-executables.adapter.ts
8. src/adapters/chrome/extension-relay.types.ts
9. src/adapters/chrome/extension-relay.utils.ts
10. src/adapters/chrome/extension-relay.server.ts
11. src/adapters/chrome/extension-relay.router.ts
12. src/adapters/http/express.server.adapter.ts
13. src/adapters/http/express.middleware.adapter.ts
14. src/adapters/logging/pino-logger.adapter.ts

CONSTRAINTS:
- Implement interfaces from Worktree A (core/ports/)
- Extract logic from existing files (don't rewrite from scratch)
- Keep files under 700 lines
- Use TypeScript strict mode
- Preserve all functionality

SOURCE FILES:
- src/browser/pw-session.ts (711 lines)
- src/browser/pw-tools-core.interactions.ts (1298 lines)
- src/browser/pw-tools-core.snapshot.ts (279 lines)
- src/browser/chrome.ts (304 lines)
- src/browser/extension-relay.ts (790 lines)

Please help me create [SPECIFIC_FILE] by implementing [PORT_INTERFACE] from src/core/ports/.
```

---

## 📝 Definition of Done

- [ ] All 14+ adapter files created
- [ ] All adapters implement corresponding ports from Worktree A
- [ ] No file exceeds 700 lines
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] TypeScript compilation succeeds
- [ ] No circular dependencies
- [ ] Code reviewed by team member

---

**Created:** 2026-03-04  
**Version:** 1.0  
**Status:** Ready for Implementation
