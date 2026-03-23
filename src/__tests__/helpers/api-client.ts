import type { Agent } from "node:http";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ApiResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string | string[] | undefined>;
  body: T;
  rawBody: string;
  ok: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  agent?: Agent;
}

/**
 * API client for making HTTP requests to the browser control server.
 * Designed for use in integration and E2E tests.
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeoutMs: number;
  private agent?: Agent;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.agent = config.agent;
  }

  /**
   * Creates an ApiClient from a test server state.
   */
  static fromTestServer(state: { baseUrl: string; port: number }): ApiClient {
    return new ApiClient({ baseUrl: state.baseUrl });
  }

  /**
   * Performs a GET request.
   */
  async get<T = unknown>(
    path: string,
    options?: Omit<ApiRequestOptions, "method" | "path">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "GET", path, ...options });
  }

  /**
   * Performs a POST request.
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "path" | "body">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "POST", path, body, ...options });
  }

  /**
   * Performs a PUT request.
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "path" | "body">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "PUT", path, body, ...options });
  }

  /**
   * Performs a DELETE request.
   */
  async delete<T = unknown>(
    path: string,
    options?: Omit<ApiRequestOptions, "method" | "path">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "DELETE", path, ...options });
  }

  /**
   * Performs a PATCH request.
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "path" | "body">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "PATCH", path, body, ...options });
  }

  /**
   * Performs an HTTP request.
   */
  async request<T = unknown>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const {
      method = "GET",
      path,
      body,
      headers = {},
      timeoutMs = this.timeoutMs,
    } = options;

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
      ...headers,
    };

    const fetchOptions: RequestInit = {
      method,
      headers: fetchHeaders,
      signal: controller.signal,
    };

    if (body !== undefined && body !== null) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      const rawBody = await response.text();

      let parsedBody: T;
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : ({} as T);
      } catch {
        parsedBody = rawBody as unknown as T;
      }

      const responseHeaders: Record<string, string | string[] | undefined> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: parsedBody,
        rawBody,
        ok: response.ok,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Waits for an endpoint to be ready (returns 200).
   */
  async waitForReady(path = "/status", maxAttempts = 30, delayMs = 100): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await this.get(path);
        if (response.ok) {
          return;
        }
      } catch {
        // Ignore errors during startup
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Server did not become ready after ${maxAttempts} attempts`);
  }
}

/**
 * Convenience function to create an ApiClient.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
