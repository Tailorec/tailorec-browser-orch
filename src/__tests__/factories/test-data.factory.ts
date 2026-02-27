/**
 * Test data factories for creating consistent test data.
 * These factories help generate realistic test data with sensible defaults.
 */

/**
 * Generates a unique string using a timestamp and random suffix.
 */
export function generateUniqueString(prefix = "test"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generates a unique email address for testing.
 */
export function generateEmail(domain = "test.example.com"): string {
  return `user_${Date.now()}@${domain}`;
}

/**
 * Generates a unique URL for testing.
 */
export function generateUrl(path = "/"): string {
  return `https://example.test${path}`;
}

/**
 * Generates a correlation ID for testing.
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
}

/**
 * Generates a target ID for browser tab/page identification.
 */
export function generateTargetId(): string {
  return `target_${Math.random().toString(36).substring(2, 12)}`;
}

/**
 * Generates a CDP URL for testing.
 */
export function generateCdpUrl(port?: number): string {
  return `http://127.0.0.1:${port ?? 9222}`;
}

/**
 * Generates a WebSocket URL for testing.
 */
export function generateWebSocketUrl(port?: number): string {
  return `ws://127.0.0.1:${port ?? 9222}/devtools/browser/${generateTargetId()}`;
}

/**
 * Generates a ref string (e.g., "d1", "e2", "r3").
 */
export function generateRef(type: "d" | "e" | "r" = "d", index?: number): string {
  return `${type}${index ?? Math.floor(Math.random() * 100) + 1}`;
}

/**
 * Generates multiple ref strings.
 */
export function generateRefs(count: number, type?: "d" | "e" | "r"): string[] {
  return Array.from({ length: count }, (_, i) => generateRef(type, i + 1));
}

/**
 * Generates a timestamp in ISO format.
 */
export function generateTimestamp(date?: Date): string {
  return (date ?? new Date()).toISOString();
}

/**
 * Generates a file path for testing.
 */
export function generateFilePath(filename = "test.txt"): string {
  return `/tmp/test_${Date.now()}_${filename}`;
}

/**
 * Generates a base64 encoded string for testing.
 */
export function generateBase64(length = 100): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a JWT-like token for testing (not cryptographically valid).
 */
export function generateJwtToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: generateUniqueString("user"),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  const signature = generateBase64(32);
  return `${header}.${payload}.${signature}`;
}

/**
 * Generates a UUID-like string for testing.
 */
export function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates a random integer within a range.
 */
export function generateInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random float within a range.
 */
export function generateFloat(min: number, max: number, decimals = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

/**
 * Generates a random boolean.
 */
export function generateBoolean(): boolean {
  return Math.random() > 0.5;
}

/**
 * Generates a random array element.
 */
export function generateArrayElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a subset of an array.
 */
export function generateArraySubset<T>(arr: T[], minCount = 1, maxCount?: number): T[] {
  const count = generateInt(minCount, maxCount ?? arr.length);
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Generates a delay promise for testing async behavior.
 */
export function generateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a promise that rejects after a delay.
 */
export function generateRejection(ms: number, reason?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(reason ?? "Intentional rejection")), ms);
  });
}

/**
 * Generates a promise that resolves after a delay.
 */
export function generateDelayedValue<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}
