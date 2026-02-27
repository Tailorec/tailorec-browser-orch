/**
 * Mock implementations for Express module.
 * Used for unit testing Express applications without real HTTP servers.
 */

import { EventEmitter } from "node:events";

/**
 * Mock Request class for testing.
 */
export class MockRequest {
  method = "GET";
  url = "/";
  path = "/";
  query: Record<string, string> = {};
  params: Record<string, string> = {};
  headers: Record<string, string> = {};
  body: any = {};
  cookies: Record<string, string> = {};
  ip = "127.0.0.1";
  ips: string[] = ["127.0.0.1"];
  hostname = "localhost";
  protocol = "http";
  secure = false;
  xhr = false;

  private eventHandlers = new Map<string, Array<(...args: any[]) => void>>();

  constructor(options?: Partial<MockRequest>) {
    if (options) {
      Object.assign(this, options);
    }
  }

  get(header: string): string | undefined {
    const lower = header.toLowerCase();
    for (const [key, value] of Object.entries(this.headers)) {
      if (key.toLowerCase() === lower) {
        return value;
      }
    }
    return undefined;
  }

  header = this.get.bind(this);

  accepts(...types: string[]): string | false {
    return types[0] ?? false;
  }

  acceptsCharsets(...charsets: string[]): string | false {
    return charsets[0] ?? false;
  }

  acceptsEncodings(...encodings: string[]): string | false {
    return encodings[0] ?? false;
  }

  acceptsLanguages(...languages: string[]): string | false {
    return languages[0] ?? false;
  }

  is(...types: string[]): string | false {
    return types[0] ?? false;
  }

  on(event: string, handler: (...args: any[]) => void): this {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
    return this;
  }

  once(event: string, handler: (...args: any[]) => void): this {
    return this.on(event, handler);
  }

  emit(event: string, ...args: any[]): boolean {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      handler(...args);
    }
    return handlers.length > 0;
  }
}

/**
 * Mock Response class for testing.
 */
export class MockResponse extends EventEmitter {
  statusCode = 200;
  statusMessage = "OK";
  headers: Record<string, string | string[]> = {};
  private bodyValue: any = null;
  private chunks: Buffer[] = [];
  private ended = false;
  private eventHandlers = new Map<string, Array<(...args: any[]) => void>>();

  get headersSent(): boolean {
    return this.ended;
  }

  get finished(): boolean {
    return this.ended;
  }

  get headersSentValue(): boolean {
    return this.ended;
  }

  // Chainable methods
  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  sendStatus(code: number): this {
    this.statusCode = code;
    this.bodyValue = http.STATUS_CODES[code as keyof typeof http.STATUS_CODES] ?? "Unknown";
    this.ended = true;
    this.emit("finish");
    this.emit("end");
    return this;
  }

  setHeader(name: string, value: string | string[]): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  header = this.setHeader.bind(this);

  getHeader(name: string): string | string[] | undefined {
    return this.headers[name.toLowerCase()];
  }

  getHeaders(): Record<string, string | string[]> {
    return { ...this.headers };
  }

  removeHeader(name: string): this {
    delete this.headers[name.toLowerCase()];
    return this;
  }

  hasHeader(name: string): boolean {
    return name.toLowerCase() in this.headers;
  }

  append(name: string, value: string): this {
    const lower = name.toLowerCase();
    const existing = this.headers[lower];
    if (existing) {
      this.headers[lower] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      this.headers[lower] = value;
    }
    return this;
  }

  type(type: string): this {
    if (!type.includes("/")) {
      type = mime.getType(type) ?? "application/octet-stream";
    }
    this.setHeader("Content-Type", type);
    return this;
  }

  contentType = this.type.bind(this);

  location(path: string): this {
    this.setHeader("Location", path);
    return this;
  }

  redirect(status: number | string, url?: string): this {
    if (typeof status === "string") {
      url = status;
      status = 302;
    }
    this.statusCode = Number(status);
    this.setHeader("Location", url ?? "/");
    this.bodyValue = `Redirecting to ${url}`;
    this.ended = true;
    this.emit("finish");
    this.emit("end");
    return this;
  }

  json(body: any): this {
    this.setHeader("Content-Type", "application/json; charset=utf-8");
    this.bodyValue = JSON.stringify(body);
    this.ended = true;
    this.emit("finish");
    this.emit("end");
    return this;
  }

  jsonp(body: any): this {
    const callback = (this as any).query?.callback ?? "callback";
    this.setHeader("Content-Type", "application/javascript; charset=utf-8");
    this.bodyValue = `${callback}(${JSON.stringify(body)})`;
    this.ended = true;
    this.emit("finish");
    this.emit("end");
    return this;
  }

  send(body: any): this {
    if (typeof body === "object" && body !== null) {
      return this.json(body);
    }
    this.bodyValue = body;
    this.ended = true;
    this.emit("finish");
    this.emit("end");
    return this;
  }

  write(chunk: string | Buffer, encoding?: string, callback?: () => void): boolean {
    this.chunks.push(typeof chunk === "string" ? Buffer.from(chunk, encoding as any) : chunk);
    callback?.();
    return true;
  }

  end(chunk?: string | Buffer, encoding?: string, callback?: () => void): this {
    if (chunk) {
      this.chunks.push(typeof chunk === "string" ? Buffer.from(chunk, encoding as any) : chunk);
    }
    if (this.chunks.length > 0) {
      this.bodyValue = Buffer.concat(this.chunks).toString();
    }
    this.ended = true;
    callback?.();
    this.emit("finish");
    this.emit("end");
    return this;
  }

  writeHead(statusCode: number, headers?: Record<string, string>): this;
  writeHead(statusCode: number, statusMessage?: string, headers?: Record<string, string>): this;
  writeHead(statusCode: number, arg2?: any, arg3?: any): this {
    this.statusCode = statusCode;
    const headers = typeof arg2 === "string" ? arg3 : arg2;
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        this.setHeader(name, value as string | string[]);
      }
    }
    return this;
  }

  sendFile(path: string, options?: any, callback?: (err?: Error) => void): void {
    this.bodyValue = `[File: ${path}]`;
    this.ended = true;
    callback?.();
    this.emit("finish");
    this.emit("end");
  }

  download(path: string, filename?: string, options?: any, callback?: (err?: Error) => void): void {
    if (typeof filename === "function") {
      callback = filename;
      filename = undefined;
    }
    this.setHeader("Content-Disposition", `attachment; filename="${filename ?? path.split("/").pop()}"`);
    this.sendFile(path, options, callback);
  }

  format(object: { [key: string]: (req: MockRequest, res: MockResponse) => void }): this {
    const acceptHeader = this.getHeader("Accept");
    const type = (typeof acceptHeader === "string" ? acceptHeader : undefined) ?? "default";
    const handler = object[type] ?? object.default ?? object["*/*"];
    if (handler) {
      const stringHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(this.headers)) {
        stringHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
      }
      handler(new MockRequest({ headers: stringHeaders }), this);
    } else {
      this.status(406).send("Not Acceptable");
    }
    return this;
  }

  render(view: string, options?: any, callback?: (err: Error | null, html?: string) => void): void {
    const html = `<html><body>${view}</body></html>`;
    if (callback) {
      callback(null, html);
    } else {
      this.send(html);
    }
  }

  // Getters
  getBody(): any {
    return this.bodyValue;
  }

  getBodyText(): string {
    return this.bodyValue ?? "";
  }

  getChunks(): Buffer[] {
    return [...this.chunks];
  }

  isEnded(): boolean {
    return this.ended;
  }

  // Socket mock
  socket = {
    remoteAddress: "127.0.0.1",
    remotePort: 12345,
    localAddress: "127.0.0.1",
    localPort: 8080,
  };

  // Connection mock
  connection = this.socket;

  // locals
  locals: Record<string, any> = {};

  // Cookie methods
  cookie(name: string, value: string, options?: any): this {
    let cookie = `${name}=${value}`;
    if (options?.maxAge) {
      cookie += `; Max-Age=${options.maxAge}`;
    }
    if (options?.path) {
      cookie += `; Path=${options.path}`;
    }
    if (options?.domain) {
      cookie += `; Domain=${options.domain}`;
    }
    if (options?.secure) {
      cookie += "; Secure";
    }
    if (options?.httpOnly) {
      cookie += "; HttpOnly";
    }
    this.append("Set-Cookie", cookie);
    return this;
  }

  clearCookie(name: string, options?: any): this {
    return this.cookie(name, "", { ...options, maxAge: -1 });
  }

  // Attachment
  attachment(filename?: string): this {
    if (filename) {
      this.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }
    return this;
  }

  // Vary
  vary(field: string): this {
    const existing = this.getHeader("Vary");
    const value = existing ? `${existing}, ${field}` : field;
    this.setHeader("Vary", value);
    return this;
  }

  // On methods for events
  on(event: string, listener: (...args: any[]) => void): this {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(listener);
    this.eventHandlers.set(event, handlers);
    return this;
  }

  once(event: string, listener: (...args: any[]) => void): this {
    return this.on(event, listener);
  }

  emit(event: string, ...args: any[]): boolean {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      handler(...args);
    }
    return handlers.length > 0;
  }
}

/**
 * Mock Application class for testing.
 */
export class MockApplication extends EventEmitter {
  private routes: Array<{
    method: string;
    path: string | RegExp;
    handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>;
  }> = [];

  private middlewares: Array<{
    path?: string | RegExp;
    handler: (req: MockRequest, res: MockResponse, next?: () => void) => void;
  }> = [];

  settings: Record<string, any> = {
    env: "test",
    "x-powered-by": true,
  };

  locals: Record<string, any> = {};

  engines: Record<string, any> = {};

  // HTTP method handlers
  get(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    return this.addRoute("GET", path, handlers);
  }

  post(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    return this.addRoute("POST", path, handlers);
  }

  put(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    return this.addRoute("PUT", path, handlers);
  }

  delete(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    return this.addRoute("DELETE", path, handlers);
  }

  patch(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    return this.addRoute("PATCH", path, handlers);
  }

  all(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    return this.addRoute("ALL", path, handlers);
  }

  private addRoute(method: string, path: string | RegExp, handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    this.routes.push({ method, path, handlers });
    return this;
  }

  // Middleware
  use(path: string | ((req: MockRequest, res: MockResponse, next?: () => void) => void), handler?: (req: MockRequest, res: MockResponse, next?: () => void) => void): this {
    if (typeof path === "function") {
      this.middlewares.push({ handler: path });
    } else if (handler) {
      this.middlewares.push({ path, handler });
    }
    return this;
  }

  // Route handler
  route(path: string | RegExp): {
    get: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    post: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    put: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    delete: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    patch: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    all: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
  } {
    const self = this;
    return {
      get: (...handlers) => self.addRoute("GET", path, handlers),
      post: (...handlers) => self.addRoute("POST", path, handlers),
      put: (...handlers) => self.addRoute("PUT", path, handlers),
      delete: (...handlers) => self.addRoute("DELETE", path, handlers),
      patch: (...handlers) => self.addRoute("PATCH", path, handlers),
      all: (...handlers) => self.addRoute("ALL", path, handlers),
    };
  }

  // Settings - use different method names to avoid conflict with HTTP get
  setSetting(name: string, value: any): this {
    this.settings[name] = value;
    return this;
  }

  getSetting(name: string): any {
    return this.settings[name];
  }

  enable(name: string): this {
    this.settings[name] = true;
    return this;
  }

  disable(name: string): this {
    this.settings[name] = false;
    return this;
  }

  enabled(name: string): boolean {
    return !!this.settings[name];
  }

  disabled(name: string): boolean {
    return !this.settings[name];
  }

  // Engine registration
  engine(ext: string, fn: any): this {
    this.engines[ext] = fn;
    return this;
  }

  // Path helpers
  path(): string {
    return "";
  }

  // Listen (mock)
  listen(port: number | string, ...args: any[]): any {
    const callback = args.find((arg) => typeof arg === "function");
    setTimeout(() => callback?.(), 10);
    return { close: (cb?: () => void) => cb?.() };
  }

  // Handle request (for testing)
  handleRequest(req: MockRequest, res: MockResponse): void {
    // Run middlewares
    let index = 0;

    const next = (err?: Error) => {
      if (err) {
        res.statusCode = 500;
        res.send(err.message);
        return;
      }

      // Find matching route
      const route = this.routes.find(
        (r) =>
          (r.method === "ALL" || r.method === req.method) &&
          (typeof r.path === "string" ? r.path === req.path : r.path.test(req.path)),
      );

      if (route) {
        let handlerIndex = 0;
        const runHandler = () => {
          const handler = route.handlers[handlerIndex++];
          if (handler) {
            handler(req, res, runHandler);
          } else {
            if (!res.isEnded()) {
              res.status(404).send("Not Found");
            }
          }
        };
        runHandler();
      } else {
        if (!res.isEnded()) {
          res.status(404).send("Not Found");
        }
      }
    };

    next();
  }
}

/**
 * Mock Router class for testing.
 */
export class MockRouter {
  private routes: Array<{
    method: string;
    path: string | RegExp;
    handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>;
  }> = [];

  private middlewares: Array<{
    path?: string | RegExp;
    handler: (req: MockRequest, res: MockResponse, next?: () => void) => void;
  }> = [];

  get(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    this.routes.push({ method: "GET", path, handlers });
    return this;
  }

  post(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    this.routes.push({ method: "POST", path, handlers });
    return this;
  }

  put(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    this.routes.push({ method: "PUT", path, handlers });
    return this;
  }

  delete(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    this.routes.push({ method: "DELETE", path, handlers });
    return this;
  }

  patch(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    this.routes.push({ method: "PATCH", path, handlers });
    return this;
  }

  all(path: string | RegExp, ...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>): this {
    this.routes.push({ method: "ALL", path, handlers });
    return this;
  }

  use(path: string | ((req: MockRequest, res: MockResponse, next?: () => void) => void), handler?: (req: MockRequest, res: MockResponse, next?: () => void) => void): this {
    if (typeof path === "function") {
      this.middlewares.push({ handler: path });
    } else if (handler) {
      this.middlewares.push({ path, handler });
    }
    return this;
  }

  route(path: string | RegExp): {
    get: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    post: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    put: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    delete: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    patch: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
    all: (...handlers: Array<(req: MockRequest, res: MockResponse, next?: () => void) => void>) => any;
  } {
    const self = this;
    return {
      get: (...handlers) => {
        self.routes.push({ method: "GET", path, handlers });
        return self;
      },
      post: (...handlers) => {
        self.routes.push({ method: "POST", path, handlers });
        return self;
      },
      put: (...handlers) => {
        self.routes.push({ method: "PUT", path, handlers });
        return self;
      },
      delete: (...handlers) => {
        self.routes.push({ method: "DELETE", path, handlers });
        return self;
      },
      patch: (...handlers) => {
        self.routes.push({ method: "PATCH", path, handlers });
        return self;
      },
      all: (...handlers) => {
        self.routes.push({ method: "ALL", path, handlers });
        return self;
      },
    };
  }

  // Merge params
  mergeParams = false;
  caseSensitive = false;
  strict = false;
}

/**
 * Creates a mock Express application.
 */
export function createMockApplication(): MockApplication {
  return new MockApplication();
}

/**
 * Creates a mock Express router.
 */
export function createMockRouter(options?: { caseSensitive?: boolean; strict?: boolean }): MockRouter {
  const router = new MockRouter();
  if (options?.caseSensitive !== undefined) {
    router.caseSensitive = options.caseSensitive;
  }
  if (options?.strict !== undefined) {
    router.strict = options.strict;
  }
  return router;
}

/**
 * Mock express module.
 */
const express = Object.assign(
  function createApp(): MockApplication {
    return new MockApplication();
  },
  {
    application: MockApplication,
    Application: MockApplication,
    Router: MockRouter,

    // Static mock
    static: (root: string, options?: any) => {
      return (req: MockRequest, res: MockResponse, next: () => void) => {
        next();
      };
    },

    // json body parser mock
    json: (options?: any) => {
      return (req: MockRequest, res: MockResponse, next: () => void) => {
        if (!req.body) {
          req.body = {};
        }
        next();
      };
    },

    // urlencoded body parser mock
    urlencoded: (options?: any) => {
      return (req: MockRequest, res: MockResponse, next: () => void) => {
        if (!req.body) {
          req.body = {};
        }
        next();
      };
    },

    // text body parser mock
    text: (options?: any) => {
      return (req: MockRequest, res: MockResponse, next: () => void) => {
        next();
      };
    },

    // raw body parser mock
    raw: (options?: any) => {
      return (req: MockRequest, res: MockResponse, next: () => void) => {
        next();
      };
    },

    // query parser mock
    query: (options?: any) => {
      return (req: MockRequest, res: MockResponse, next: () => void) => {
        next();
      };
    },
  },
);

// http.STATUS_CODES mock
const http = {
  STATUS_CODES: {
    100: "Continue",
    101: "Switching Protocols",
    200: "OK",
    201: "Created",
    202: "Accepted",
    204: "No Content",
    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Found",
    304: "Not Modified",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    413: "Payload Too Large",
    414: "URI Too Long",
    415: "Unsupported Media Type",
    429: "Too Many Requests",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  },
};

// mime mock
const mime = {
  getType: (ext: string): string | null => {
    const types: Record<string, string> = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".txt": "text/plain",
      ".xml": "application/xml",
      ".pdf": "application/pdf",
    };
    return types[ext] ?? null;
  },
};

export default express;
export { express, http, mime };
