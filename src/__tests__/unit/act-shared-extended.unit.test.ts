import { describe, it, expect } from "vitest";
import {
  ACT_KINDS,
  isActKind,
  parseClickButton,
  parseClickModifiers,
} from "../../browser/routes/agent.act.shared.js";

describe("agent.act.shared: ACT_KINDS", () => {
  it("should include all expected action kinds", () => {
    expect(ACT_KINDS).toContain("click");
    expect(ACT_KINDS).toContain("type");
    expect(ACT_KINDS).toContain("press");
    expect(ACT_KINDS).toContain("hover");
    expect(ACT_KINDS).toContain("fill");
    expect(ACT_KINDS).toContain("select");
    expect(ACT_KINDS).toContain("wait");
    expect(ACT_KINDS).toContain("navigate");
    expect(ACT_KINDS).toContain("evaluate");
    expect(ACT_KINDS).toContain("close");
    expect(ACT_KINDS).toContain("drag");
    expect(ACT_KINDS).toContain("scrollIntoView");
    expect(ACT_KINDS).toContain("resize");
    expect(ACT_KINDS).toContain("discover_dropdown");
    expect(ACT_KINDS).toContain("close_dropdown");
    expect(ACT_KINDS).toContain("query_state");
    expect(ACT_KINDS).toContain("detect_blocker");
    expect(ACT_KINDS).toContain("dismiss_blocker");
  });

  it("should be a readonly array", () => {
    expect(Array.isArray(ACT_KINDS)).toBe(true);
    expect(ACT_KINDS.length).toBeGreaterThan(10);
  });
});

describe("agent.act.shared: isActKind", () => {
  it("should return true for valid action kinds", () => {
    expect(isActKind("click")).toBe(true);
    expect(isActKind("type")).toBe(true);
    expect(isActKind("press")).toBe(true);
    expect(isActKind("hover")).toBe(true);
    expect(isActKind("fill")).toBe(true);
    expect(isActKind("wait")).toBe(true);
    expect(isActKind("navigate")).toBe(true);
  });

  it("should return false for invalid action kinds", () => {
    expect(isActKind("invalid")).toBe(false);
    expect(isActKind("unknown")).toBe(false);
    expect(isActKind("")).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isActKind(null)).toBe(false);
    expect(isActKind(undefined)).toBe(false);
    expect(isActKind(123)).toBe(false);
    expect(isActKind({})).toBe(false);
    expect(isActKind([])).toBe(false);
  });
});

describe("agent.act.shared: parseClickButton", () => {
  it("should return valid button values", () => {
    expect(parseClickButton("left")).toBe("left");
    expect(parseClickButton("right")).toBe("right");
    expect(parseClickButton("middle")).toBe("middle");
  });

  it("should return undefined for invalid button values", () => {
    expect(parseClickButton("invalid")).toBe(undefined);
    expect(parseClickButton("")).toBe(undefined);
    expect(parseClickButton("LEFT")).toBe(undefined);
    expect(parseClickButton("Left")).toBe(undefined);
  });

  it("should handle edge cases", () => {
    expect(parseClickButton("  left  ")).toBe(undefined);
    expect(parseClickButton("left ")).toBe(undefined);
  });
});

describe("agent.act.shared: parseClickModifiers", () => {
  it("should return valid modifiers", () => {
    const result = parseClickModifiers(["Alt", "Control", "Shift"]);
    expect(result.error).toBeUndefined();
    expect(result.modifiers).toEqual(["Alt", "Control", "Shift"]);
  });

  it("should return undefined modifiers for empty array", () => {
    const result = parseClickModifiers([]);
    expect(result.error).toBeUndefined();
    expect(result.modifiers).toBeUndefined();
  });

  it("should return error for invalid modifiers", () => {
    const result = parseClickModifiers(["Alt", "Invalid", "Shift"]);
    expect(result.error).toContain("must be Alt|Control|ControlOrMeta|Meta|Shift");
    expect(result.modifiers).toBeUndefined();
  });

  it("should accept all valid modifier types", () => {
    const result = parseClickModifiers(["ControlOrMeta", "Meta"]);
    expect(result.error).toBeUndefined();
    expect(result.modifiers).toEqual(["ControlOrMeta", "Meta"]);
  });

  it("should reject all invalid modifiers", () => {
    const result = parseClickModifiers(["Command", "Option", "Fn"]);
    expect(result.error).toContain("must be Alt|Control|ControlOrMeta|Meta|Shift");
  });

  it("should handle mixed valid and invalid modifiers", () => {
    const result = parseClickModifiers(["Alt", "Command"]);
    expect(result.error).toBeDefined();
  });
});
