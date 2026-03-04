/**
 * CDP Utilities
 *
 * Common utilities for Chrome DevTools Protocol communication.
 * Migrated from src/browser/cdp.helpers.ts and src/browser/cdp.ts
 */

import WebSocket from "ws";
import { Buffer } from "node:buffer";

/**
 * Check if host is a loopback address
 */
export function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h === "::1" ||
    h === "[::]" ||
    h === "::"
  );
}

/**
 * Get headers with authentication
 */
export function getHeadersWithAuth(url: string, headers: Record<string, string> = {}): Record<string, string> {
  const mergedHeaders = { ...headers };
  try {
    const parsed = new URL(url);
    const hasAuthHeader = Object.keys(mergedHeaders).some(
      (key) => key.toLowerCase() === "authorization",
    );
    if (hasAuthHeader) {
      return mergedHeaders;
    }
    if (parsed.username || parsed.password) {
      const auth = Buffer.from(`${parsed.username}:${parsed.password}`).toString("base64");
      return { ...mergedHeaders, Authorization: `Basic ${auth}` };
    }
  } catch {
    // ignore
  }
  return mergedHeaders;
}

/**
 * Append path to CDP URL
 */
export function appendCdpPath(cdpUrl: string, path: string): string {
  const url = new URL(cdpUrl);
  const basePath = url.pathname.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  url.pathname = `${basePath}${suffix}`;
  return url.toString();
}

/**
 * Fetch JSON from URL with timeout
 */
export async function fetchJson<T>(url: string, timeoutMs = 1500, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = getHeadersWithAuth(url, (init?.headers as Record<string, string>) || {});
    const res = await fetch(url, { ...init, headers, signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch URL and verify OK response
 */
export async function fetchOk(url: string, timeoutMs = 1500, init?: RequestInit): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = getHeadersWithAuth(url, (init?.headers as Record<string, string>) || {});
    const res = await fetch(url, { ...init, headers, signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(t);
  }
}

/**
 * CDP Response type
 */
type CdpResponse = {
  id: number;
  result?: unknown;
  error?: { message?: string };
};

/**
 * Pending CDP request
 */
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

/**
 * CDP send function type
 */
export type CdpSendFn = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

/**
 * Execute function over CDP WebSocket connection
 */
export async function withCdpSocket<T>(
  wsUrl: string,
  fn: (send: CdpSendFn) => Promise<T>,
  opts?: { headers?: Record<string, string> },
): Promise<T> {
  const headers = getHeadersWithAuth(wsUrl, opts?.headers ?? {});
  const ws = new WebSocket(wsUrl, {
    handshakeTimeout: 5000,
    ...(Object.keys(headers).length ? { headers } : {}),
  });

  let nextId = 1;
  const pending = new Map<number, PendingRequest>();

  const send: CdpSendFn = (method: string, params?: Record<string, unknown>) => {
    const id = nextId++;
    const msg = { id, method, params };
    ws.send(JSON.stringify(msg));
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  const closeWithError = (err: Error) => {
    for (const [, p] of pending) {
      p.reject(err);
    }
    pending.clear();
    try {
      ws.close();
    } catch {
      // ignore
    }
  };

  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString()) as CdpResponse;
      if (typeof parsed.id !== "number") {
        return;
      }
      const p = pending.get(parsed.id);
      if (!p) {
        return;
      }
      pending.delete(parsed.id);
      if (parsed.error?.message) {
        p.reject(new Error(parsed.error.message));
        return;
      }
      p.resolve(parsed.result);
    } catch {
      // ignore
    }
  });

  ws.on("close", () => {
    closeWithError(new Error("CDP socket closed"));
  });

  ws.on("error", (err) => {
    closeWithError(err);
  });

  const openPromise = new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", (err) => reject(err));
  });

  await openPromise;

  try {
    return await fn(send);
  } catch (err) {
    closeWithError(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Normalize CDP WebSocket URL
 */
export function normalizeCdpWsUrl(wsUrl: string, cdpUrl: string): string {
  const ws = new URL(wsUrl);
  const cdp = new URL(cdpUrl);
  if (isLoopbackHost(ws.hostname) && !isLoopbackHost(cdp.hostname)) {
    ws.hostname = cdp.hostname;
    const cdpPort = cdp.port || (cdp.protocol === "https:" ? "443" : "80");
    if (cdpPort) {
      ws.port = cdpPort;
    }
    ws.protocol = cdp.protocol === "https:" ? "wss:" : "ws:";
  }
  if (cdp.protocol === "https:" && ws.protocol === "ws:") {
    ws.protocol = "wss:";
  }
  if (!ws.username && !ws.password && (cdp.username || cdp.password)) {
    ws.username = cdp.username;
    ws.password = cdp.password;
  }
  for (const [key, value] of cdp.searchParams.entries()) {
    if (!ws.searchParams.has(key)) {
      ws.searchParams.append(key, value);
    }
  }
  return ws.toString();
}

/**
 * Normalize CDP URL (remove trailing /json/version if present)
 */
export function normalizeCdpUrl(cdpUrl: string): string {
  return cdpUrl.replace(/\/json\/version\/?$/, "").replace(/\/$/, "");
}

/**
 * Aria snapshot node type
 */
export type AriaSnapshotNode = {
  ref: string;
  role: string;
  name: string;
  value?: string;
  description?: string;
  backendDOMNodeId?: number;
  depth: number;
};

/**
 * Raw AX node type (from CDP Accessibility API)
 */
export type RawAXNode = {
  nodeId?: string;
  role?: { value?: string };
  name?: { value?: string };
  value?: { value?: string };
  description?: { value?: string };
  childIds?: string[];
  backendDOMNodeId?: number;
};

/**
 * Extract value from AX node property
 */
function axValue(v: unknown): string {
  if (!v || typeof v !== "object") {
    return "";
  }
  const value = (v as { value?: unknown }).value;
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/**
 * Format aria snapshot from raw AX nodes
 */
export function formatAriaSnapshot(nodes: RawAXNode[], limit: number): AriaSnapshotNode[] {
  const byId = new Map<string, RawAXNode>();
  for (const n of nodes) {
    if (n.nodeId) {
      byId.set(n.nodeId, n);
    }
  }

  // Heuristic: pick a root-ish node (one that is not referenced as a child), else first.
  const referenced = new Set<string>();
  for (const n of nodes) {
    for (const c of n.childIds ?? []) {
      referenced.add(c);
    }
  }
  const root = nodes.find((n) => n.nodeId && !referenced.has(n.nodeId)) ?? nodes[0];
  if (!root?.nodeId) {
    return [];
  }

  const out: AriaSnapshotNode[] = [];
  const stack: Array<{ id: string; depth: number }> = [{ id: root.nodeId, depth: 0 }];
  while (stack.length && out.length < limit) {
    const popped = stack.pop();
    if (!popped) {
      break;
    }
    const { id, depth } = popped;
    const n = byId.get(id);
    if (!n) {
      continue;
    }
    const role = axValue(n.role);
    const name = axValue(n.name);
    const value = axValue(n.value);
    const description = axValue(n.description);
    const ref = `ax${out.length + 1}`;
    out.push({
      ref,
      role: role || "unknown",
      name: name || "",
      ...(value ? { value } : {}),
      ...(description ? { description } : {}),
      ...(typeof n.backendDOMNodeId === "number" ? { backendDOMNodeId: n.backendDOMNodeId } : {}),
      depth,
    });

    const children = (n.childIds ?? []).filter((c) => byId.has(c));
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child) {
        stack.push({ id: child, depth: depth + 1 });
      }
    }
  }

  return out;
}
