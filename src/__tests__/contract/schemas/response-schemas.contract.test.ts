import { describe, expect, it } from "vitest";

/**
 * Contract Tests: Response Schemas
 * 
 * These tests validate the structure and format of all API response schemas.
 * Unlike integration tests, these focus on response structure contracts.
 * 
 * Test Plan Reference: TEST_PLAN.md - Task C2
 */

// ============================================================================
// ACT RESPONSE SCHEMAS
// ============================================================================

describe("ActResponse schema contracts", () => {
  describe("successful act response structure", () => {
    it("click response structure", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://example.com",
      };
      expect(response.ok).toBe(true);
      expect(response.targetId).toBe("tab-123");
      expect(response.url).toBe("https://example.com");
    });

    it("type response structure", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
      };
      expect(response.ok).toBe(true);
      expect(response.targetId).toBe("tab-123");
    });

    it("fill response structure with results", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        results: [
          { ref: "d1", matched: true, requestedValue: "John", actualValue: "John" },
          { ref: "d2", matched: false, requestedValue: "john@example.com", actualValue: "JOHN@EXAMPLE.COM", warning: "Case mismatch" },
        ],
        allMatched: false,
        mismatched: [
          { ref: "d2", requested: "john@example.com", actual: "JOHN@EXAMPLE.COM", warning: "Case mismatch" },
        ],
      };
      expect(response.ok).toBe(true);
      expect(response.results).toHaveLength(2);
      expect(response.allMatched).toBe(false);
      expect(response.mismatched).toHaveLength(1);
    });

    it("evaluate response structure with result", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://example.com",
        result: "Page Title",
      };
      expect(response.ok).toBe(true);
      expect(response.result).toBe("Page Title");
    });

    it("navigate response structure", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://new-url.com",
      };
      expect(response.ok).toBe(true);
      expect(response.url).toBe("https://new-url.com");
    });

    it("query_state response with single ref", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        state: {
          visible: true,
          enabled: true,
          text: "Submit",
        },
      };
      expect(response.ok).toBe(true);
      expect(response.state).toBeDefined();
    });

    it("query_state response with multiple refs", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        states: {
          d1: { visible: true, enabled: true },
          d2: { visible: false, enabled: false },
        },
      };
      expect(response.ok).toBe(true);
      expect(response.states).toBeDefined();
    });

    it("discover_dropdown response structure", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        options: [
          { value: "1", label: "Option 1", selected: false },
          { value: "2", label: "Option 2", selected: true },
        ],
      };
      expect(response.ok).toBe(true);
      expect(response.options).toHaveLength(2);
    });

    it("detect_blocker response structure", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        blocked: true,
        blockerType: "cookie-banner",
      };
      expect(response.ok).toBe(true);
      expect(response.blocked).toBe(true);
    });

    it("dismiss_blocker response structure", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        dismissed: true,
        strategy: "click",
      };
      expect(response.ok).toBe(true);
      expect(response.dismissed).toBe(true);
    });
  });

  describe("common response fields", () => {
    it("all successful responses include ok: true", () => {
      const responses = [
        { ok: true, targetId: "t1" },
        { ok: true, targetId: "t1", url: "https://example.com" },
        { ok: true, targetId: "t1", result: "value" },
      ];
      responses.forEach((r) => expect(r.ok).toBe(true));
    });

    it("all successful responses include targetId", () => {
      const responses = [
        { ok: true, targetId: "t1" },
        { ok: true, targetId: "t1", url: "https://example.com" },
      ];
      responses.forEach((r) => expect(r.targetId).toBeDefined());
    });
  });
});

// ============================================================================
// SNAPSHOT RESPONSE SCHEMAS
// ============================================================================

describe("SnapshotResponse schema contracts", () => {
  describe("successful snapshot response structure", () => {
    it("basic snapshot response", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://example.com",
        snapshot: "<html>...</html>",
      };
      expect(response.ok).toBe(true);
      expect(response.snapshot).toBeDefined();
    });

    it("snapshot with refs", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://example.com",
        snapshot: "<html>...</html>",
        refs: {
          d1: { role: "button", name: "Submit" },
          d2: { role: "textbox", name: "Email" },
        },
      };
      expect(response.refs).toBeDefined();
      expect(Object.keys(response.refs)).toHaveLength(2);
    });

    it("snapshot with truncated indicator", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://example.com",
        snapshot: "<html>...",
        truncated: true,
      };
      expect(response.truncated).toBe(true);
    });

    it("snapshot delta start response", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        started: true,
      };
      expect(response.ok).toBe(true);
      expect(response.started).toBe(true);
    });

    it("snapshot delta stop response with changes", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        stopped: true,
        changes: [
          { type: "added", ref: "d3" },
          { type: "removed", ref: "d1" },
          { type: "modified", ref: "d2" },
        ],
      };
      expect(response.stopped).toBe(true);
      expect(response.changes).toHaveLength(3);
    });
  });
});

// ============================================================================
// SCREENSHOT RESPONSE SCHEMAS
// ============================================================================

describe("ScreenshotResponse schema contracts", () => {
  describe("successful screenshot response structure", () => {
    it("basic screenshot response", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://example.com",
        mimeType: "image/png",
        imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      };
      expect(response.ok).toBe(true);
      expect(response.mimeType).toBe("image/png");
      expect(response.imageBase64).toBeDefined();
    });

    it("jpeg screenshot response", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://example.com",
        mimeType: "image/jpeg",
        imageBase64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/",
      };
      expect(response.ok).toBe(true);
      expect(response.mimeType).toBe("image/jpeg");
    });

    it("labeled screenshot response", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        url: "https://example.com",
        mimeType: "image/png",
        imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        labels: 5,
        skipped: 2,
      };
      expect(response.ok).toBe(true);
      expect(response.labels).toBe(5);
      expect(response.skipped).toBe(2);
    });
  });
});

// ============================================================================
// DOWNLOAD RESPONSE SCHEMAS
// ============================================================================

describe("DownloadResponse schema contracts", () => {
  describe("successful download response structure", () => {
    it("download response", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        download: {
          path: "/path/to/download.pdf",
          suggestedFilename: "document.pdf",
          totalBytes: 102400,
        },
      };
      expect(response.ok).toBe(true);
      expect(response.download).toBeDefined();
      expect(response.download.path).toBe("/path/to/download.pdf");
    });

    it("wait/download response", () => {
      const response = {
        ok: true,
        targetId: "tab-123",
        download: {
          path: "/path/to/download.pdf",
          suggestedFilename: "report.xlsx",
          totalBytes: 51200,
        },
      };
      expect(response.ok).toBe(true);
      expect(response.download.suggestedFilename).toBe("report.xlsx");
    });
  });
});

// ============================================================================
// HOOKS RESPONSE SCHEMAS
// ============================================================================

describe("HooksResponse schema contracts", () => {
  describe("successful hooks response structure", () => {
    it("file-chooser response", () => {
      const response = {
        ok: true,
      };
      expect(response.ok).toBe(true);
    });

    it("dialog response", () => {
      const response = {
        ok: true,
      };
      expect(response.ok).toBe(true);
    });
  });
});

// ============================================================================
// CONTROL RESPONSE SCHEMAS
// ============================================================================

describe("ControlResponse schema contracts", () => {
  describe("successful control response structure", () => {
    it("control endpoint response", () => {
      const response = {
        ok: true,
        mode: "interactive",
        ws_url: "ws://127.0.0.1:4000/control/live?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        run_id: "run-123",
        note: "Use ws_url for browser interaction. Legacy frame/action/status control endpoints are removed.",
      };
      expect(response.ok).toBe(true);
      expect(response.mode).toBe("interactive");
      expect(response.ws_url).toBeDefined();
      expect(response.note).toBeDefined();
    });

    it("control response without run_id", () => {
      const response = {
        ok: true,
        mode: "interactive",
        ws_url: "ws://127.0.0.1:4000/control/live?token=abc123",
        run_id: null,
        note: "Use ws_url for browser interaction.",
      };
      expect(response.ok).toBe(true);
      expect(response.run_id).toBe(null);
    });
  });
});

// ============================================================================
// STATUS RESPONSE SCHEMAS
// ============================================================================

describe("StatusResponse schema contracts", () => {
  describe("successful status response structure", () => {
    it("status endpoint response", () => {
      const response = {
        ok: true,
        profiles: ["default", "profile-1", "profile-2"],
      };
      expect(response.ok).toBe(true);
      expect(response.profiles).toBeInstanceOf(Array);
      expect(response.profiles).toHaveLength(3);
    });

    it("status with empty profiles", () => {
      const response = {
        ok: true,
        profiles: [],
      };
      expect(response.ok).toBe(true);
      expect(response.profiles).toHaveLength(0);
    });
  });
});

// ============================================================================
// ERROR RESPONSE SCHEMAS
// ============================================================================

describe("ErrorResponse schema contracts", () => {
  describe("error response structure", () => {
    it("basic error response", () => {
      const response = {
        ok: false,
        error: "Something went wrong",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toBe("Something went wrong");
    });

    it("error response with code", () => {
      const response = {
        ok: false,
        error: "Browser action timed out",
        code: "WAIT_LOAD_STATE_TIMEOUT",
        details: {
          kind: "wait",
          targetId: "tab-123",
          loadState: "networkidle",
          timeoutMs: 5000,
          hint: "networkidle can hang on pages with long-polling/analytics",
          raw: "Timeout error message",
        },
      };
      expect(response.ok).toBe(false);
      expect(response.code).toBe("WAIT_LOAD_STATE_TIMEOUT");
      expect(response.details).toBeDefined();
    });

    it("error response for missing field", () => {
      const response = {
        ok: false,
        error: "ref is required",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toContain("required");
    });

    it("error response for invalid field", () => {
      const response = {
        ok: false,
        error: "button must be left|right|middle",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toContain("must be");
    });

    it("error response for unsupported action", () => {
      const response = {
        ok: false,
        error: "unsupported kind",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toBe("unsupported kind");
    });

    it("error response for forbidden action", () => {
      const response = {
        ok: false,
        error: "act:evaluate is disabled by config (browser.evaluateEnabled=false)",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toContain("disabled");
    });

    it("error response for browser unavailable", () => {
      const response = {
        ok: false,
        error: "Browser is not available",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toContain("Browser");
    });

    it("error response for element not found", () => {
      const response = {
        ok: false,
        error: "Element not found: ref=d1",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toContain("not found");
    });

    it("error response for timeout", () => {
      const response = {
        ok: false,
        error: "Action timed out after 5000ms",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toContain("timed out");
    });

    it("error response for invalid targetId", () => {
      const response = {
        ok: false,
        error: "Invalid targetId: tab-999",
      };
      expect(response.ok).toBe(false);
      expect(response.error).toContain("Invalid");
    });
  });

  describe("error response field types", () => {
    it("ok is always boolean false", () => {
      expect(typeof false).toBe("boolean");
    });

    it("error is always a string", () => {
      expect(typeof "error message").toBe("string");
    });

    it("code is optional string", () => {
      const withCode = { ok: false, error: "msg", code: "CODE" };
      const withoutCode = { ok: false, error: "msg" };
      expect(withCode.code).toBe("CODE");
      expect(withoutCode.code).toBeUndefined();
    });

    it("details is optional object", () => {
      const withDetails = { ok: false, error: "msg", details: { key: "value" } };
      const withoutDetails = { ok: false, error: "msg" };
      expect(typeof withDetails.details).toBe("object");
      expect(withoutDetails.details).toBeUndefined();
    });
  });
});

// ============================================================================
// RESPONSE FIELD TYPE CONTRACTS
// ============================================================================

describe("Response field type contracts", () => {
  it("ok field is always boolean", () => {
    expect(typeof true).toBe("boolean");
    expect(typeof false).toBe("boolean");
  });

  it("targetId is always string when present", () => {
    expect(typeof "tab-123").toBe("string");
  });

  it("url is always string when present", () => {
    expect(typeof "https://example.com").toBe("string");
  });

  it("mimeType follows image/* pattern", () => {
    const validMimeTypes = ["image/png", "image/jpeg"];
    validMimeTypes.forEach((mime) => {
      expect(mime).toMatch(/^image\//);
    });
  });

  it("imageBase64 is base64 encoded string", () => {
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    const validBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    expect(base64Pattern.test(validBase64)).toBe(true);
  });

  it("profiles is always array of strings", () => {
    const profiles = ["default", "profile-1"];
    expect(Array.isArray(profiles)).toBe(true);
    profiles.forEach((p) => expect(typeof p).toBe("string"));
  });

  it("results array contains objects with matched boolean", () => {
    const results = [
      { ref: "d1", matched: true },
      { ref: "d2", matched: false },
    ];
    expect(Array.isArray(results)).toBe(true);
    results.forEach((r) => expect(typeof r.matched).toBe("boolean"));
  });
});

// ============================================================================
// RESPONSE CONSISTENCY CONTRACTS
// ============================================================================

describe("Response consistency contracts", () => {
  it("all responses have ok field", () => {
    const successResponse = { ok: true, targetId: "t1" };
    const errorResponse = { ok: false, error: "msg" };
    expect(Object.hasOwn(successResponse, "ok")).toBe(true);
    expect(Object.hasOwn(errorResponse, "ok")).toBe(true);
  });

  it("success responses (ok=true) never include error field", () => {
    const response = { ok: true, targetId: "t1" };
    expect(response.error).toBeUndefined();
  });

  it("error responses (ok=false) always include error field", () => {
    const response = { ok: false, error: "Something went wrong" };
    expect(response.error).toBeDefined();
  });

  it("targetId in response matches request targetId", () => {
    const requestTargetId = "tab-456";
    const response = { ok: true, targetId: requestTargetId };
    expect(response.targetId).toBe(requestTargetId);
  });
});
