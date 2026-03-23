import { describe, expect, it } from "vitest";
import {
  buildRoleSnapshotFromAiSnapshot,
  buildRoleSnapshotFromAriaSnapshot,
  getRoleSnapshotStats,
  parseRoleRef,
} from "../../browser/pw-role-snapshot.js";

describe("pw-role-snapshot", () => {
  it("parses refs in multiple formats", () => {
    expect(parseRoleRef("e12")).toBe("e12");
    expect(parseRoleRef("@e3")).toBe("e3");
    expect(parseRoleRef("ref=e9")).toBe("e9");
    expect(parseRoleRef("bad")).toBeNull();
  });

  it("builds aria role snapshot and tracks duplicate nth", () => {
    const snapshot = [
      '- button "Save"',
      '- button "Save"',
      '- heading "Profile"',
    ].join("\n");

    const out = buildRoleSnapshotFromAriaSnapshot(snapshot);
    expect(out.snapshot).toContain("[ref=e1]");
    expect(Object.keys(out.refs)).toHaveLength(3);
    expect(Object.values(out.refs).some((r) => r.nth === 1)).toBe(true);
  });

  it("supports interactive-only AI snapshot mode", () => {
    const ai = [
      '- heading "Title" [ref=e1]',
      '- button "Go" [ref=e2]',
      '- link "Docs" [ref=e3]',
    ].join("\n");

    const out = buildRoleSnapshotFromAiSnapshot(ai, { interactive: true });
    expect(out.snapshot).not.toContain("heading");
    expect(Object.keys(out.refs).sort()).toEqual(["e2", "e3"]);
  });

  it("computes snapshot stats", () => {
    const result = buildRoleSnapshotFromAiSnapshot('- button "Go" [ref=e2]');
    const stats = getRoleSnapshotStats(result.snapshot, result.refs);

    expect(stats.lines).toBe(1);
    expect(stats.chars).toBeGreaterThan(1);
    expect(stats.refs).toBe(1);
    expect(stats.interactive).toBe(1);
  });
});
