/**
 * WebSocket Utilities
 *
 * WebSocket helper functions.
 * Migrated from src/infra/ws.ts
 */

/**
 * Convert raw WebSocket data to string
 */
export function rawDataToString(data: any): string {
  if (typeof data === "string") {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (Array.isArray(data)) {
    // Handle array of buffers
    return Buffer.concat(data.map((d) => (Buffer.isBuffer(d) ? d : Buffer.from(d)))).toString("utf8");
  }
  return String(data);
}
