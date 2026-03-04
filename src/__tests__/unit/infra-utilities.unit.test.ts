import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatErrorMessage } from "../../shared/errors/error.utils.js";
import { isPortAvailable, ensurePortAvailable } from "../../shared/utils/ports.js";
import { rawDataToString } from "../../shared/utils/ws.js";
import { Buffer } from "node:buffer";

describe("shared errors - formatErrorMessage", () => {
  it("should return message from Error object", () => {
    const err = new Error("test error message");
    expect(formatErrorMessage(err)).toBe("test error message");
  });

  it("should convert string to string", () => {
    expect(formatErrorMessage("string error")).toBe("string error");
  });

  it("should convert number to string", () => {
    expect(formatErrorMessage(123)).toBe("123");
  });

  it("should convert object to string", () => {
    const obj = { message: "error" };
    expect(formatErrorMessage(obj)).toContain("[object Object]");
  });

  it("should handle null and undefined", () => {
    expect(formatErrorMessage(null)).toBe("null");
    expect(formatErrorMessage(undefined)).toBe("undefined");
  });
});

describe("shared utils ports - isPortAvailable", () => {
  it("should return true for available port", async () => {
    // Use a high port number that's likely available
    const result = await isPortAvailable(59999);
    expect(result).toBe(true);
  });

  it("should return false for port in use", async () => {
    const net = await import("node:net");
    const server = net.createServer();

    await new Promise<void>((resolve) => {
      server.listen(59998, () => resolve());
    });

    try {
      const result = await isPortAvailable(59998);
      expect(result).toBe(false);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it("should handle port 0 (system assigned)", async () => {
    const result = await isPortAvailable(0);
    expect(result).toBe(true);
  });
});

describe("shared utils ports - ensurePortAvailable", () => {
  it("should resolve for available port", async () => {
    await expect(ensurePortAvailable(59997)).resolves.toBeUndefined();
  });

  it("should throw for unavailable port", async () => {
    const net = await import("node:net");
    const server = net.createServer();

    await new Promise<void>((resolve) => {
      server.listen(59996, () => resolve());
    });

    try {
      // New implementation throws for unavailable ports
      await expect(ensurePortAvailable(59996)).rejects.toThrow("Port 59996 is already in use");
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});

describe("shared utils ws - rawDataToString", () => {
  it("should return string as-is", () => {
    expect(rawDataToString("hello" as any)).toBe("hello");
  });

  it("should convert Buffer to string", () => {
    const buffer = Buffer.from("hello buffer", "utf8");
    expect(rawDataToString(buffer)).toBe("hello buffer");
  });

  it("should convert array of buffers to string", () => {
    const buffers = [Buffer.from("hello"), Buffer.from(" world")];
    expect(rawDataToString(buffers)).toBe("hello world");
  });

  it("should convert ArrayBuffer to string", () => {
    const arrayBuffer = new TextEncoder().encode("array buffer test").buffer;
    expect(rawDataToString(arrayBuffer)).toBe("array buffer test");
  });

  it("should convert other types using String()", () => {
    expect(rawDataToString(123 as any)).toBe("123");
    expect(rawDataToString({} as any)).toBe("[object Object]");
    expect(rawDataToString(null as any)).toBe("null");
  });

  it("should use custom encoding", () => {
    const buffer = Buffer.from("68656c6c6f", "hex");
    expect(rawDataToString(buffer, "hex" as any)).toBe("68656c6c6f");
  });
});
