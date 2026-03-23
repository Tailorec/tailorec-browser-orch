import { describe, expect, it, vi } from "vitest";
import {
  handleRouteError,
  readBody,
  resolveProfileContext,
  SELECTOR_UNSUPPORTED_MESSAGE,
} from "../../browser/routes/agent.shared.js";

describe("unit: agent shared helpers", () => {
  it("readBody returns empty object for invalid body payloads", () => {
    expect(readBody({ body: null } as any)).toEqual({});
    expect(readBody({ body: "x" } as any)).toEqual({});
    expect(readBody({ body: [1, 2] } as any)).toEqual({});
  });

  it("readBody returns object payload as-is", () => {
    expect(readBody({ body: { kind: "click" } } as any)).toEqual({ kind: "click" });
  });

  it("handleRouteError maps known tab errors", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json } as any;

    const ctx = {
      mapTabError: () => ({ status: 404, message: "tab not found" }),
    } as any;

    handleRouteError(ctx, res, new Error("ignored"));

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ ok: false, error: "tab not found" });
  });

  it("resolveProfileContext writes 404 response when profile cannot be resolved", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json } as any;

    const ctx = {
      forProfile: () => {
        throw new Error("missing profile");
      },
    } as any;

    const result = resolveProfileContext({ query: { profile: "missing" } } as any, res, ctx);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ ok: false, error: "Error: missing profile" });
  });

  it("selector unsupported guidance stays stable", () => {
    expect(SELECTOR_UNSUPPORTED_MESSAGE).toContain("'selector' is not supported");
    expect(SELECTOR_UNSUPPORTED_MESSAGE).toContain("snapshot");
    expect(SELECTOR_UNSUPPORTED_MESSAGE).toContain("act with ref");
  });
});
