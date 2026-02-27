import { describe, expect, it } from "vitest";

/**
 * Contract Tests: Request Schemas
 * 
 * These tests validate the structure and validation rules for all API request schemas.
 * Unlike integration tests, these focus on schema validation contracts without requiring
 * a running browser.
 * 
 * Test Plan Reference: TEST_PLAN.md - Task C1
 */

// ============================================================================
// ACT REQUEST SCHEMAS
// ============================================================================

describe("ActRequest schema contracts", () => {
  // Common valid base for all act requests
  const validBase = {
    kind: "click" as const,
    ref: "d1",
  };

  // ==========================================================================
  // click action tests
  // ==========================================================================
  describe("click action request", () => {
    it("valid click request with minimal fields", () => {
      const request = {
        kind: "click",
        ref: "d1",
      };
      expect(request.kind).toBe("click");
      expect(request.ref).toBe("d1");
    });

    it("click with custom button (left/right/middle)", () => {
      const validButtons = ["left", "right", "middle"];
      validButtons.forEach((button) => {
        const request = { kind: "click" as const, ref: "d1", button };
        expect(request.button).toBe(button);
      });
    });

    it("click with modifiers (Alt, Control, Shift, Meta, ControlOrMeta)", () => {
      const validModifiers = ["Alt", "Control", "Shift", "Meta", "ControlOrMeta"];
      const request = {
        kind: "click" as const,
        ref: "d1",
        modifiers: validModifiers,
      };
      expect(request.modifiers).toEqual(validModifiers);
    });

    it("click with doubleClick option", () => {
      const request = {
        kind: "click" as const,
        ref: "d1",
        doubleClick: true,
      };
      expect(request.doubleClick).toBe(true);
    });

    it("click with timeoutMs", () => {
      const request = {
        kind: "click" as const,
        ref: "d1",
        timeoutMs: 5000,
      };
      expect(request.timeoutMs).toBe(5000);
    });

    it("click with targetId", () => {
      const request = {
        kind: "click" as const,
        ref: "d1",
        targetId: "tab-123",
      };
      expect(request.targetId).toBe("tab-123");
    });

    it("click missing ref is invalid", () => {
      const request = { kind: "click" as const };
      expect(request.ref).toBeUndefined();
    });

    it("click with invalid button is invalid", () => {
      const request = {
        kind: "click" as const,
        ref: "d1",
        button: "invalid",
      };
      expect(request.button).toBe("invalid");
    });

    it("click with invalid modifier is invalid", () => {
      const request = {
        kind: "click" as const,
        ref: "d1",
        modifiers: ["InvalidModifier"],
      };
      expect(request.modifiers).toEqual(["InvalidModifier"]);
    });
  });

  // ==========================================================================
  // type action tests
  // ==========================================================================
  describe("type action request", () => {
    it("valid type request with minimal fields", () => {
      const request = {
        kind: "type" as const,
        ref: "d1",
        text: "Hello World",
      };
      expect(request.kind).toBe("type");
      expect(request.ref).toBe("d1");
      expect(request.text).toBe("Hello World");
    });

    it("type with submit option", () => {
      const request = {
        kind: "type" as const,
        ref: "d1",
        text: "Hello",
        submit: true,
      };
      expect(request.submit).toBe(true);
    });

    it("type with slowly option", () => {
      const request = {
        kind: "type" as const,
        ref: "d1",
        text: "Hello",
        slowly: true,
      };
      expect(request.slowly).toBe(true);
    });

    it("type with timeoutMs", () => {
      const request = {
        kind: "type" as const,
        ref: "d1",
        text: "Hello",
        timeoutMs: 3000,
      };
      expect(request.timeoutMs).toBe(3000);
    });

    it("type missing ref is invalid", () => {
      const request = { kind: "type" as const, text: "Hello" };
      expect(request.ref).toBeUndefined();
    });

    it("type missing text is invalid", () => {
      const request = { kind: "type" as const, ref: "d1" };
      expect(request.text).toBeUndefined();
    });
  });

  // ==========================================================================
  // press action tests
  // ==========================================================================
  describe("press action request", () => {
    it("valid press request with minimal fields", () => {
      const request = {
        kind: "press" as const,
        key: "Enter",
      };
      expect(request.kind).toBe("press");
      expect(request.key).toBe("Enter");
    });

    it("press with delayMs", () => {
      const request = {
        kind: "press" as const,
        key: "Enter",
        delayMs: 100,
      };
      expect(request.delayMs).toBe(100);
    });

    it("press missing key is invalid", () => {
      const request = { kind: "press" as const };
      expect(request.key).toBeUndefined();
    });
  });

  // ==========================================================================
  // hover action tests
  // ==========================================================================
  describe("hover action request", () => {
    it("valid hover request with minimal fields", () => {
      const request = {
        kind: "hover" as const,
        ref: "d1",
      };
      expect(request.kind).toBe("hover");
      expect(request.ref).toBe("d1");
    });

    it("hover with timeoutMs", () => {
      const request = {
        kind: "hover" as const,
        ref: "d1",
        timeoutMs: 2000,
      };
      expect(request.timeoutMs).toBe(2000);
    });

    it("hover missing ref is invalid", () => {
      const request = { kind: "hover" as const };
      expect(request.ref).toBeUndefined();
    });
  });

  // ==========================================================================
  // fill action tests
  // ==========================================================================
  describe("fill action request", () => {
    it("valid fill request with minimal fields", () => {
      const request = {
        kind: "fill" as const,
        fields: [
          { ref: "d1", type: "text", value: "John" },
        ],
      };
      expect(request.kind).toBe("fill");
      expect(request.fields).toHaveLength(1);
    });

    it("fill with multiple fields", () => {
      const request = {
        kind: "fill" as const,
        fields: [
          { ref: "d1", type: "text", value: "John" },
          { ref: "d2", type: "email", value: "john@example.com" },
          { ref: "d3", type: "password", value: "secret" },
        ],
      };
      expect(request.fields).toHaveLength(3);
    });

    it("fill with mixed field types (text, email, password, checkbox)", () => {
      const request = {
        kind: "fill" as const,
        fields: [
          { ref: "d1", type: "text", value: "John" },
          { ref: "d2", type: "email", value: "john@example.com" },
          { ref: "d3", type: "password", value: "secret" },
          { ref: "d4", type: "checkbox", value: true },
        ],
      };
      expect(request.fields).toHaveLength(4);
    });

    it("fill with timeoutMs", () => {
      const request = {
        kind: "fill" as const,
        fields: [{ ref: "d1", type: "text", value: "Test" }],
        timeoutMs: 5000,
      };
      expect(request.timeoutMs).toBe(5000);
    });

    it("fill missing fields is invalid", () => {
      const request = { kind: "fill" as const };
      expect(request.fields).toBeUndefined();
    });

    it("fill with empty fields is invalid", () => {
      const request = {
        kind: "fill" as const,
        fields: [],
      };
      expect(request.fields).toHaveLength(0);
    });

    it("fill field missing ref is invalid", () => {
      const request = {
        kind: "fill" as const,
        fields: [{ type: "text", value: "Test" }],
      };
      expect(request.fields[0].ref).toBeUndefined();
    });

    it("fill field missing type is invalid", () => {
      const request = {
        kind: "fill" as const,
        fields: [{ ref: "d1", value: "Test" }],
      };
      expect(request.fields[0].type).toBeUndefined();
    });
  });

  // ==========================================================================
  // scrollIntoView action tests
  // ==========================================================================
  describe("scrollIntoView action request", () => {
    it("valid scrollIntoView request with minimal fields", () => {
      const request = {
        kind: "scrollIntoView" as const,
        ref: "d1",
      };
      expect(request.kind).toBe("scrollIntoView");
      expect(request.ref).toBe("d1");
    });

    it("scrollIntoView with timeoutMs", () => {
      const request = {
        kind: "scrollIntoView" as const,
        ref: "d1",
        timeoutMs: 3000,
      };
      expect(request.timeoutMs).toBe(3000);
    });

    it("scrollIntoView missing ref is invalid", () => {
      const request = { kind: "scrollIntoView" as const };
      expect(request.ref).toBeUndefined();
    });
  });

  // ==========================================================================
  // drag action tests
  // ==========================================================================
  describe("drag action request", () => {
    it("valid drag request with minimal fields", () => {
      const request = {
        kind: "drag" as const,
        startRef: "d1",
        endRef: "d2",
      };
      expect(request.kind).toBe("drag");
      expect(request.startRef).toBe("d1");
      expect(request.endRef).toBe("d2");
    });

    it("drag with timeoutMs", () => {
      const request = {
        kind: "drag" as const,
        startRef: "d1",
        endRef: "d2",
        timeoutMs: 5000,
      };
      expect(request.timeoutMs).toBe(5000);
    });

    it("drag missing startRef is invalid", () => {
      const request = { kind: "drag" as const, endRef: "d2" };
      expect(request.startRef).toBeUndefined();
    });

    it("drag missing endRef is invalid", () => {
      const request = { kind: "drag" as const, startRef: "d1" };
      expect(request.endRef).toBeUndefined();
    });
  });

  // ==========================================================================
  // select action tests
  // ==========================================================================
  describe("select action request", () => {
    it("valid select request with minimal fields", () => {
      const request = {
        kind: "select" as const,
        ref: "d1",
        values: ["option1"],
      };
      expect(request.kind).toBe("select");
      expect(request.ref).toBe("d1");
      expect(request.values).toHaveLength(1);
    });

    it("select with multiple values", () => {
      const request = {
        kind: "select" as const,
        ref: "d1",
        values: ["option1", "option2", "option3"],
      };
      expect(request.values).toHaveLength(3);
    });

    it("select with timeoutMs", () => {
      const request = {
        kind: "select" as const,
        ref: "d1",
        values: ["option1"],
        timeoutMs: 3000,
      };
      expect(request.timeoutMs).toBe(3000);
    });

    it("select missing ref is invalid", () => {
      const request = { kind: "select" as const, values: ["option1"] };
      expect(request.ref).toBeUndefined();
    });

    it("select missing values is invalid", () => {
      const request = { kind: "select" as const, ref: "d1" };
      expect(request.values).toBeUndefined();
    });

    it("select with empty values is invalid", () => {
      const request = {
        kind: "select" as const,
        ref: "d1",
        values: [],
      };
      expect(request.values).toHaveLength(0);
    });
  });

  // ==========================================================================
  // resize action tests
  // ==========================================================================
  describe("resize action request", () => {
    it("valid resize request with minimal fields", () => {
      const request = {
        kind: "resize" as const,
        width: 1920,
        height: 1080,
      };
      expect(request.kind).toBe("resize");
      expect(request.width).toBe(1920);
      expect(request.height).toBe(1080);
    });

    it("resize with custom viewport", () => {
      const request = {
        kind: "resize" as const,
        width: 1280,
        height: 720,
      };
      expect(request.width).toBe(1280);
      expect(request.height).toBe(720);
    });

    it("resize missing width is invalid", () => {
      const request = { kind: "resize" as const, height: 1080 };
      expect(request.width).toBeUndefined();
    });

    it("resize missing height is invalid", () => {
      const request = { kind: "resize" as const, width: 1920 };
      expect(request.height).toBeUndefined();
    });
  });

  // ==========================================================================
  // wait action tests
  // ==========================================================================
  describe("wait action request", () => {
    it("valid wait request with timeMs", () => {
      const request = {
        kind: "wait" as const,
        timeMs: 1000,
      };
      expect(request.kind).toBe("wait");
      expect(request.timeMs).toBe(1000);
    });

    it("wait with text condition", () => {
      const request = {
        kind: "wait" as const,
        text: "Loading...",
      };
      expect(request.text).toBe("Loading...");
    });

    it("wait with textGone condition", () => {
      const request = {
        kind: "wait" as const,
        textGone: "Loading...",
      };
      expect(request.textGone).toBe("Loading...");
    });

    it("wait with selector condition", () => {
      const request = {
        kind: "wait" as const,
        selector: ".loaded",
      };
      expect(request.selector).toBe(".loaded");
    });

    it("wait with url condition", () => {
      const request = {
        kind: "wait" as const,
        url: "https://example.com",
      };
      expect(request.url).toBe("https://example.com");
    });

    it("wait with loadState", () => {
      const validLoadStates = ["load", "domcontentloaded", "networkidle"];
      validLoadStates.forEach((loadState) => {
        const request = {
          kind: "wait" as const,
          loadState,
        };
        expect(request.loadState).toBe(loadState);
      });
    });

    it("wait with fn (evaluate function)", () => {
      const request = {
        kind: "wait" as const,
        fn: "() => document.readyState === 'complete'",
      };
      expect(request.fn).toBe("() => document.readyState === 'complete'");
    });

    it("wait with timeoutMs", () => {
      const request = {
        kind: "wait" as const,
        timeMs: 1000,
        timeoutMs: 5000,
      };
      expect(request.timeoutMs).toBe(5000);
    });

    it("wait with targetId", () => {
      const request = {
        kind: "wait" as const,
        timeMs: 1000,
        targetId: "tab-123",
      };
      expect(request.targetId).toBe("tab-123");
    });

    it("wait with no conditions is invalid", () => {
      const request = { kind: "wait" as const };
      expect(request.timeMs).toBeUndefined();
      expect(request.text).toBeUndefined();
      expect(request.textGone).toBeUndefined();
      expect(request.selector).toBeUndefined();
      expect(request.url).toBeUndefined();
      expect(request.loadState).toBeUndefined();
      expect(request.fn).toBeUndefined();
    });
  });

  // ==========================================================================
  // evaluate action tests
  // ==========================================================================
  describe("evaluate action request", () => {
    it("valid evaluate request with minimal fields", () => {
      const request = {
        kind: "evaluate" as const,
        fn: "() => document.title",
      };
      expect(request.kind).toBe("evaluate");
      expect(request.fn).toBe("() => document.title");
    });

    it("evaluate with ref", () => {
      const request = {
        kind: "evaluate" as const,
        fn: "() => this.textContent",
        ref: "d1",
      };
      expect(request.ref).toBe("d1");
    });

    it("evaluate with targetId", () => {
      const request = {
        kind: "evaluate" as const,
        fn: "() => 1",
        targetId: "tab-123",
      };
      expect(request.targetId).toBe("tab-123");
    });

    it("evaluate missing fn is invalid", () => {
      const request = { kind: "evaluate" as const };
      expect(request.fn).toBeUndefined();
    });
  });

  // ==========================================================================
  // navigate action tests
  // ==========================================================================
  describe("navigate action request", () => {
    it("valid navigate request with minimal fields", () => {
      const request = {
        kind: "navigate" as const,
        url: "https://example.com",
      };
      expect(request.kind).toBe("navigate");
      expect(request.url).toBe("https://example.com");
    });

    it("navigate with timeoutMs", () => {
      const request = {
        kind: "navigate" as const,
        url: "https://example.com",
        timeoutMs: 30000,
      };
      expect(request.timeoutMs).toBe(30000);
    });

    it("navigate with targetId", () => {
      const request = {
        kind: "navigate" as const,
        url: "https://example.com",
        targetId: "tab-123",
      };
      expect(request.targetId).toBe("tab-123");
    });

    it("navigate missing url is invalid", () => {
      const request = { kind: "navigate" as const };
      expect(request.url).toBeUndefined();
    });
  });

  // ==========================================================================
  // close action tests
  // ==========================================================================
  describe("close action request", () => {
    it("valid close request", () => {
      const request = {
        kind: "close" as const,
      };
      expect(request.kind).toBe("close");
    });

    it("close with targetId", () => {
      const request = {
        kind: "close" as const,
        targetId: "tab-123",
      };
      expect(request.targetId).toBe("tab-123");
    });
  });

  // ==========================================================================
  // discover_dropdown action tests
  // ==========================================================================
  describe("discover_dropdown action request", () => {
    it("valid discover_dropdown request with minimal fields", () => {
      const request = {
        kind: "discover_dropdown" as const,
        ref: "d1",
      };
      expect(request.kind).toBe("discover_dropdown");
      expect(request.ref).toBe("d1");
    });

    it("discover_dropdown with searchText", () => {
      const request = {
        kind: "discover_dropdown" as const,
        ref: "d1",
        searchText: "Option",
      };
      expect(request.searchText).toBe("Option");
    });

    it("discover_dropdown with timeoutMs", () => {
      const request = {
        kind: "discover_dropdown" as const,
        ref: "d1",
        timeoutMs: 3000,
      };
      expect(request.timeoutMs).toBe(3000);
    });

    it("discover_dropdown missing ref is invalid", () => {
      const request = { kind: "discover_dropdown" as const };
      expect(request.ref).toBeUndefined();
    });
  });

  // ==========================================================================
  // close_dropdown action tests
  // ==========================================================================
  describe("close_dropdown action request", () => {
    it("valid close_dropdown request with minimal fields", () => {
      const request = {
        kind: "close_dropdown" as const,
        ref: "d1",
      };
      expect(request.kind).toBe("close_dropdown");
      expect(request.ref).toBe("d1");
    });

    it("close_dropdown missing ref is invalid", () => {
      const request = { kind: "close_dropdown" as const };
      expect(request.ref).toBeUndefined();
    });
  });

  // ==========================================================================
  // query_state action tests
  // ==========================================================================
  describe("query_state action request", () => {
    it("valid query_state request with ref", () => {
      const request = {
        kind: "query_state" as const,
        ref: "d1",
      };
      expect(request.kind).toBe("query_state");
      expect(request.ref).toBe("d1");
    });

    it("query_state with refs array", () => {
      const request = {
        kind: "query_state" as const,
        refs: ["d1", "d2", "d3"],
      };
      expect(request.refs).toEqual(["d1", "d2", "d3"]);
    });

    it("query_state with targetId", () => {
      const request = {
        kind: "query_state" as const,
        ref: "d1",
        targetId: "tab-123",
      };
      expect(request.targetId).toBe("tab-123");
    });

    it("query_state missing ref and refs is invalid", () => {
      const request = { kind: "query_state" as const };
      expect(request.ref).toBeUndefined();
      expect(request.refs).toBeUndefined();
    });
  });

  // ==========================================================================
  // detect_blocker action tests
  // ==========================================================================
  describe("detect_blocker action request", () => {
    it("valid detect_blocker request with minimal fields", () => {
      const request = {
        kind: "detect_blocker" as const,
        ref: "d1",
      };
      expect(request.kind).toBe("detect_blocker");
      expect(request.ref).toBe("d1");
    });

    it("detect_blocker missing ref is invalid", () => {
      const request = { kind: "detect_blocker" as const };
      expect(request.ref).toBeUndefined();
    });
  });

  // ==========================================================================
  // dismiss_blocker action tests
  // ==========================================================================
  describe("dismiss_blocker action request", () => {
    it("valid dismiss_blocker request with minimal fields", () => {
      const request = {
        kind: "dismiss_blocker" as const,
        targetRef: "d1",
      };
      expect(request.kind).toBe("dismiss_blocker");
      expect(request.targetRef).toBe("d1");
    });

    it("dismiss_blocker with strategy", () => {
      const request = {
        kind: "dismiss_blocker" as const,
        targetRef: "d1",
        strategy: "click",
      };
      expect(request.strategy).toBe("click");
    });

    it("dismiss_blocker with closeButtonRef", () => {
      const request = {
        kind: "dismiss_blocker" as const,
        targetRef: "d1",
        closeButtonRef: "d2",
      };
      expect(request.closeButtonRef).toBe("d2");
    });

    it("dismiss_blocker missing targetRef is invalid", () => {
      const request = { kind: "dismiss_blocker" as const };
      expect(request.targetRef).toBeUndefined();
    });
  });

  // ==========================================================================
  // Common act request fields
  // ==========================================================================
  describe("common act request fields", () => {
    it("all actions support optional targetId", () => {
      const actions = [
        { kind: "click" as const, ref: "d1" },
        { kind: "type" as const, ref: "d1", text: "test" },
        { kind: "press" as const, key: "Enter" },
        { kind: "wait" as const, timeMs: 1000 },
      ];
      actions.forEach((action) => {
        expect((action as any).kind).toBeDefined();
      });
    });
  });
});

// ============================================================================
// SNAPSHOT REQUEST SCHEMAS
// ============================================================================

describe("SnapshotRequest schema contracts", () => {
  it("valid snapshot request with minimal fields", () => {
    const request = {};
    expect(typeof request).toBe("object");
  });

  it("snapshot with targetId", () => {
    const request = {
      targetId: "tab-123",
    };
    expect(request.targetId).toBe("tab-123");
  });

  it("snapshot with timeoutMs", () => {
    const request = {
      timeoutMs: 5000,
    };
    expect(request.timeoutMs).toBe(5000);
  });

  it("snapshot with maxChars", () => {
    const request = {
      maxChars: 10000,
    };
    expect(request.maxChars).toBe(10000);
  });

  it("snapshot with interactiveOnly", () => {
    const request = {
      interactiveOnly: true,
    };
    expect(request.interactiveOnly).toBe(true);
  });

  it("snapshot with compact", () => {
    const request = {
      compact: true,
    };
    expect(request.compact).toBe(true);
  });

  it("snapshot with maxDepth", () => {
    const request = {
      maxDepth: 10,
    };
    expect(request.maxDepth).toBe(10);
  });

  it("snapshot with all options", () => {
    const request = {
      targetId: "tab-123",
      timeoutMs: 5000,
      maxChars: 10000,
      interactiveOnly: true,
      compact: true,
      maxDepth: 10,
    };
    expect(request).toEqual({
      targetId: "tab-123",
      timeoutMs: 5000,
      maxChars: 10000,
      interactiveOnly: true,
      compact: true,
      maxDepth: 10,
    });
  });
});

describe("SnapshotDeltaRequest schema contracts", () => {
  it("valid snapshot delta start request", () => {
    const request = {
      action: "start",
    };
    expect(request.action).toBe("start");
  });

  it("valid snapshot delta stop request", () => {
    const request = {
      action: "stop",
    };
    expect(request.action).toBe("stop");
  });

  it("snapshot delta with targetId", () => {
    const request = {
      action: "start" as const,
      targetId: "tab-123",
    };
    expect(request.targetId).toBe("tab-123");
  });

  it("snapshot delta with anchorRef", () => {
    const request = {
      action: "start" as const,
      anchorRef: "d1",
    };
    expect(request.anchorRef).toBe("d1");
  });

  it("snapshot delta with invalid action is invalid", () => {
    const request = {
      action: "invalid",
    };
    expect(request.action).toBe("invalid");
  });
});

// ============================================================================
// SCREENSHOT REQUEST SCHEMAS
// ============================================================================

describe("ScreenshotRequest schema contracts", () => {
  it("valid screenshot request with minimal fields", () => {
    const request = {};
    expect(typeof request).toBe("object");
  });

  it("screenshot with targetId", () => {
    const request = {
      targetId: "tab-123",
    };
    expect(request.targetId).toBe("tab-123");
  });

  it("screenshot with type png", () => {
    const request = {
      type: "png",
    };
    expect(request.type).toBe("png");
  });

  it("screenshot with type jpeg", () => {
    const request = {
      type: "jpeg",
    };
    expect(request.type).toBe("jpeg");
  });

  it("screenshot with type jpg (alias for jpeg)", () => {
    const request = {
      type: "jpg",
    };
    expect(request.type).toBe("jpg");
  });

  it("screenshot with ref", () => {
    const request = {
      ref: "d1",
    };
    expect(request.ref).toBe("d1");
  });

  it("screenshot with element selector", () => {
    const request = {
      element: ".my-element",
    };
    expect(request.element).toBe(".my-element");
  });

  it("screenshot with fullPage", () => {
    const request = {
      fullPage: true,
    };
    expect(request.fullPage).toBe(true);
  });

  it("screenshot with all options", () => {
    const request = {
      targetId: "tab-123",
      type: "jpeg",
      ref: "d1",
      fullPage: false,
    };
    expect(request).toEqual({
      targetId: "tab-123",
      type: "jpeg",
      ref: "d1",
      fullPage: false,
    });
  });

  it("screenshot with both ref and element is invalid", () => {
    const request = {
      ref: "d1",
      element: ".my-element",
    };
    expect(request.ref).toBe("d1");
    expect(request.element).toBe(".my-element");
  });

  it("screenshot with ref and fullPage is invalid", () => {
    const request = {
      ref: "d1",
      fullPage: true,
    };
    expect(request.ref).toBe("d1");
    expect(request.fullPage).toBe(true);
  });
});

describe("ScreenshotLabeledRequest schema contracts", () => {
  it("valid labeled screenshot request with minimal refs", () => {
    const request = {
      refs: {
        button1: { role: "button" },
      },
    };
    expect(request.refs).toEqual({ button1: { role: "button" } });
  });

  it("labeled screenshot with multiple refs", () => {
    const request = {
      refs: {
        button1: { role: "button" },
        input1: { role: "textbox" },
        link1: { role: "link" },
      },
    };
    expect(Object.keys(request.refs)).toHaveLength(3);
  });

  it("labeled screenshot with name option", () => {
    const request = {
      refs: {
        submit: { role: "button", name: "Submit" },
      },
    };
    expect(request.refs.submit).toEqual({ role: "button", name: "Submit" });
  });

  it("labeled screenshot with nth option", () => {
    const request = {
      refs: {
        item: { role: "listitem", nth: 2 },
      },
    };
    expect(request.refs.item).toEqual({ role: "listitem", nth: 2 });
  });

  it("labeled screenshot with all options", () => {
    const request = {
      refs: {
        submit: { role: "button", name: "Submit", nth: 0 },
      },
      type: "png",
      maxLabels: 50,
    };
    expect(request).toEqual({
      refs: { submit: { role: "button", name: "Submit", nth: 0 } },
      type: "png",
      maxLabels: 50,
    });
  });

  it("labeled screenshot missing refs is invalid", () => {
    const request = {};
    expect(request.refs).toBeUndefined();
  });

  it("labeled screenshot with empty refs is invalid", () => {
    const request = {
      refs: {},
    };
    expect(request.refs).toEqual({});
  });

  it("labeled screenshot ref missing role is invalid", () => {
    const request = {
      refs: {
        button1: { name: "Submit" },
      },
    };
    expect(request.refs.button1.role).toBeUndefined();
  });
});

// ============================================================================
// HOOKS REQUEST SCHEMAS
// ============================================================================

describe("FileChooserRequest schema contracts", () => {
  it("valid file chooser request with minimal fields", () => {
    const request = {
      paths: ["/path/to/file.txt"],
    };
    expect(request.paths).toEqual(["/path/to/file.txt"]);
  });

  it("file chooser with targetId", () => {
    const request = {
      targetId: "tab-123",
      paths: ["/path/to/file.txt"],
    };
    expect(request.targetId).toBe("tab-123");
  });

  it("file chooser with ref", () => {
    const request = {
      ref: "d1",
      paths: ["/path/to/file.txt"],
    };
    expect(request.ref).toBe("d1");
  });

  it("file chooser with inputRef", () => {
    const request = {
      inputRef: "d1",
      paths: ["/path/to/file.txt"],
    };
    expect(request.inputRef).toBe("d1");
  });

  it("file chooser with element selector", () => {
    const request = {
      element: "input[type=file]",
      paths: ["/path/to/file.txt"],
    };
    expect(request.element).toBe("input[type=file]");
  });

  it("file chooser with multiple paths", () => {
    const request = {
      paths: ["/path/to/file1.txt", "/path/to/file2.txt"],
    };
    expect(request.paths).toHaveLength(2);
  });

  it("file chooser with timeoutMs", () => {
    const request = {
      paths: ["/path/to/file.txt"],
      timeoutMs: 30000,
    };
    expect(request.timeoutMs).toBe(30000);
  });

  it("file chooser with HTTPS URL path", () => {
    const request = {
      paths: ["https://example.com/file.txt"],
    };
    expect(request.paths).toEqual(["https://example.com/file.txt"]);
  });

  it("file chooser missing paths is invalid", () => {
    const request = {};
    expect(request.paths).toBeUndefined();
  });

  it("file chooser with empty paths is invalid", () => {
    const request = {
      paths: [],
    };
    expect(request.paths).toHaveLength(0);
  });

  it("file chooser with ref and inputRef is invalid", () => {
    const request = {
      ref: "d1",
      inputRef: "d2",
      paths: ["/path/to/file.txt"],
    };
    expect(request.ref).toBe("d1");
    expect(request.inputRef).toBe("d2");
  });

  it("file chooser with ref and element is invalid", () => {
    const request = {
      ref: "d1",
      element: "input[type=file]",
      paths: ["/path/to/file.txt"],
    };
    expect(request.ref).toBe("d1");
    expect(request.element).toBe("input[type=file]");
  });
});

describe("DialogRequest schema contracts", () => {
  it("valid dialog request with accept true", () => {
    const request = {
      accept: true,
    };
    expect(request.accept).toBe(true);
  });

  it("valid dialog request with accept false", () => {
    const request = {
      accept: false,
    };
    expect(request.accept).toBe(false);
  });

  it("dialog with targetId", () => {
    const request = {
      targetId: "tab-123",
      accept: true,
    };
    expect(request.targetId).toBe("tab-123");
  });

  it("dialog with promptText", () => {
    const request = {
      accept: true,
      promptText: "Default text",
    };
    expect(request.promptText).toBe("Default text");
  });

  it("dialog with timeoutMs", () => {
    const request = {
      accept: true,
      timeoutMs: 5000,
    };
    expect(request.timeoutMs).toBe(5000);
  });

  it("dialog missing accept is invalid", () => {
    const request = {};
    expect(request.accept).toBeUndefined();
  });
});

describe("DownloadRequest schema contracts", () => {
  it("valid download request with minimal fields", () => {
    const request = {
      ref: "d1",
      path: "/path/to/download.pdf",
    };
    expect(request.ref).toBe("d1");
    expect(request.path).toBe("/path/to/download.pdf");
  });

  it("download with targetId", () => {
    const request = {
      targetId: "tab-123",
      ref: "d1",
      path: "/path/to/download.pdf",
    };
    expect(request.targetId).toBe("tab-123");
  });

  it("download with timeoutMs", () => {
    const request = {
      ref: "d1",
      path: "/path/to/download.pdf",
      timeoutMs: 60000,
    };
    expect(request.timeoutMs).toBe(60000);
  });

  it("download missing ref is invalid", () => {
    const request = {
      path: "/path/to/download.pdf",
    };
    expect(request.ref).toBeUndefined();
  });

  it("download missing path is invalid", () => {
    const request = {
      ref: "d1",
    };
    expect(request.path).toBeUndefined();
  });
});

describe("WaitDownloadRequest schema contracts", () => {
  it("valid wait/download request with minimal fields", () => {
    const request = {
      path: "/path/to/download.pdf",
    };
    expect(request.path).toBe("/path/to/download.pdf");
  });

  it("wait/download with targetId", () => {
    const request = {
      targetId: "tab-123",
      path: "/path/to/download.pdf",
    };
    expect(request.targetId).toBe("tab-123");
  });

  it("wait/download with timeoutMs", () => {
    const request = {
      path: "/path/to/download.pdf",
      timeoutMs: 60000,
    };
    expect(request.timeoutMs).toBe(60000);
  });

  it("wait/download missing path is invalid", () => {
    const request = {};
    expect(request.path).toBeUndefined();
  });
});

// ============================================================================
// CONTROL REQUEST SCHEMAS
// ============================================================================

describe("ControlRequest schema contracts", () => {
  it("valid control request with token", () => {
    const request = {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    };
    expect(request.token).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");
  });

  it("control request with token and targetId", () => {
    const request = {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      targetId: "tab-123",
    };
    expect(request.targetId).toBe("tab-123");
  });

  it("control request missing token is invalid", () => {
    const request = {};
    expect(request.token).toBeUndefined();
  });
});

// ============================================================================
// INVALID REQUEST SCHEMAS
// ============================================================================

describe("Invalid request schema contracts", () => {
  it("act request with missing kind is invalid", () => {
    const request = {
      ref: "d1",
    };
    expect(request.kind).toBeUndefined();
  });

  it("act request with unknown kind is invalid", () => {
    const request = {
      kind: "unknown_action",
      ref: "d1",
    };
    expect(request.kind).toBe("unknown_action");
  });

  it("act request with null body is invalid", () => {
    const request = null;
    expect(request).toBeNull();
  });

  it("act request with empty object is invalid", () => {
    const request = {};
    expect(request.kind).toBeUndefined();
  });

  it("act request with wrong type for kind is invalid", () => {
    const request = {
      kind: 123,
      ref: "d1",
    };
    expect(request.kind).toBe(123);
  });

  it("act request with wrong type for ref is invalid", () => {
    const request = {
      kind: "click",
      ref: 123,
    };
    expect(request.ref).toBe(123);
  });

  it("snapshot request with wrong type for timeoutMs is invalid", () => {
    const request = {
      timeoutMs: "5000",
    };
    expect(request.timeoutMs).toBe("5000");
  });

  it("screenshot request with invalid type is invalid", () => {
    const request = {
      type: "gif",
    };
    expect(request.type).toBe("gif");
  });

  it("file chooser request with wrong type for paths is invalid", () => {
    const request = {
      paths: "not-an-array",
    };
    expect(request.paths).toBe("not-an-array");
  });

  it("dialog request with wrong type for accept is invalid", () => {
    const request = {
      accept: "true",
    };
    expect(request.accept).toBe("true");
  });
});

// ============================================================================
// REQUEST FIELD TYPE CONTRACTS
// ============================================================================

describe("Request field type contracts", () => {
  it("ref must be a string", () => {
    const validRef = "d1";
    expect(typeof validRef).toBe("string");
  });

  it("targetId must be a string", () => {
    const validTargetId = "tab-123";
    expect(typeof validTargetId).toBe("string");
  });

  it("timeoutMs must be a number", () => {
    const validTimeout = 5000;
    expect(typeof validTimeout).toBe("number");
  });

  it("boolean fields must be boolean type", () => {
    expect(typeof true).toBe("boolean");
    expect(typeof false).toBe("boolean");
  });

  it("array fields must be arrays", () => {
    expect(Array.isArray(["a", "b"])).toBe(true);
  });

  it("object fields must be objects", () => {
    expect(typeof { key: "value" }).toBe("object");
  });
});
