import { randomBytes } from 'node:crypto';

/**
 * Auth header name for extension relay.
 */
export const RELAY_AUTH_HEADER = 'x-openclaw-relay-token';

/**
 * Check if a host is loopback.
 */
export function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '[::1]' ||
    h === '::1' ||
    h === '[::]' ||
    h === '::'
  );
}

/**
 * Check if an IP address is loopback.
 */
export function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) {
    return false;
  }
  if (ip === '127.0.0.1') {
    return true;
  }
  if (ip.startsWith('127.')) {
    return true;
  }
  if (ip === '::1') {
    return true;
  }
  if (ip.startsWith('::ffff:127.')) {
    return true;
  }
  return false;
}

/**
 * Parse a base URL into host, port, and baseUrl.
 */
export function parseBaseUrl(raw: string): {
  host: string;
  port: number;
  baseUrl: string;
} {
  const parsed = new URL(raw.trim().replace(/\/$/, ''));
  
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`extension relay cdpUrl must be http(s), got ${parsed.protocol}`);
  }
  
  const host = parsed.hostname;
  const port =
    parsed.port?.trim() !== '' ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`extension relay cdpUrl has invalid port: ${parsed.port || '(empty)'}`);
  }
  
  return { host, port, baseUrl: parsed.toString().replace(/\/$/, '') };
}

/**
 * Generate a random auth token.
 */
export function generateRelayAuthToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Get header value from array or string.
 */
export function headerValue(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Get a specific header from an incoming request.
 */
export function getHeader(req: { headers: Record<string, string | string[] | undefined> }, name: string): string | undefined {
  return headerValue(req.headers[name.toLowerCase()]);
}
