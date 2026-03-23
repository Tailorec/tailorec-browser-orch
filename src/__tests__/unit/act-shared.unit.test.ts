import { describe, expect, it } from "vitest";
import {
  ACT_KINDS,
  isActKind,
  parseClickButton,
  parseClickModifiers,
} from "../../browser/routes/agent.act.shared.js";

describe("agent.act.shared", () => {
  it("validates action kinds", () => {
    expect(ACT_KINDS.length).toBeGreaterThan(5);
    expect(isActKind("click")).toBe(true);
    expect(isActKind("unknown")).toBe(false);
    expect(isActKind(undefined)).toBe(false);
  });

  it("parses click button", () => {
    expect(parseClickButton("left")).toBe("left");
    expect(parseClickButton("middle")).toBe("middle");
    expect(parseClickButton("right")).toBe("right");
    expect(parseClickButton("bad")).toBeUndefined();
  });

  it("parses click modifiers and rejects invalid values", () => {
    expect(parseClickModifiers(["Alt", "Shift"]).modifiers).toEqual(["Alt", "Shift"]);
    expect(parseClickModifiers([])).toEqual({ modifiers: undefined });
    expect(parseClickModifiers(["Bad"]).error).toContain("modifiers must be");
  });
});
