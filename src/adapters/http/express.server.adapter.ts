import type { Server } from 'node:http';
import express, { type Application, type RequestHandler } from 'express';
import { createSubsystemLogger } from '../logging/logger.adapter.js';

const log = createSubsystemLogger('express-server');

/**
 * Options for the Express server.
 */
export type ExpressServerOptions = {
  port: number;
  host?: string;
  jsonLimit?: string;
};

/**
 * Express server adapter.
 * 
 * Provides HTTP server functionality using Express.
 */
export class ExpressServerAdapter {
  private server: Server | null = null;
  private app: Application;

  constructor() {
    this.app = express();
  }

  /**
   * Configure JSON body parser with custom limit.
   */
  useJsonParser(limit: string = '50mb'): void {
    this.app.use(express.json({ limit }));
  }

  /**
   * Use Express middleware.
   */
  use(middleware: RequestHandler): void {
    this.app.use(middleware);
  }

  /**
   * Register a GET route.
   */
  get(path: string, handler: RequestHandler): void {
    this.app.get(path, handler);
  }

  /**
   * Register a POST route.
   */
  post(path: string, handler: RequestHandler): void {
    this.app.post(path, handler);
  }

  /**
   * Register a PUT route.
   */
  put(path: string, handler: RequestHandler): void {
    this.app.put(path, handler);
  }

  /**
   * Register a DELETE route.
   */
  delete(path: string, handler: RequestHandler): void {
    this.app.delete(path, handler);
  }

  /**
   * Register a PATCH route.
   */
  patch(path: string, handler: RequestHandler): void {
    this.app.patch(path, handler);
  }

  /**
   * Start the server.
   */
  async start(options: ExpressServerOptions): Promise<{ port: number; server: Server }> {
    const { port, host = '127.0.0.1', jsonLimit = '50mb' } = options;

    // Configure JSON parser
    this.useJsonParser(jsonLimit);

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, host, () => {
        log.info('server started', { port, host });
        resolve({ port, server: this.server! });
      });

      this.server!.once('error', (err) => {
        log.exception('server failed to start', err, { port, host });
        reject(err);
      });
    });
  }

  /**
   * Stop the server.
   */
  async stop(): Promise<void> {
    if (this.server) {
      log.info('stopping server');

      await new Promise<void>((resolve) => {
        this.server?.close(() => {
          log.info('server stopped');
          resolve();
        });
      });

      this.server = null;
    } else {
      log.warn('server not running');
    }
  }

  /**
   * Get the Express application instance.
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get the underlying HTTP server.
   */
  getServer(): Server | null {
    return this.server;
  }

  /**
   * Check if the server is running.
   */
  isRunning(): boolean {
    return this.server?.listening ?? false;
  }

  /**
   * Get the server address.
   */
  address(): { port: number; family: string; address: string } | null {
    if (!this.server) {
      return null;
    }

    const addr = this.server.address();
    if (typeof addr === 'string') {
      return null;
    }

    return addr;
  }
}

/**
 * Create a logging middleware for Express.
 */
export function createLoggingMiddleware(): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      log.info('request completed', {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: Date.now() - start,
      });
    });

    next();
  };
}

/**
 * Create a CORS middleware for Express.
 */
export function createCorsMiddleware(options?: {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
}): RequestHandler {
  const {
    allowedOrigins = ['*'],
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
  } = options ?? {};

  return (req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  };
}

/**
 * Create a request logging middleware with correlation ID support.
 */
export function createRequestLoggingMiddleware(options?: {
  correlationIdHeader?: string;
  logBody?: boolean;
}): RequestHandler {
  const { correlationIdHeader = 'x-correlation-id', logBody = false } = options ?? {};

  return (req, res, next) => {
    const start = Date.now();
    const correlationId = req.headers[correlationIdHeader.toLowerCase()] as string | undefined;

    if (correlationId) {
      res.setHeader(correlationIdHeader, correlationId);
    }

    log.info('request started', {
      method: req.method,
      path: req.path,
      query: req.query,
      ...(logBody && req.body ? { body: req.body } : {}),
    });

    res.on('finish', () => {
      log.info('request completed', {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: Date.now() - start,
      });
    });

    next();
  };
}
