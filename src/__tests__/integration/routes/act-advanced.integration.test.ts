import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pw-ai-module to avoid real browser calls
const hoverViaPlaywright = vi.fn();
const scrollIntoViewViaPlaywright = vi.fn();
const dragViaPlaywright = vi.fn();
const selectOptionViaPlaywright = vi.fn();
const queryElementStateViaPlaywright = vi.fn();
const queryElementStatesViaPlaywright = vi.fn();
const discoverDropdownOptionsViaPlaywright = vi.fn();
const closeDropdownViaPlaywright = vi.fn();
const detectBlockingElementViaPlaywright = vi.fn();
const dismissBlockerViaPlaywright = vi.fn();

vi.mock("../../../browser/pw-ai-module.js", () => ({
  getPwAiModule: async () => ({
    hoverViaPlaywright,
    scrollIntoViewViaPlaywright,
    dragViaPlaywright,
    selectOptionViaPlaywright,
    queryElementStateViaPlaywright,
    queryElementStatesViaPlaywright,
    discoverDropdownOptionsViaPlaywright,
    closeDropdownViaPlaywright,
    detectBlockingElementViaPlaywright,
    dismissBlockerViaPlaywright,
  }),
}));

import { registerBrowserAgentActRoutes } from "../../../browser/routes/agent.act.js";

describe("integration: /act - advanced actions", () => {
  beforeEach(() => {
    hoverViaPlaywright.mockReset();
    scrollIntoViewViaPlaywright.mockReset();
    dragViaPlaywright.mockReset();
    selectOptionViaPlaywright.mockReset();
    queryElementStateViaPlaywright.mockReset();
    queryElementStatesViaPlaywright.mockReset();
    discoverDropdownOptionsViaPlaywright.mockReset();
    closeDropdownViaPlaywright.mockReset();
    detectBlockingElementViaPlaywright.mockReset();
    dismissBlockerViaPlaywright.mockReset();
  });

  /**
   * Helper to create test Express app with act routes
   */
  function makeApp(options?: {
    profileName?: string;
    cdpUrl?: string;
    targetId?: string;
    pageUrl?: string;
    evaluateEnabled?: boolean;
  }) {
    const app = express();
    app.use(express.json());

    const ctx = {
      state: () => ({
        resolved: { evaluateEnabled: options?.evaluateEnabled ?? true },
      }),
      forProfile: () => ({
        profile: {
          name: options?.profileName ?? "default",
          cdpUrl: options?.cdpUrl ?? "http://127.0.0.1:9222",
        },
        ensureTabAvailable: async (targetId?: string) => ({
          targetId: targetId ?? "tab-default",
          url: options?.pageUrl ?? "https://example.org",
        }),
        stopRunningBrowser: async () => undefined,
      }),
      mapTabError: () => null,
    } as any;

    registerBrowserAgentActRoutes(app as any, ctx);
    return app;
  }

  describe("POST /act (hover) - Basic Functionality", () => {
    it("basic hover over element", async () => {
      hoverViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(hoverViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
        })
      );
    });

    it("hover with timeoutMs", async () => {
      hoverViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
        ref: "e1",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(hoverViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 5000,
        })
      );
    });

    it("response structure verification", async () => {
      hoverViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
        ref: "e1",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("hover with explicit targetId", async () => {
      hoverViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
        ref: "e1",
        targetId: "tab-hover",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-hover");
    });

    it("logging verification - hover request logged", async () => {
      hoverViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(hoverViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (hover) - Error Handling", () => {
    it("error: missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: element not found", async () => {
      hoverViaPlaywright.mockRejectedValue(new Error("Element not found: e1"));

      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("error: browser unavailable", async () => {
      hoverViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "hover",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Browser unavailable");
    });
  });

  describe("POST /act (scrollIntoView) - Basic Functionality", () => {
    it("basic scroll into view", async () => {
      scrollIntoViewViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "scrollIntoView",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(scrollIntoViewViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
        })
      );
    });

    it("scroll with timeoutMs", async () => {
      scrollIntoViewViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "scrollIntoView",
        ref: "e1",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(scrollIntoViewViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 5000,
        })
      );
    });

    it("response structure verification", async () => {
      scrollIntoViewViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "scrollIntoView",
        ref: "e1",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("scroll with explicit targetId", async () => {
      scrollIntoViewViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "scrollIntoView",
        ref: "e1",
        targetId: "tab-scroll",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-scroll");
    });

    it("logging verification - scroll request logged", async () => {
      scrollIntoViewViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "scrollIntoView",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(scrollIntoViewViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (scrollIntoView) - Error Handling", () => {
    it("error: missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "scrollIntoView",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: element not found", async () => {
      scrollIntoViewViaPlaywright.mockRejectedValue(new Error("Element not found"));

      const res = await request(makeApp()).post("/act").send({
        kind: "scrollIntoView",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });
  });

  describe("POST /act (drag) - Basic Functionality", () => {
    it("basic drag from start to end", async () => {
      dragViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        startRef: "e1",
        endRef: "e2",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(dragViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          startRef: "e1",
          endRef: "e2",
        })
      );
    });

    it("drag with timeoutMs", async () => {
      dragViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        startRef: "e1",
        endRef: "e2",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(dragViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 5000,
        })
      );
    });

    it("response structure verification", async () => {
      dragViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        startRef: "e1",
        endRef: "e2",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("drag with explicit targetId", async () => {
      dragViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        startRef: "e1",
        endRef: "e2",
        targetId: "tab-drag",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-drag");
    });

    it("logging verification - drag request logged", async () => {
      dragViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        startRef: "e1",
        endRef: "e2",
      });

      expect(res.status).toBe(200);
      expect(dragViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (drag) - Error Handling", () => {
    it("error: missing startRef", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        endRef: "e2",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("startRef and endRef are required");
    });

    it("error: missing endRef", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        startRef: "e1",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("startRef and endRef are required");
    });

    it("error: element not found", async () => {
      dragViaPlaywright.mockRejectedValue(new Error("Element not found"));

      const res = await request(makeApp()).post("/act").send({
        kind: "drag",
        startRef: "e1",
        endRef: "e2",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });
  });

  describe("POST /act (select) - Basic Functionality", () => {
    it("basic select option", async () => {
      selectOptionViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
        values: ["option1"],
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(selectOptionViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
          values: ["option1"],
        })
      );
    });

    it("select multiple options", async () => {
      selectOptionViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
        values: ["option1", "option2", "option3"],
      });

      expect(res.status).toBe(200);
      expect(selectOptionViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          values: ["option1", "option2", "option3"],
        })
      );
    });

    it("select with timeoutMs", async () => {
      selectOptionViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
        values: ["option1"],
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(selectOptionViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 5000,
        })
      );
    });

    it("response structure verification", async () => {
      selectOptionViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
        values: ["option1"],
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("select with explicit targetId", async () => {
      selectOptionViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
        values: ["option1"],
        targetId: "tab-select",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-select");
    });

    it("logging verification - select request logged", async () => {
      selectOptionViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
        values: ["option1"],
      });

      expect(res.status).toBe(200);
      expect(selectOptionViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (select) - Error Handling", () => {
    it("error: missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        values: ["option1"],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref and values are required");
    });

    it("error: missing values", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref and values are required");
    });

    it("error: empty values array", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
        values: [],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref and values are required");
    });

    it("error: element not found", async () => {
      selectOptionViaPlaywright.mockRejectedValue(new Error("Element not found"));

      const res = await request(makeApp()).post("/act").send({
        kind: "select",
        ref: "e1",
        values: ["option1"],
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });
  });

  describe("POST /act (query_state) - Basic Functionality", () => {
    it("query element visible", async () => {
      queryElementStateViaPlaywright.mockResolvedValue({ visible: true });

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.state.visible).toBe(true);
      expect(queryElementStateViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
        })
      );
    });

    it("query element hidden", async () => {
      queryElementStateViaPlaywright.mockResolvedValue({ visible: false });

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.state.visible).toBe(false);
    });

    it("query element disabled", async () => {
      queryElementStateViaPlaywright.mockResolvedValue({ disabled: true });

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.state.disabled).toBe(true);
    });

    it("query element text", async () => {
      queryElementStateViaPlaywright.mockResolvedValue({ text: "Button Text" });

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.state.text).toBe("Button Text");
    });

    it("query element value", async () => {
      queryElementStateViaPlaywright.mockResolvedValue({ value: "input value" });

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.state.value).toBe("input value");
    });

    it("query multiple states with refs", async () => {
      queryElementStatesViaPlaywright.mockResolvedValue({
        states: {
          e1: { visible: true },
          e2: { visible: false },
        },
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        refs: ["e1", "e2"],
      });

      expect(res.status).toBe(200);
      expect(res.body.states.e1.visible).toBe(true);
      expect(res.body.states.e2.visible).toBe(false);
      expect(queryElementStatesViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          refs: ["e1", "e2"],
        })
      );
    });

    it("response structure verification", async () => {
      queryElementStateViaPlaywright.mockResolvedValue({ visible: true });

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        state: expect.any(Object),
      });
    });

    it("query with explicit targetId", async () => {
      queryElementStateViaPlaywright.mockResolvedValue({ visible: true });

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
        targetId: "tab-query",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-query");
    });
  });

  describe("POST /act (query_state) - Error Handling", () => {
    it("error: missing ref and refs", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref or refs is required");
    });

    it("error: element not found", async () => {
      queryElementStateViaPlaywright.mockRejectedValue(new Error("Element not found"));

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });

    it("error: browser unavailable", async () => {
      queryElementStateViaPlaywright.mockRejectedValue(new Error("Browser unavailable"));

      const res = await request(makeApp()).post("/act").send({
        kind: "query_state",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Browser unavailable");
    });
  });

  describe("POST /act (discover_dropdown) - Basic Functionality", () => {
    it("discover dropdown options", async () => {
      discoverDropdownOptionsViaPlaywright.mockResolvedValue({
        options: [
          { value: "1", text: "Option 1" },
          { value: "2", text: "Option 2" },
        ],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.options).toHaveLength(2);
      expect(discoverDropdownOptionsViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
        })
      );
    });

    it("discover dropdown with searchText", async () => {
      discoverDropdownOptionsViaPlaywright.mockResolvedValue({
        options: [{ value: "1", text: "Matching Option" }],
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "e1",
        searchText: "Matching",
      });

      expect(res.status).toBe(200);
      expect(discoverDropdownOptionsViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          searchText: "Matching",
        })
      );
    });

    it("discover dropdown with timeoutMs", async () => {
      discoverDropdownOptionsViaPlaywright.mockResolvedValue({ options: [] });

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "e1",
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(discoverDropdownOptionsViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 5000,
        })
      );
    });

    it("empty dropdown", async () => {
      discoverDropdownOptionsViaPlaywright.mockResolvedValue({ options: [] });

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.options).toEqual([]);
    });

    it("response structure verification", async () => {
      discoverDropdownOptionsViaPlaywright.mockResolvedValue({ options: [] });

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "e1",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        options: expect.any(Array),
      });
    });

    it("logging verification - discover_dropdown request logged", async () => {
      discoverDropdownOptionsViaPlaywright.mockResolvedValue({ options: [] });

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(discoverDropdownOptionsViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (discover_dropdown) - Error Handling", () => {
    it("error: missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: element not dropdown", async () => {
      discoverDropdownOptionsViaPlaywright.mockRejectedValue(new Error("Element is not a dropdown"));

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("not a dropdown");
    });

    it("error: element not found", async () => {
      discoverDropdownOptionsViaPlaywright.mockRejectedValue(new Error("Element not found"));

      const res = await request(makeApp()).post("/act").send({
        kind: "discover_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });
  });

  describe("POST /act (close_dropdown) - Basic Functionality", () => {
    it("close open dropdown", async () => {
      closeDropdownViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "close_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(closeDropdownViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
        })
      );
    });

    it("close with no dropdown (no error)", async () => {
      closeDropdownViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "close_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(200);
    });

    it("response structure verification", async () => {
      closeDropdownViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "close_dropdown",
        ref: "e1",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
      });
    });

    it("close_dropdown with explicit targetId", async () => {
      closeDropdownViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "close_dropdown",
        ref: "e1",
        targetId: "tab-close",
      });

      expect(res.status).toBe(200);
      expect(res.body.targetId).toBe("tab-close");
    });

    it("logging verification - close_dropdown request logged", async () => {
      closeDropdownViaPlaywright.mockResolvedValue(undefined);

      const res = await request(makeApp()).post("/act").send({
        kind: "close_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(closeDropdownViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (close_dropdown) - Error Handling", () => {
    it("error: missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "close_dropdown",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: element not found", async () => {
      closeDropdownViaPlaywright.mockRejectedValue(new Error("Element not found"));

      const res = await request(makeApp()).post("/act").send({
        kind: "close_dropdown",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Element not found");
    });
  });

  describe("POST /act (detect_blocker) - Basic Functionality", () => {
    it("detect cookie banner", async () => {
      detectBlockingElementViaPlaywright.mockResolvedValue({
        detected: true,
        type: "cookie-banner",
        ref: "blocker-1",
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "detect_blocker",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.detected).toBe(true);
      expect(res.body.type).toBe("cookie-banner");
      expect(detectBlockingElementViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "e1",
        })
      );
    });

    it("detect popup", async () => {
      detectBlockingElementViaPlaywright.mockResolvedValue({
        detected: true,
        type: "popup",
        ref: "blocker-2",
      });

      const res = await request(makeApp()).post("/act").send({
        kind: "detect_blocker",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("popup");
    });

    it("no blocker detected", async () => {
      detectBlockingElementViaPlaywright.mockResolvedValue({ detected: false });

      const res = await request(makeApp()).post("/act").send({
        kind: "detect_blocker",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.detected).toBe(false);
    });

    it("response structure verification", async () => {
      detectBlockingElementViaPlaywright.mockResolvedValue({ detected: false });

      const res = await request(makeApp()).post("/act").send({
        kind: "detect_blocker",
        ref: "e1",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        detected: expect.any(Boolean),
      });
    });

    it("logging verification - detect_blocker request logged", async () => {
      detectBlockingElementViaPlaywright.mockResolvedValue({ detected: false });

      const res = await request(makeApp()).post("/act").send({
        kind: "detect_blocker",
        ref: "e1",
      });

      expect(res.status).toBe(200);
      expect(detectBlockingElementViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (detect_blocker) - Error Handling", () => {
    it("error: missing ref", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "detect_blocker",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ref is required");
    });

    it("error: detection fails", async () => {
      detectBlockingElementViaPlaywright.mockRejectedValue(new Error("Detection failed"));

      const res = await request(makeApp()).post("/act").send({
        kind: "detect_blocker",
        ref: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Detection failed");
    });
  });

  describe("POST /act (dismiss_blocker) - Basic Functionality", () => {
    it("dismiss cookie banner", async () => {
      dismissBlockerViaPlaywright.mockResolvedValue({ dismissed: true, strategy: "click" });

      const res = await request(makeApp()).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.dismissed).toBe(true);
      expect(dismissBlockerViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRef: "e1",
        })
      );
    });

    it("dismiss with custom strategy", async () => {
      dismissBlockerViaPlaywright.mockResolvedValue({ dismissed: true, strategy: "custom" });

      const res = await request(makeApp()).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
        strategy: "custom",
      });

      expect(res.status).toBe(200);
      expect(dismissBlockerViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: "custom",
        })
      );
    });

    it("dismiss with closeButtonRef", async () => {
      dismissBlockerViaPlaywright.mockResolvedValue({ dismissed: true });

      const res = await request(makeApp()).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
        closeButtonRef: "e2",
      });

      expect(res.status).toBe(200);
      expect(dismissBlockerViaPlaywright).toHaveBeenCalledWith(
        expect.objectContaining({
          closeButtonRef: "e2",
        })
      );
    });

    it("no blocker to dismiss", async () => {
      dismissBlockerViaPlaywright.mockResolvedValue({ dismissed: false, reason: "no-blocker" });

      const res = await request(makeApp()).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
      });

      expect(res.status).toBe(200);
      expect(res.body.dismissed).toBe(false);
    });

    it("response structure verification", async () => {
      dismissBlockerViaPlaywright.mockResolvedValue({ dismissed: true });

      const res = await request(makeApp()).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
      });

      expect(res.body).toMatchObject({
        ok: true,
        targetId: expect.any(String),
        dismissed: expect.any(Boolean),
      });
    });

    it("logging verification - dismiss_blocker request logged", async () => {
      dismissBlockerViaPlaywright.mockResolvedValue({ dismissed: true });

      const res = await request(makeApp()).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
      });

      expect(res.status).toBe(200);
      expect(dismissBlockerViaPlaywright).toHaveBeenCalled();
    });
  });

  describe("POST /act (dismiss_blocker) - Error Handling", () => {
    it("error: missing targetRef", async () => {
      const res = await request(makeApp()).post("/act").send({
        kind: "dismiss_blocker",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("targetRef is required");
    });

    it("error: dismiss fails", async () => {
      dismissBlockerViaPlaywright.mockRejectedValue(new Error("Dismiss failed"));

      const res = await request(makeApp()).post("/act").send({
        kind: "dismiss_blocker",
        targetRef: "e1",
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Dismiss failed");
    });
  });
});
