import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  requireRef,
  normalizeTimeoutMs,
  toAIFriendlyError,
  bumpUploadArmId,
  bumpDialogArmId,
  bumpDownloadArmId,
} from "../../browser/pw-tools-core.shared.js";

describe("pw-tools-core.shared: bumpArmId functions", () => {
  it("should increment upload arm id", () => {
    const id1 = bumpUploadArmId();
    const id2 = bumpUploadArmId();
    expect(id2).toBe(id1 + 1);
  });

  it("should increment dialog arm id", () => {
    const id1 = bumpDialogArmId();
    const id2 = bumpDialogArmId();
    expect(id2).toBe(id1 + 1);
  });

  it("should increment download arm id", () => {
    const id1 = bumpDownloadArmId();
    const id2 = bumpDownloadArmId();
    expect(id2).toBe(id1 + 1);
  });
});

describe("pw-tools-core.shared: requireRef", () => {
  it("should return ref as-is when plain string", () => {
    expect(requireRef("e12")).toBe("e12");
  });

  it("should trim whitespace from ref", () => {
    expect(requireRef("  e12  ")).toBe("e12");
  });

  it("should strip @ prefix from ref", () => {
    expect(requireRef("@e12")).toBe("e12");
  });

  it("should strip ref= prefix from ref", () => {
    expect(requireRef("ref=e12")).toBe("e12");
  });

  it("should parse role ref format", () => {
    // Role refs like "button:Submit" should be parsed
    expect(requireRef("button:Submit")).toBe("button:Submit");
  });

  it("should throw error for empty string", () => {
    expect(() => requireRef("")).toThrow("ref is required");
  });

  it("should throw error for whitespace-only string", () => {
    expect(() => requireRef("   ")).toThrow("ref is required");
  });

  it("should throw error for non-string values", () => {
    expect(() => requireRef(null)).toThrow("ref is required");
    expect(() => requireRef(undefined)).toThrow("ref is required");
    expect(() => requireRef(123)).toThrow("ref is required");
    expect(() => requireRef({})).toThrow("ref is required");
  });
});

describe("pw-tools-core.shared: normalizeTimeoutMs", () => {
  it("should return provided timeout when valid", () => {
    expect(normalizeTimeoutMs(5000, 8000)).toBe(5000);
  });

  it("should return fallback when undefined", () => {
    expect(normalizeTimeoutMs(undefined, 8000)).toBe(8000);
  });

  it("should enforce minimum of 500ms", () => {
    expect(normalizeTimeoutMs(100, 8000)).toBe(500);
    expect(normalizeTimeoutMs(0, 8000)).toBe(500);
    expect(normalizeTimeoutMs(-100, 8000)).toBe(500);
  });

  it("should enforce maximum of 120000ms", () => {
    expect(normalizeTimeoutMs(200000, 8000)).toBe(120000);
    expect(normalizeTimeoutMs(150000, 8000)).toBe(120000);
  });

  it("should handle edge cases", () => {
    expect(normalizeTimeoutMs(500, 8000)).toBe(500);
    expect(normalizeTimeoutMs(120000, 8000)).toBe(120000);
  });
});

describe("pw-tools-core.shared: toAIFriendlyError", () => {
  it("should return original error message for generic errors", () => {
    const err = new Error("Something went wrong");
    const result = toAIFriendlyError(err, "e12");
    expect(result.message).toBe("Something went wrong");
    expect(result).toBeInstanceOf(Error);
  });

  it("should convert non-Error to Error", () => {
    const result = toAIFriendlyError("string error", "e12");
    expect(result.message).toBe("string error");
    expect(result).toBeInstanceOf(Error);
  });

  it("should handle strict mode violation with element count", () => {
    const err = new Error("strict mode violation: resolved to 3 elements");
    const result = toAIFriendlyError(err, "e12");
    expect(result.message).toContain('Selector "e12" matched 3 elements');
    expect(result.message).toContain("Run a new snapshot");
  });

  it("should handle timeout with visibility error", () => {
    const err = new Error("Timeout 5000ms waiting for e12 to be visible");
    const result = toAIFriendlyError(err, "e12");
    expect(result.message).toContain('Element "e12" not found or not visible');
    expect(result.message).toContain("Run a new snapshot");
  });

  it("should handle element not visible error", () => {
    const err = new Error("waiting for e12 to be visible, but it is not visible");
    const result = toAIFriendlyError(err, "e12");
    expect(result.message).toContain('Element "e12" not found or not visible');
  });

  it("should handle pointer events interception", () => {
    const err = new Error("element intercepts pointer events");
    const result = toAIFriendlyError(err, "e12");
    expect(result.message).toContain('Element "e12" is not interactable');
    expect(result.message).toContain("hidden or covered");
  });

  it("should handle element not receiving pointer events", () => {
    const err = new Error("element does not receive pointer events");
    const result = toAIFriendlyError(err, "e12");
    expect(result.message).toContain('Element "e12" is not interactable');
  });

  it("should preserve error object when no special case matches", () => {
    const err = new Error("custom error message");
    const result = toAIFriendlyError(err, "e12");
    expect(result.message).toBe("custom error message");
    expect(result).toBe(err);
  });
});
