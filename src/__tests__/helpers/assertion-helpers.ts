import { expect } from "vitest";

/**
 * Common assertion helpers for browser control API tests.
 */

/**
 * Asserts that a response has a successful status code (2xx).
 */
export function assertSuccessStatus(status: number): void {
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(300);
}

/**
 * Asserts that a response has an error status code (4xx or 5xx).
 */
export function assertErrorStatus(status: number): void {
  expect(status).toBeGreaterThanOrEqual(400);
  expect(status).toBeLessThan(600);
}

/**
 * Asserts that a response has the expected status code.
 */
export function assertStatus(status: number, expected: number): void {
  expect(status).toBe(expected);
}

/**
 * Asserts that a response body matches the expected structure.
 */
export function assertResponseStructure<T extends Record<string, unknown>>(
  body: T,
  requiredKeys: Array<keyof T>,
): void {
  for (const key of requiredKeys) {
    expect(body).toHaveProperty(key as string);
  }
}

/**
 * Asserts that an error response has the expected structure.
 */
export function assertErrorResponse(body: unknown): void {
  expect(body).toBeDefined();
  expect(typeof body).toBe("object");

  const errorBody = body as Record<string, unknown>;
  expect(errorBody).toHaveProperty("error");
}

/**
 * Asserts that a snapshot response has the expected structure.
 */
export function assertSnapshotResponse(body: unknown): void {
  expect(body).toBeDefined();
  expect(typeof body).toBe("object");

  const snapshotBody = body as Record<string, unknown>;
  expect(snapshotBody).toHaveProperty("snapshot");
  expect(typeof snapshotBody.snapshot).toBe("string");
  expect(snapshotBody).toHaveProperty("refs");
  expect(Array.isArray(snapshotBody.refs)).toBe(true);
}

/**
 * Asserts that an act response has the expected structure.
 */
export function assertActResponse(body: unknown): void {
  expect(body).toBeDefined();
  expect(typeof body).toBe("object");

  const actBody = body as Record<string, unknown>;
  expect(actBody).toHaveProperty("success");
  expect(typeof actBody.success).toBe("boolean");
}

/**
 * Asserts that a screenshot response has the expected structure.
 */
export function assertScreenshotResponse(body: unknown): void {
  expect(body).toBeDefined();

  // Could be a string (base64) or an object with image property
  if (typeof body === "string") {
    expect(body.length).toBeGreaterThan(0);
  } else {
    expect(body).toHaveProperty("image");
  }
}

/**
 * Asserts that a response contains refs with expected format.
 */
export function assertRefsFormat(refs: unknown[]): void {
  expect(Array.isArray(refs)).toBe(true);

  for (const ref of refs) {
    expect(ref).toBeDefined();
    expect(typeof ref).toBe("object");

    const refObj = ref as Record<string, unknown>;
    expect(refObj).toHaveProperty("ref");
    expect(typeof refObj.ref).toBe("string");
    // ref should match pattern like "d1", "e1", "r1", etc.
    expect(refObj.ref).toMatch(/^[a-z]\d+$/i);
  }
}

/**
 * Asserts that a value is within a range.
 */
export function assertInRange(value: number, min: number, max: number): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Asserts that a value is approximately equal to expected (within tolerance).
 */
export function assertApproximatelyEqual(
  value: number,
  expected: number,
  tolerance: number = 0.01,
): void {
  expect(Math.abs(value - expected)).toBeLessThanOrEqual(tolerance * Math.abs(expected));
}

/**
 * Asserts that a function throws an error matching a pattern.
 */
export function assertThrowsWithPattern(
  fn: () => unknown,
  pattern: RegExp | string,
  message?: string,
): void {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (typeof pattern === "string") {
      expect(errorMessage).toContain(pattern);
    } else {
      expect(errorMessage).toMatch(pattern);
    }
  }
  expect(threw).toBe(true);
}

/**
 * Asserts that an async function rejects with an error matching a pattern.
 */
export async function assertRejectsWithPattern(
  fn: () => Promise<unknown>,
  pattern: RegExp | string,
  message?: string,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (typeof pattern === "string") {
      expect(errorMessage).toContain(pattern);
    } else {
      expect(errorMessage).toMatch(pattern);
    }
  }
  expect(threw).toBe(true);
}

/**
 * Asserts that a response has the expected correlation ID header.
 */
export function assertCorrelationIdHeader(
  headers: Record<string, string | string[] | undefined>,
  correlationId?: string,
): void {
  const headerName = (process.env.CORRELATION_ID_HEADER || "x-correlation-id").toLowerCase();
  const headerValue = headers[headerName];

  if (correlationId) {
    expect(headerValue).toBe(correlationId);
  } else {
    expect(headerValue).toBeDefined();
    expect(typeof headerValue).toBe("string");
    expect((headerValue as string).length).toBeGreaterThan(0);
  }
}

/**
 * Asserts that a response time is within acceptable bounds.
 */
export function assertResponseTime(durationMs: number, maxMs: number = 5000): void {
  expect(durationMs).toBeGreaterThanOrEqual(0);
  expect(durationMs).toBeLessThan(maxMs);
}

/**
 * Asserts that an array has the expected length.
 */
export function assertArrayLength<T>(arr: T[], expected: number | { min?: number; max?: number }): void {
  expect(Array.isArray(arr)).toBe(true);

  if (typeof expected === "number") {
    expect(arr.length).toBe(expected);
  } else {
    if (expected.min !== undefined) {
      expect(arr.length).toBeGreaterThanOrEqual(expected.min);
    }
    if (expected.max !== undefined) {
      expect(arr.length).toBeLessThanOrEqual(expected.max);
    }
  }
}

/**
 * Asserts that an object has only the specified keys (no extra keys).
 */
export function assertExactKeys<T extends object>(obj: T, keys: Array<keyof T>): void {
  expect(obj).toBeDefined();
  expect(typeof obj).toBe("object");

  const actualKeys = Object.keys(obj);
  const expectedKeys = keys.map(String);

  expect(actualKeys.sort()).toEqual(expectedKeys.sort());
}

/**
 * Asserts that a string matches a URL pattern.
 */
export function assertUrlFormat(url: string, options?: { protocol?: string; hostname?: string }): void {
  expect(url).toBeDefined();
  expect(typeof url).toBe("string");

  try {
    const parsed = new URL(url);
    if (options?.protocol) {
      expect(parsed.protocol).toBe(options.protocol);
    }
    if (options?.hostname) {
      expect(parsed.hostname).toBe(options.hostname);
    }
  } catch {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

/**
 * Asserts that a base64 string is valid.
 */
export function assertBase64Format(str: string): void {
  expect(str).toBeDefined();
  expect(typeof str).toBe("string");
  expect(str).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
}
