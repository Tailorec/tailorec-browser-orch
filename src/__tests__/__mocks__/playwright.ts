/**
 * Mock implementations for Playwright modules.
 * These mocks are used for unit testing without launching real browsers.
 */

import { EventEmitter } from "node:events";

/**
 * Mock Locator class for testing.
 */
export class MockLocator extends EventEmitter {
  private selector: string;
  private elements: MockElementHandle[] = [];
  private clickCount = 0;
  private fillCount = 0;
  private hoverCount = 0;

  constructor(selector: string) {
    super();
    this.selector = selector;
  }

  async click(options?: {
    button?: "left" | "right" | "middle";
    modifiers?: Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift">;
    timeout?: number;
    delay?: number;
    position?: { x: number; y: number };
    clickCount?: number;
  }): Promise<void> {
    this.clickCount++;
    await new Promise((resolve) => setTimeout(resolve, options?.delay ?? 0));

    if (options?.timeout !== undefined && options.timeout <= 0) {
      throw new Error(`Timeout waiting for locator.click()`);
    }
  }

  async dblclick(options?: {
    button?: "left" | "right" | "middle";
    modifiers?: Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift">;
    timeout?: number;
    delay?: number;
    position?: { x: number; y: number };
  }): Promise<void> {
    this.clickCount += 2;
    await new Promise((resolve) => setTimeout(resolve, options?.delay ?? 0));
  }

  async fill(value: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    this.fillCount++;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async type(text: string, options?: { delay?: number; timeout?: number }): Promise<void> {
    this.fillCount++;
    await new Promise((resolve) => setTimeout(resolve, options?.delay ?? 50));
  }

  async pressSequentially(text: string, options?: { delay?: number }): Promise<void> {
    this.fillCount++;
    const totalDelay = (options?.delay ?? 50) * text.length;
    await new Promise((resolve) => setTimeout(resolve, totalDelay));
  }

  async hover(options?: { timeout?: number; position?: { x: number; y: number } }): Promise<void> {
    this.hoverCount++;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async check(options?: { timeout?: number; position?: { x: number; y: number } }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async uncheck(options?: { timeout?: number; position?: { x: number; y: number } }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async selectOption(
    values: string | { value?: string; label?: string; index?: number } | Array<string | { value?: string; label?: string; index?: number }>,
    options?: { timeout?: number; force?: boolean },
  ): Promise<string[]> {
    return Array.isArray(values) ? values.map((v) => (typeof v === "string" ? v : v.value ?? "")) : [typeof values === "string" ? values : values.value ?? ""];
  }

  async focus(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async blur(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async textContent(options?: { timeout?: number }): Promise<string | null> {
    return "test content";
  }

  async innerText(options?: { timeout?: number }): Promise<string> {
    return "test text";
  }

  async innerHTML(options?: { timeout?: number }): Promise<string> {
    return "<span>test</span>";
  }

  async getAttribute(name: string, options?: { timeout?: number }): Promise<string | null> {
    return null;
  }

  async inputValue(options?: { timeout?: number }): Promise<string> {
    return "";
  }

  async isChecked(options?: { timeout?: number }): Promise<boolean> {
    return false;
  }

  async isDisabled(options?: { timeout?: number }): Promise<boolean> {
    return false;
  }

  async isEditable(options?: { timeout?: number }): Promise<boolean> {
    return true;
  }

  async isEnabled(options?: { timeout?: number }): Promise<boolean> {
    return true;
  }

  async isHidden(options?: { timeout?: number }): Promise<boolean> {
    return false;
  }

  async isVisible(options?: { timeout?: number }): Promise<boolean> {
    return true;
  }

  async waitFor(options?: {
    state?: "attached" | "detached" | "visible" | "hidden";
    timeout?: number;
  }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async elementHandle(options?: { timeout?: number }): Promise<MockElementHandle | null> {
    return new MockElementHandle(this.selector);
  }

  async elementHandles(): Promise<MockElementHandle[]> {
    return this.elements;
  }

  first(): MockLocator {
    return new MockLocator(`${this.selector}:first`);
  }

  last(): MockLocator {
    return new MockLocator(`${this.selector}:last`);
  }

  nth(index: number): MockLocator {
    return new MockLocator(`${this.selector}:nth(${index})`);
  }

  filter(options?: { has?: MockLocator; hasText?: string | RegExp }): MockLocator {
    return new MockLocator(`${this.selector}:filtered`);
  }

  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): MockLocator {
    return new MockLocator(`role=${role}`);
  }

  getByLabel(label: string | RegExp, options?: { exact?: boolean }): MockLocator {
    return new MockLocator(`label=${label}`);
  }

  getByPlaceholder(placeholder: string | RegExp, options?: { exact?: boolean }): MockLocator {
    return new MockLocator(`placeholder=${placeholder}`);
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): MockLocator {
    return new MockLocator(`text=${text}`);
  }

  getByTitle(title: string | RegExp, options?: { exact?: boolean }): MockLocator {
    return new MockLocator(`title=${title}`);
  }

  frameLocator(frameSelector: string): MockFrameLocator {
    return new MockFrameLocator(frameSelector);
  }

  async highlight(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async screenshot(options?: { timeout?: number; type?: "png" | "jpeg"; quality?: number }): Promise<Buffer> {
    return Buffer.from("screenshot");
  }

  async scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async dragTo(target: MockLocator, options?: { sourcePosition?: { x: number; y: number }; targetPosition?: { x: number; y: number } }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  async selectText(options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async setChecked(checked: boolean, options?: { timeout?: number; position?: { x: number; y: number } }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async setInputFiles(
    files: string | { name?: string; mimeType?: string; buffer: Buffer } | Array<string | { name?: string; mimeType?: string; buffer: Buffer }>,
    options?: { timeout?: number },
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  async tap(options?: { modifiers?: Array<"Alt" | "Control" | "Meta" | "Shift">; position?: { x: number; y: number }; timeout?: number; trial?: boolean; force?: boolean }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async waitForElementState(state: "stable" | "visible" | "hidden" | "enabled" | "disabled" | "editable", options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async waitForSelector(selector: string, options?: { state?: "attached" | "detached" | "visible" | "hidden"; timeout?: number }): Promise<MockLocator | null> {
    return new MockLocator(selector);
  }

  getClickCount(): number {
    return this.clickCount;
  }

  getFillCount(): number {
    return this.fillCount;
  }

  getHoverCount(): number {
    return this.hoverCount;
  }
}

/**
 * Mock FrameLocator class for testing.
 */
export class MockFrameLocator {
  private frameSelector: string;

  constructor(frameSelector: string) {
    this.frameSelector = frameSelector;
  }

  locator(selector: string): MockLocator {
    return new MockLocator(`${this.frameSelector} >> ${selector}`);
  }

  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): MockLocator {
    return new MockLocator(`${this.frameSelector} >> role=${role}`);
  }

  getByLabel(label: string | RegExp, options?: { exact?: boolean }): MockLocator {
    return new MockLocator(`${this.frameSelector} >> label=${label}`);
  }

  getByPlaceholder(placeholder: string | RegExp, options?: { exact?: boolean }): MockLocator {
    return new MockLocator(`${this.frameSelector} >> placeholder=${placeholder}`);
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): MockLocator {
    return new MockLocator(`${this.frameSelector} >> text=${text}`);
  }

  getByTitle(title: string | RegExp, options?: { exact?: boolean }): MockLocator {
    return new MockLocator(`${this.frameSelector} >> title=${title}`);
  }
}

/**
 * Mock ElementHandle class for testing.
 */
export class MockElementHandle {
  private selector: string;

  constructor(selector: string) {
    this.selector = selector;
  }

  async $$(selector: string): Promise<MockElementHandle[]> {
    return [];
  }

  async $(selector: string): Promise<MockElementHandle | null> {
    return new MockElementHandle(`${this.selector} >> ${selector}`);
  }

  async evaluate(fn: string | Function, arg?: unknown): Promise<unknown> {
    return null;
  }

  async evaluateHandle(fn: string | Function, arg?: unknown): Promise<MockElementHandle> {
    return this;
  }

  async boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return { x: 0, y: 0, width: 100, height: 50 };
  }

  async contentFrame(): Promise<MockFrame | null> {
    return null;
  }

  async getAttribute(name: string): Promise<string | null> {
    return null;
  }

  async innerHTML(): Promise<string> {
    return "<span>test</span>";
  }

  async innerText(): Promise<string> {
    return "test";
  }

  async inputValue(): Promise<string> {
    return "";
  }

  async isChecked(): Promise<boolean> {
    return false;
  }

  async isDisabled(): Promise<boolean> {
    return false;
  }

  async isEditable(): Promise<boolean> {
    return true;
  }

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async isHidden(): Promise<boolean> {
    return false;
  }

  async isVisible(): Promise<boolean> {
    return true;
  }

  async ownerFrame(): Promise<MockFrame | null> {
    return null;
  }

  async press(key: string, options?: { delay?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, options?.delay ?? 10));
  }

  async screenshot(options?: { type?: "png" | "jpeg"; quality?: number }): Promise<Buffer> {
    return Buffer.from("element-screenshot");
  }

  async scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async selectOption(values: string | { value?: string; label?: string; index?: number } | Array<string | { value?: string; label?: string; index?: number }>): Promise<string[]> {
    return [];
  }

  async selectText(options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async setChecked(checked: boolean, options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async setInputFiles(files: string | { name?: string; mimeType?: string; buffer: Buffer } | Array<string | { name?: string; mimeType?: string; buffer: Buffer }>): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  async tap(options?: { modifiers?: Array<"Alt" | "Control" | "Meta" | "Shift">; position?: { x: number; y: number } }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async textContent(): Promise<string | null> {
    return "test content";
  }

  async type(text: string, options?: { delay?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, text.length * (options?.delay ?? 50)));
  }

  async uncheck(options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async waitForElementState(state: "stable" | "visible" | "hidden" | "enabled" | "disabled" | "editable"): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async waitForSelector(selector: string, options?: { state?: "attached" | "detached" | "visible" | "hidden"; timeout?: number }): Promise<MockElementHandle | null> {
    return null;
  }
}

/**
 * Mock Frame class for testing.
 */
export class MockFrame {
  private urlValue: string;
  private nameValue: string;

  constructor(url = "about:blank", name = "") {
    this.urlValue = url;
    this.nameValue = name;
  }

  $(selector: string): Promise<MockElementHandle | null> {
    return Promise.resolve(new MockElementHandle(selector));
  }

  $$(selector: string): Promise<MockElementHandle[]> {
    return Promise.resolve([]);
  }

  $eval(selector: string, fn: string | Function, arg?: unknown): Promise<unknown> {
    return Promise.resolve(null);
  }

  $$eval(selector: string, fn: string | Function, arg?: unknown): Promise<unknown> {
    return Promise.resolve(null);
  }

  $x(expression: string): Promise<MockElementHandle[]> {
    return Promise.resolve([]);
  }

  addScriptTag(options?: { url?: string; path?: string; content?: string; type?: string }): Promise<MockElementHandle> {
    return Promise.resolve(new MockElementHandle("script"));
  }

  addStyleTag(options?: { url?: string; path?: string; content?: string }): Promise<MockElementHandle> {
    return Promise.resolve(new MockElementHandle("style"));
  }

  async check(selector: string, options?: { strict?: boolean; timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async click(selector: string, options?: { button?: "left" | "right" | "middle"; modifiers?: Array<"Alt" | "Control" | "Meta" | "Shift">; timeout?: number; delay?: number; position?: { x: number; y: number } }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async content(): Promise<string> {
    return "<html><body></body></html>";
  }

  async dblclick(selector: string, options?: { button?: "left" | "right" | "middle"; modifiers?: Array<"Alt" | "Control" | "Meta" | "Shift">; timeout?: number; delay?: number; position?: { x: number; y: number } }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async dispatchEvent(selector: string, type: string, eventInit?: unknown, options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async evaluate(fn: string | Function, arg?: unknown): Promise<unknown> {
    return null;
  }

  async evaluateHandle(fn: string | Function, arg?: unknown): Promise<MockElementHandle> {
    return new MockElementHandle("handle");
  }

  async fill(selector: string, value: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async focus(selector: string, options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  async frameElement(): Promise<MockElementHandle> {
    return new MockElementHandle("iframe");
  }

  async getAttribute(selector: string, name: string, options?: { timeout?: number }): Promise<string | null> {
    return null;
  }

  async goto(url: string, options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; referer?: string }): Promise<MockResponse | null> {
    this.urlValue = url;
    return new MockResponse(url);
  }

  async hover(selector: string, options?: { timeout?: number; position?: { x: number; y: number } }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async innerHTML(selector: string, options?: { timeout?: number }): Promise<string> {
    return "<span>test</span>";
  }

  async innerText(selector: string, options?: { timeout?: number }): Promise<string> {
    return "test";
  }

  async inputValue(selector: string, options?: { timeout?: number }): Promise<string> {
    return "";
  }

  async isChecked(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return false;
  }

  async isDisabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return false;
  }

  async isEditable(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return true;
  }

  async isEnabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return true;
  }

  async isHidden(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return false;
  }

  async isVisible(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return true;
  }

  locator(selector: string): MockLocator {
    return new MockLocator(selector);
  }

  name(): string {
    return this.nameValue;
  }

  async press(selector: string, key: string, options?: { delay?: number; timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async selectOption(selector: string, values: string | { value?: string; label?: string; index?: number } | Array<string | { value?: string; label?: string; index?: number }>, options?: { timeout?: number; force?: boolean }): Promise<string[]> {
    return [];
  }

  async setContent(html: string, options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async setInputFiles(selector: string, files: string | { name?: string; mimeType?: string; buffer: Buffer } | Array<string | { name?: string; mimeType?: string; buffer: Buffer }>, options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  async tap(selector: string, options?: { modifiers?: Array<"Alt" | "Control" | "Meta" | "Shift">; position?: { x: number; y: number }; timeout?: number; trial?: boolean; force?: boolean }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async textContent(selector: string, options?: { timeout?: number }): Promise<string | null> {
    return "test content";
  }

  async title(): Promise<string> {
    return "Test Frame";
  }

  async type(selector: string, text: string, options?: { delay?: number; timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, text.length * 50));
  }

  async uncheck(selector: string, options?: { timeout?: number; strict?: boolean }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  url(): string {
    return this.urlValue;
  }

  async waitForFunction(fn: string | Function, arg?: unknown, options?: { polling?: "raf" | "mutation" | number; timeout?: number }): Promise<MockElementHandle> {
    return new MockElementHandle("handle");
  }

  async waitForLoadState(state?: "load" | "domcontentloaded" | "networkidle", options?: { timeout?: number }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async waitForNavigation(options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; url?: string | RegExp }): Promise<MockResponse | null> {
    return new MockResponse(this.urlValue);
  }

  async waitForSelector(selector: string, options?: { state?: "attached" | "detached" | "visible" | "hidden"; timeout?: number }): Promise<MockElementHandle | null> {
    return new MockElementHandle(selector);
  }

  async waitForTimeout(timeout: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, timeout));
  }
}

/**
 * Mock Response class for testing.
 */
export class MockResponse {
  private urlValue: string;
  private statusValue: number;
  private statusTextValue: string;
  private headersValue: Record<string, string>;
  private bodyValue: string;

  constructor(url = "about:blank", status = 200, statusText = "OK", headers: Record<string, string> = {}, body = "") {
    this.urlValue = url;
    this.statusValue = status;
    this.statusTextValue = statusText;
    this.headersValue = headers;
    this.bodyValue = body;
  }

  url(): string {
    return this.urlValue;
  }

  status(): number {
    return this.statusValue;
  }

  statusText(): string {
    return this.statusTextValue;
  }

  headers(): Record<string, string> {
    return this.headersValue;
  }

  headersArray(): Array<{ name: string; value: string }> {
    return Object.entries(this.headersValue).map(([name, value]) => ({ name, value }));
  }

  async body(): Promise<Buffer> {
    return Buffer.from(this.bodyValue);
  }

  async text(): Promise<string> {
    return this.bodyValue;
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyValue || "{}");
  }

  ok(): boolean {
    return this.statusValue >= 200 && this.statusValue < 300;
  }

  request(): MockRequest {
    return new MockRequest(this.urlValue);
  }

  frame(): MockFrame | null {
    return null;
  }

  fromServiceWorker(): boolean {
    return false;
  }

  securityDetails(): null {
    return null;
  }

  serverAddr(): null {
    return null;
  }

  sizes(): { requestBodySize: number; requestHeadersSize: number; responseBodySize: number; responseHeadersSize: number } {
    return { requestBodySize: 0, requestHeadersSize: 0, responseBodySize: 0, responseHeadersSize: 0 };
  }

  async finished(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Mock Request class for testing.
 */
export class MockRequest {
  private urlValue: string;
  private methodValue: string;
  private headersValue: Record<string, string>;

  constructor(url = "about:blank", method = "GET", headers: Record<string, string> = {}) {
    this.urlValue = url;
    this.methodValue = method;
    this.headersValue = headers;
  }

  url(): string {
    return this.urlValue;
  }

  method(): string {
    return this.methodValue;
  }

  headers(): Record<string, string> {
    return this.headersValue;
  }

  headersArray(): Array<{ name: string; value: string }> {
    return Object.entries(this.headersValue).map(([name, value]) => ({ name, value }));
  }

  postData(): string | null {
    return null;
  }

  postDataBuffer(): Buffer | null {
    return null;
  }

  postDataJSON(): Record<string, unknown> {
    return {};
  }

  frame(): null {
    return null;
  }

  serviceWorker(): null {
    return null;
  }

  isNavigationRequest(): boolean {
    return true;
  }

  redirectedFrom(): null {
    return null;
  }

  redirectedTo(): null {
    return null;
  }

  failure(): null {
    return null;
  }

  sizes(): { requestBodySize: number; requestHeadersSize: number; responseBodySize: number; responseHeadersSize: number } {
    return { requestBodySize: 0, requestHeadersSize: 0, responseBodySize: 0, responseHeadersSize: 0 };
  }

  timing(): { startTime: number; domainLookupStart: number; domainLookupEnd: number; connectStart: number; connectEnd: number; secureConnectionStart: number; requestStart: number; responseStart: number; responseEnd: number } {
    return { startTime: 0, domainLookupStart: 0, domainLookupEnd: 0, connectStart: 0, connectEnd: 0, secureConnectionStart: 0, requestStart: 0, responseStart: 0, responseEnd: 0 };
  }
}

/**
 * Creates a mock locator for testing.
 */
export function createMockLocator(selector = "test"): MockLocator {
  return new MockLocator(selector);
}
