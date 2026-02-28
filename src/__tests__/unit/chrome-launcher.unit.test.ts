import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { mockFileSystem } from "../__mocks__/fs";
import {
  getChromeWebSocketUrl,
  isChromeReachable,
  launchOpenClawChrome,
  resolveOpenClawUserDataDir,
  stopOpenClawChrome,
} from "../../browser/chrome";
import { DEFAULT_OPENCLAW_BROWSER_COLOR, DEFAULT_OPENCLAW_BROWSER_PROFILE_NAME } from "../../browser/constants";

// Mock child_process
const mockSpawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual("node:child_process");
  return {
    ...(actual as object),
    spawn: mockSpawn,
  };
});

// Mock os
vi.mock("node:os", async () => {
  const actual = await vi.importActual("node:os");
  return {
    ...(actual as object),
    homedir: vi.fn(() => "/home/testuser"),
  };
});

// Mock chrome.executables
vi.mock("../../browser/chrome.executables.js", async () => {
  return {
    resolveBrowserExecutableForPlatform: vi.fn(() => ({
      path: "/usr/bin/google-chrome",
      kind: "chrome" as const,
    })),
  };
});

// Mock chrome.profile-decoration
vi.mock("../../browser/chrome.profile-decoration.js", async () => {
  return {
    decorateOpenClawProfile: vi.fn(),
    ensureProfileCleanExit: vi.fn(),
    isProfileDecorated: vi.fn(() => true),
  };
});

// Mock ports
vi.mock("../../infra/ports.js", async () => {
  return {
    ensurePortAvailable: vi.fn(),
  };
});

// Mock utils for CONFIG_DIR
vi.mock("../../utils.js", async () => {
  return {
    CONFIG_DIR: "/tmp/test-config",
  };
});

// Mock logging
vi.mock("../../logging/subsystem.js", async () => {
  return {
    createSubsystemLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      exception: vi.fn(),
    })),
  };
});

// Mock cdp helpers
vi.mock("../../browser/cdp.helpers.js", async () => {
  const actual = await vi.importActual("../../browser/cdp.helpers.js");
  return {
    ...(actual as object),
    appendCdpPath: vi.fn((base, path) => `${base}${path}`),
    getHeadersWithAuth: vi.fn(() => ({})),
  };
});

describe("chrome launcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileSystem.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveOpenClawUserDataDir", () => {
    it("returns default profile path", () => {
      const result = resolveOpenClawUserDataDir();
      expect(result).toBe("/tmp/test-config/browser/default/user-data");
    });

    it("returns custom profile path", () => {
      const result = resolveOpenClawUserDataDir("myprofile");
      expect(result).toBe("/tmp/test-config/browser/myprofile/user-data");
    });
  });

  describe("isChromeReachable", () => {
    it("returns true when Chrome is reachable", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ webSocketDebuggerUrl: "ws://localhost:9222/devtools" }), {
          status: 200,
        }) as any,
      );

      const result = await isChromeReachable("http://127.0.0.1:9222");
      expect(result).toBe(true);
    });

    it("returns false when Chrome is unreachable", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await isChromeReachable("http://127.0.0.1:9222");
      expect(result).toBe(false);
    });

    it("uses default timeout of 500ms", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }) as any,
      );

      await isChromeReachable("http://127.0.0.1:9222");

      expect(mockFetch).toHaveBeenCalled();
    });

    it("supports custom timeout", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Timeout"));

      const result = await isChromeReachable("http://127.0.0.1:9222", 1000);
      expect(result).toBe(false);
    });

    it("handles network errors gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

      const result = await isChromeReachable("http://127.0.0.1:9222");
      expect(result).toBe(false);
    });

    it("handles invalid URL gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Invalid URL"));

      const result = await isChromeReachable("invalid-url");
      expect(result).toBe(false);
    });
  });

  describe("getChromeWebSocketUrl", () => {
    it("extracts valid WebSocket URL", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc123" }),
          { status: 200 },
        ) as any,
      );

      const result = await getChromeWebSocketUrl("http://127.0.0.1:9222");
      expect(result).toBe("ws://127.0.0.1:9222/devtools/browser/abc123");
    });

    it("returns null when WebSocket URL is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ Browser: "Chrome/120.0.0.0" }), { status: 200 }) as any,
      );

      const result = await getChromeWebSocketUrl("http://127.0.0.1:9222");
      expect(result).toBe(null);
    });

    it("handles timeout gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Timeout"));

      const result = await getChromeWebSocketUrl("http://127.0.0.1:9222", 100);
      expect(result).toBe(null);
    });

    it("handles network errors gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await getChromeWebSocketUrl("http://127.0.0.1:9222");
      expect(result).toBe(null);
    });

    it("handles invalid response format", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(null), { status: 200 }) as any,
      );

      const result = await getChromeWebSocketUrl("http://127.0.0.1:9222");
      expect(result).toBe(null);
    });

    it("handles non-200 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 }) as any,
      );

      const result = await getChromeWebSocketUrl("http://127.0.0.1:9222");
      expect(result).toBe(null);
    });
  });

  describe("launchOpenClawChrome", () => {
    const defaultConfig = {
      headless: false,
      viewport: { width: 1920, height: 1080 },
      noSandbox: false,
    };

    const defaultProfile = {
      name: DEFAULT_OPENCLAW_BROWSER_PROFILE_NAME,
      cdpPort: 9222,
      cdpUrl: "http://127.0.0.1:9222",
      cdpIsLoopback: true,
      driver: "local" as const,
      color: DEFAULT_OPENCLAW_BROWSER_COLOR,
    };

    const createMockProc = (exitCode: number | null = 0) => {
      const proc = new EventEmitter() as ChildProcessWithoutNullStreams;
      proc.pid = 12345;
      proc.killed = false;
      proc.exitCode = exitCode;
      proc.stdin = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = vi.fn(() => true);
      return proc;
    };

    beforeEach(() => {
      mockFileSystem.mkdirSync("/tmp/test-config/browser/default/user-data", { recursive: true });
      mockFileSystem.mkdirSync("/tmp/test-config/browser/default/user-data/Default", { recursive: true });
      mockFileSystem.writeFileSync(
        "/tmp/test-config/browser/default/user-data/Local State",
        JSON.stringify({}),
      );
      mockFileSystem.writeFileSync(
        "/tmp/test-config/browser/default/user-data/Default/Preferences",
        JSON.stringify({}),
      );
    });

    it("rejects remote profiles (not loopback)", async () => {
      const remoteProfile = { ...defaultProfile, cdpIsLoopback: false };

      await expect(launchOpenClawChrome(defaultConfig, remoteProfile)).rejects.toThrow(
        'Profile "default" is remote; cannot launch local Chrome.',
      );
    });

    it("throws when no browser executable found", async () => {
      const { resolveBrowserExecutableForPlatform } = await import(
        "../../browser/chrome.executables.js"
      );
      vi.mocked(resolveBrowserExecutableForPlatform).mockReturnValueOnce(null);

      await expect(launchOpenClawChrome(defaultConfig, defaultProfile)).rejects.toThrow(
        "No supported browser found",
      );
    });
  });

  describe("stopOpenClawChrome", () => {
    const createRunningChrome = () => {
      const proc = new EventEmitter() as ChildProcessWithoutNullStreams;
      proc.pid = 12345;
      proc.killed = false;
      proc.exitCode = null;
      proc.stdin = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = vi.fn(() => {
        proc.killed = true;
        proc.exitCode = 0;
        proc.emit("exit", 0);
        return true;
      });

      return {
        pid: 12345,
        exe: { path: "/usr/bin/google-chrome", kind: "chrome" as const },
        userDataDir: "/tmp/test-config/browser/default/user-data",
        cdpPort: 9222,
        startedAt: Date.now(),
        proc,
      };
    };

    it("kills process with SIGTERM", async () => {
      const running = createRunningChrome();

      await stopOpenClawChrome(running);

      expect(running.proc.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("handles already killed process", async () => {
      const running = createRunningChrome();
      running.proc.killed = true;

      await stopOpenClawChrome(running);

      expect(running.proc.kill).not.toHaveBeenCalled();
    });
  });
});
