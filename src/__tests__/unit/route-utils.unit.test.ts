import { describe, expect, it } from "vitest";
import {
  getProfileContext,
  toBoolean,
  toNumber,
  toStringArray,
  toStringOrEmpty,
} from "../../browser/routes/utils.js";

describe("route utils", () => {
  it("parses primitive helpers", () => {
    expect(toStringOrEmpty(" x ")).toBe("x");
    expect(toStringOrEmpty(10)).toBe("");

    expect(toBoolean(true)).toBe(true);
    expect(toBoolean("1")).toBe(true);
    expect(toBoolean("false")).toBe(false);
    expect(toBoolean("bad")).toBeUndefined();

    expect(toNumber("12")).toBe(12);
    expect(toNumber(8)).toBe(8);
    expect(toNumber("abc")).toBeUndefined();

    expect(toStringArray([1, "a"])).toEqual(["1", "a"]);
    expect(toStringArray("x")).toBeUndefined();
  });

  it("resolves default and explicit profile context", () => {
    const fakeCtx = {
      forProfile: (name: string) => ({ profile: { name } }),
    } as any;

    const defaultResult = getProfileContext({ query: {} } as any, fakeCtx);
    expect((defaultResult as any).profile.name).toBe("default");

    const customResult = getProfileContext({ query: { profile: "qa" } } as any, fakeCtx);
    expect((customResult as any).profile.name).toBe("qa");
  });

  it("returns error object when profile resolution fails", () => {
    const fakeCtx = {
      forProfile: () => {
        throw new Error("missing profile");
      },
    } as any;

    const result = getProfileContext({ query: { profile: "x" } } as any, fakeCtx);
    expect(result).toEqual({ status: 404, error: "Error: missing profile" });
  });
});
