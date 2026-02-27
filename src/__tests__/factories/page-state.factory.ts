/**
 * Page state factory for creating mock Playwright page states.
 * Used for testing pw-session.ts and related modules.
 */

import type {
  Browser,
  BrowserContext,
  Page,
  ConsoleMessage,
  Request,
  Response,
} from "playwright-core";

import { generateTargetId, generateTimestamp, generateUrl } from "./test-data.factory.js";

/**
 * Creates a mock ConsoleMessage for testing.
 */
export function createMockConsoleMessage(options?: {
  type?: string;
  text?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}): ConsoleMessage {
  return {
    type: options?.type ?? "log",
    text: options?.text ?? "test message",
    url: options?.url ?? "https://example.test",
    lineNumber: options?.lineNumber ?? 0,
    columnNumber: options?.columnNumber ?? 0,
    location: () => ({
      url: options?.url ?? "https://example.test",
      lineNumber: options?.lineNumber ?? 0,
      columnNumber: options?.columnNumber ?? 0,
    }),
    args: () => [],
    page: null as any,
    worker: null as any,
  } as any;
}

/**
 * Creates a mock Request for testing.
 */
export function createMockRequest(options?: {
  url?: string;
  method?: string;
  resourceType?: string;
  headers?: Record<string, string>;
  postData?: string;
}): Request {
  const url = options?.url ?? generateUrl();
  return {
    url: () => url,
    method: () => options?.method ?? "GET",
    resourceType: () => options?.resourceType ?? "document",
    headers: () => options?.headers ?? {},
    postData: () => options?.postData,
    postDataBuffer: () => (options?.postData ? Buffer.from(options.postData) : null),
    postDataJSON: () => {
      try {
        return options?.postData ? JSON.parse(options.postData) : {};
      } catch {
        return {};
      }
    },
    frame: () => null as any,
    serviceWorker: () => null as any,
    isNavigationRequest: () => true,
    redirectedFrom: () => null as any,
    redirectedTo: () => null as any,
    failure: () => null as any,
    sizes: () => ({ requestBodySize: 0, requestHeadersSize: 0, responseBodySize: 0, responseHeadersSize: 0 }),
    timing: () => ({ startTime: 0, domainLookupStart: 0, domainLookupEnd: 0, connectStart: 0, connectEnd: 0, secureConnectionStart: 0, requestStart: 0, responseStart: 0, responseEnd: 0 }),
    headersArray: () => [],
    allHeaders: () => Promise.resolve({}),
    headerValue: () => Promise.resolve(null as any),
    response: () => null as any,
  } as any;
}

/**
 * Creates a mock Response for testing.
 */
export function createMockResponse(options?: {
  url?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  ok?: boolean;
  request?: Request;
}): Response {
  const url = options?.url ?? generateUrl();
  const status = options?.status ?? 200;
  return {
    url: () => url,
    status: () => status,
    statusText: () => options?.statusText ?? "OK",
    headers: () => options?.headers ?? {},
    headersArray: () => [],
    body: () => Promise.resolve(Buffer.from(options?.body ?? "")),
    text: () => Promise.resolve(options?.body ?? ""),
    json: () => Promise.resolve(options?.body ? JSON.parse(options.body) : {}),
    ok: () => options?.ok ?? (status >= 200 && status < 300),
    request: () => options?.request ?? (createMockRequest({ url }) as any),
    frame: () => null as any,
    fromServiceWorker: () => false,
    securityDetails: () => null as any,
    serverAddr: () => null as any,
    sizes: () => ({ requestBodySize: 0, requestHeadersSize: 0, responseBodySize: 0, responseHeadersSize: 0 }),
    finished: () => Promise.resolve(),
    allHeaders: () => Promise.resolve({}),
    headerValue: () => Promise.resolve(null as any),
    headerValues: () => [],
  } as any;
}

/**
 * Creates a mock Page for testing.
 */
export function createMockPage(options?: {
  url?: string;
  title?: string;
  viewport?: { width: number; height: number };
}): Page {
  const currentUrl = options?.url ?? generateUrl();
  const eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

  const page = {
    url: () => currentUrl,
    title: () => Promise.resolve(options?.title ?? "Test Page"),
    viewport: () =>
      options?.viewport
        ? { width: options.viewport.width, height: options.viewport.height }
        : null,
    goto: (url: string) => {
      (page as any)._url = url;
      return Promise.resolve(null);
    },
    reload: () => Promise.resolve(null as any),
    goBack: () => Promise.resolve(null),
    goForward: () => Promise.resolve(null),
    emulateMedia: () => Promise.resolve(),
    setViewportSize: () => Promise.resolve(),
    addInitScript: () => Promise.resolve({}),
    exposeBinding: () => Promise.resolve(),
    exposeFunction: () => Promise.resolve(),
    route: () => Promise.resolve(),
    unroute: () => Promise.resolve(),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const handlers = eventHandlers.get(event) ?? [];
      handlers.push(handler);
      eventHandlers.set(event, handlers);
      return page as any;
    },
    once: (event: string, handler: (...args: unknown[]) => void) => page.on(event, handler),
    off: (event: string, handler: (...args: unknown[]) => void) => {
      const handlers = eventHandlers.get(event) ?? [];
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
      eventHandlers.set(event, handlers);
      return page as any;
    },
    removeListener: (event: string, handler: (...args: unknown[]) => void) => page.off(event, handler),
    addListener: (event: string, handler: (...args: unknown[]) => void) => page.on(event, handler),
    emit: (event: string, ...args: unknown[]) => {
      const handlers = eventHandlers.get(event) ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
      return page as any;
    },
    listenerCount: (event: string) => (eventHandlers.get(event) ?? []).length,
    removeAllListeners: (event?: string) => {
      if (event) {
        eventHandlers.delete(event);
      } else {
        eventHandlers.clear();
      }
      return page as any;
    },
    prependListener: (event: string, handler: (...args: unknown[]) => void) => page.on(event, handler),
    addLocatorHandler: () => Promise.resolve({}),
    addScriptTag: () => Promise.resolve({} as any),
    addStyleTag: () => Promise.resolve({} as any),
    evaluate: (fn: string | Function) => Promise.resolve(null as any),
    evaluateHandle: () => Promise.resolve({} as any),
    $: () => Promise.resolve(null),
    $$: () => Promise.resolve([]),
    $eval: () => Promise.resolve(null as any),
    $$eval: () => Promise.resolve(null as any),
    $x: () => Promise.resolve([]),
    locator: () => ({
      click: () => Promise.resolve(),
      fill: () => Promise.resolve(),
      type: () => Promise.resolve(),
      hover: () => Promise.resolve(),
      check: () => Promise.resolve(),
      uncheck: () => Promise.resolve(),
      selectOption: () => Promise.resolve([]),
      pressSequentially: () => Promise.resolve(),
      dblclick: () => Promise.resolve(),
      tap: () => Promise.resolve(),
      focus: () => Promise.resolve(),
      blur: () => Promise.resolve(),
      textContent: () => Promise.resolve(null),
      innerText: () => Promise.resolve(""),
      innerHTML: () => Promise.resolve(""),
      getAttribute: () => Promise.resolve(null),
      inputValue: () => Promise.resolve(""),
      isChecked: () => Promise.resolve(false),
      isDisabled: () => Promise.resolve(false),
      isEditable: () => Promise.resolve(false),
      isEnabled: () => Promise.resolve(false),
      isHidden: () => Promise.resolve(false),
      isVisible: () => Promise.resolve(false),
      waitFor: () => Promise.resolve(null as any),
      elementHandles: () => Promise.resolve([]),
      first: () => ({}) as any,
      last: () => ({}) as any,
      nth: () => ({}) as any,
      filter: () => ({}) as any,
      getByRole: () => ({}) as any,
      getByLabel: () => ({}) as any,
      getByPlaceholder: () => ({}) as any,
      getByText: () => ({}) as any,
      getByTitle: () => ({}) as any,
      frameLocator: () => ({}) as any,
      highlight: () => Promise.resolve(),
      screenshot: () => Promise.resolve(Buffer.from("")),
      scrollIntoViewIfNeeded: () => Promise.resolve(),
      dragTo: () => Promise.resolve(),
      selectText: () => Promise.resolve(),
      setChecked: () => Promise.resolve(),
      setInputFiles: () => Promise.resolve(),
      waitForElementState: () => Promise.resolve(),
      waitForSelector: () => Promise.resolve(null),
    }),
    getByRole: () => ({}) as any,
    getByLabel: () => ({}) as any,
    getByPlaceholder: () => ({}) as any,
    getByText: () => ({}) as any,
    getByTitle: () => ({}) as any,
    frameLocator: () => ({}) as any,
    frames: () => [],
    mainFrame: () => ({}) as any,
    context: () => null as any,
    opener: () => null as any,
    workers: () => [],
    addTags: () => Promise.resolve(),
    close: () => Promise.resolve(),
    isClosed: () => false,
    click: () => Promise.resolve(),
    dblclick: () => Promise.resolve(),
    dispatchEvent: () => Promise.resolve(),
    fill: () => Promise.resolve(),
    focus: () => Promise.resolve(),
    getAttribute: () => Promise.resolve(null),
    hover: () => Promise.resolve(),
    innerHTML: () => Promise.resolve(""),
    innerText: () => Promise.resolve(""),
    inputValue: () => Promise.resolve(""),
    isChecked: () => Promise.resolve(false),
    isDisabled: () => Promise.resolve(false),
    isEditable: () => Promise.resolve(false),
    isEnabled: () => Promise.resolve(false),
    isHidden: () => Promise.resolve(false),
    isVisible: () => Promise.resolve(false),
    press: () => Promise.resolve(),
    screenshot: () => Promise.resolve(Buffer.from("")),
    selectOption: () => Promise.resolve([]),
    setContent: () => Promise.resolve(),
    setInputFiles: () => Promise.resolve(),
    tap: () => Promise.resolve(),
    textContent: () => Promise.resolve(null),
    type: () => Promise.resolve(),
    uncheck: () => Promise.resolve(),
    waitForFunction: () => Promise.resolve({} as any),
    waitForLoadState: () => Promise.resolve(),
    waitForNavigation: () => Promise.resolve(null as any),
    waitForRequest: () => Promise.resolve({} as any),
    waitForResponse: () => Promise.resolve({} as any),
    waitForSelector: () => Promise.resolve(null),
    waitForTimeout: () => Promise.resolve(),
    pdf: () => Promise.resolve(Buffer.from("")),
    routeFromHAR: () => Promise.resolve(),
    video: () => null as any,
    consoleMessages: () => [],
    expect: () => ({}) as any,
  } as any;

  return page;
}

/**
 * Creates a mock BrowserContext for testing.
 */
export function createMockBrowserContext(options?: {
  pages?: Page[];
  tracing?: any;
}): BrowserContext {
  const pages = options?.pages ?? [createMockPage()];

  return {
    pages: () => pages,
    newPage: () => Promise.resolve(createMockPage() as any),
    close: () => Promise.resolve(),
    cookies: () => Promise.resolve([]),
    addCookies: () => Promise.resolve(),
    addInitScript: () => Promise.resolve({}),
    clearCookies: () => Promise.resolve(),
    clearPermissions: () => Promise.resolve(),
    exposeBinding: () => Promise.resolve(),
    exposeFunction: () => Promise.resolve(),
    grantPermissions: () => Promise.resolve(),
    route: () => Promise.resolve(),
    unroute: () => Promise.resolve(),
    setDefaultNavigationTimeout: () => {},
    setDefaultTimeout: () => {},
    setExtraHTTPHeaders: () => Promise.resolve(),
    setGeolocation: () => Promise.resolve(),
    setOffline: () => Promise.resolve(),
    storageState: () => Promise.resolve({ cookies: [], origins: [] }),
    waitForEvent: () => Promise.resolve({} as any),
    browser: () => null as any,
    opener: () => null as any,
    request: () => ({}) as any,
    serviceWorkers: () => [],
    videosDir: () => "",
    tracing: options?.tracing ?? ({
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      startChunk: () => Promise.resolve(),
      stopChunk: () => Promise.resolve(),
    }),
    on: () => ({}) as any,
    once: () => ({}) as any,
    off: () => ({}) as any,
    removeListener: () => ({}) as any,
    addListener: () => ({}) as any,
    emit: () => true,
    listenerCount: () => 0,
    removeAllListeners: () => ({}) as any,
    prependListener: () => ({}) as any,
    backgroundPages: () => [],
    newCDPSession: () => Promise.resolve({} as any),
    routeFromHAR: () => Promise.resolve(),
    routeWebSocket: () => {},
    setHTTPCredentials: () => {},
    unrouteAll: () => Promise.resolve(),
  } as any;
}

/**
 * Creates a mock Browser for testing.
 */
export function createMockBrowser(options?: {
  contexts?: any[];
  version?: string;
  userAgent?: string;
}): any {
  const contexts = options?.contexts ?? [createMockBrowserContext()];

  return {
    contexts: () => contexts,
    newContext: () => Promise.resolve(createMockBrowserContext() as any),
    newPage: () => Promise.resolve(createMockPage() as any),
    close: () => Promise.resolve(),
    version: () => options?.version ?? "1.40.0",
    userAgent: () => Promise.resolve(options?.userAgent ?? "Mock Browser"),
    browserType: () => ({
      name: () => "chromium",
      executablePath: () => "/usr/bin/chromium",
      launch: () => Promise.resolve({} as any),
      connect: () => Promise.resolve({} as any),
      connectOverCDP: () => Promise.resolve({} as any),
    }) as any,
    isConnected: () => true,
    on: () => ({}) as any,
    once: () => ({}) as any,
    off: () => ({}) as any,
    removeListener: () => ({}) as any,
    addListener: () => ({}) as any,
    emit: () => true,
    listenerCount: () => 0,
    removeAllListeners: () => ({}) as any,
    prependListener: () => ({}) as any,
    newBrowserCDPSession: () => Promise.resolve({} as any),
    startTracing: () => Promise.resolve(),
    stopTracing: () => Promise.resolve(),
    [Symbol.asyncDispose]: () => Promise.resolve(),
  } as any;
}

/**
 * Creates a mock BrowserConsoleMessage for testing pw-session.
 */
export function createBrowserConsoleMessage(options?: {
  type?: string;
  text?: string;
  timestamp?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}): {
  type: string;
  text: string;
  timestamp: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
} {
  return {
    type: options?.type ?? "log",
    text: options?.text ?? "test message",
    timestamp: options?.timestamp ?? generateTimestamp(),
    location: {
      url: options?.url ?? generateUrl(),
      lineNumber: options?.lineNumber,
      columnNumber: options?.columnNumber,
    },
  };
}

/**
 * Creates a mock BrowserPageError for testing pw-session.
 */
export function createBrowserPageError(options?: {
  message?: string;
  name?: string;
  stack?: string;
  timestamp?: string;
}): {
  message: string;
  name?: string;
  stack?: string;
  timestamp: string;
} {
  return {
    message: options?.message ?? "Test error",
    name: options?.name ?? "Error",
    stack: options?.stack,
    timestamp: options?.timestamp ?? generateTimestamp(),
  };
}

/**
 * Creates a mock BrowserNetworkRequest for testing pw-session.
 */
export function createBrowserNetworkRequest(options?: {
  id?: string;
  timestamp?: string;
  method?: string;
  url?: string;
  resourceType?: string;
  status?: number;
  ok?: boolean;
  failureText?: string;
}): {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  resourceType?: string;
  status?: number;
  ok?: boolean;
  failureText?: string;
} {
  return {
    id: options?.id ?? generateTargetId(),
    timestamp: options?.timestamp ?? generateTimestamp(),
    method: options?.method ?? "GET",
    url: options?.url ?? generateUrl(),
    resourceType: options?.resourceType ?? "document",
    status: options?.status ?? 200,
    ok: options?.ok ?? true,
    failureText: options?.failureText,
  };
}

/**
 * Creates mock role refs for testing pw-session.
 */
export function createRoleRefs(options?: {
  mode?: "role" | "aria";
  count?: number;
  frameSelector?: string;
}): {
  refs: Record<string, { role: string; name?: string; nth?: number }>;
  mode: "role" | "aria";
  frameSelector?: string;
} {
  const count = options?.count ?? 3;
  const mode = options?.mode ?? "role";
  const refs: Record<string, { role: string; name?: string; nth?: number }> = {};

  const roles = ["button", "link", "textbox", "combobox", "checkbox", "radio", "menuitem"];
  const names = ["Submit", "Cancel", "Username", "Select", "Agree", "Option", "Delete"];

  for (let i = 1; i <= count; i++) {
    const ref = `e${i}`;
    refs[ref] = {
      role: roles[i - 1] ?? "button",
      name: names[i - 1],
      nth: i > 3 ? i - 3 : undefined,
    };
  }

  return {
    refs,
    mode,
    frameSelector: options?.frameSelector,
  };
}
