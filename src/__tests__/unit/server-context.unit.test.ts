import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createBrowserRouteContext } from "../../browser/server-context.js";

describe("server-context: createBrowserRouteContext", () => {
  let mockState: any;
  let getStateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockState = {
      server: { close: vi.fn() },
      port: 4000,
      resolved: {
        enabled: true,
        controlPort: 4000,
        headless: true,
        evaluateEnabled: true,
        viewport: { width: 1280, height: 720 },
        profiles: {
          default: {
            name: "default",
            cdpPort: 9222,
            cdpUrl: "http://127.0.0.1:9222",
            cdpIsLoopback: true,
            driver: "chrome" as const,
            color: "blue",
          },
        },
      },
      profiles: new Map(),
    };
    getStateMock = vi.fn(() => mockState);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("state()", () => {
    it("should return state when server is started", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      expect(ctx.state()).toBe(mockState);
    });

    it("should throw error when server is not started", () => {
      getStateMock.mockReturnValue(null);
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      expect(() => ctx.state()).toThrow("Server not started");
    });
  });

  describe("forProfile()", () => {
    it("should throw error when server is not started", () => {
      getStateMock.mockReturnValue(null);
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      expect(() => ctx.forProfile("default")).toThrow("Server not started");
    });

    it("should throw error for unknown profile", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      expect(() => ctx.forProfile("unknown")).toThrow("Profile unknown not found");
    });

    it("should create profile context for valid profile", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const profileCtx = ctx.forProfile("default");
      
      expect(profileCtx).toBeDefined();
      expect(profileCtx.profile).toBeDefined();
      expect(profileCtx.profile.name).toBe("default");
      expect(profileCtx.profile.cdpPort).toBe(9222);
    });

    it("should have ensureTabAvailable method", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const profileCtx = ctx.forProfile("default");
      
      expect(typeof profileCtx.ensureTabAvailable).toBe("function");
    });

    it("should have stopRunningBrowser method", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const profileCtx = ctx.forProfile("default");
      
      expect(typeof profileCtx.stopRunningBrowser).toBe("function");
    });
  });

  describe("mapTabError()", () => {
    it("should map 'tab not found' error to 404", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("tab not found"));
      
      expect(result).toEqual({
        status: 404,
        message: "Tab not found or closed",
      });
    });

    it("should map 'Target closed' error to 404", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("Target closed"));
      
      expect(result).toEqual({
        status: 404,
        message: "Tab not found or closed",
      });
    });

    it("should map ECONNREFUSED error to 503", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("ECONNREFUSED"));
      
      expect(result).toEqual({
        status: 503,
        message: "Browser CDP unavailable. Retry in a few seconds.",
      });
    });

    it("should map connectOverCDP error to 503", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("connectOverCDP failed"));
      
      expect(result).toEqual({
        status: 503,
        message: "Browser CDP unavailable. Retry in a few seconds.",
      });
    });

    it("should map 'not found or not visible' error to 409", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("Element not found or not visible"));
      
      expect(result).toEqual({
        status: 409,
        message: "Reference became stale after page update. Take a new snapshot and retry.",
      });
    });

    it("should map 'Run a new snapshot' error to 409", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("Run a new snapshot to see current page elements"));
      
      expect(result).toEqual({
        status: 409,
        message: "Reference became stale after page update. Take a new snapshot and retry.",
      });
    });

    it("should map Timeout error to 408", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("Timeout 5000ms"));
      
      expect(result).toEqual({
        status: 408,
        message: "Browser action timed out",
      });
    });

    it("should map TimeoutError to 408", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("TimeoutError: waiting for element"));
      
      expect(result).toEqual({
        status: 408,
        message: "Browser action timed out",
      });
    });

    it("should return null for unmapped errors", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError(new Error("Some other error"));
      
      expect(result).toBeNull();
    });

    it("should handle non-Error objects", () => {
      const ctx = createBrowserRouteContext({ getState: getStateMock });
      const result = ctx.mapTabError("string error");
      
      expect(result).toBeNull();
    });
  });
});
