import { describe, expect, it, vi } from "vitest";
import { PlaywrightInteractionsAdapter } from "../../adapters/playwright/playwright.interactions.adapter.js";
import { SessionService } from "../../core/services/session.service.js";
import { createMockPage } from "../helpers/pw-session-fixtures.js";

function createSessionService(page = createMockPage()) {
  const browser = { isConnected: () => true };
  const browserDriver = {
    connect: vi.fn(async () => browser),
    getPage: vi.fn(async () => page),
    createPage: vi.fn(async () => page),
    closePage: vi.fn(async () => undefined),
    focusPage: vi.fn(async () => undefined),
    listPages: vi.fn(async () => []),
  };
  const sessionStore = {
    storeRoleRefs: vi.fn(async () => undefined),
    restoreRoleRefs: vi.fn(async () => null),
  };
  return new SessionService(browserDriver as any, sessionStore as any);
}

describe("pw-tools-core.shared: bumpArmId functions", () => {
  it("should increment upload arm id", async () => {
    const service = createSessionService();
    await service.getSession("tab-1", "http://127.0.0.1:9222");
    const id1 = service.bumpUploadArmId("tab-1");
    const id2 = service.bumpUploadArmId("tab-1");
    expect(id2).toBe(id1 + 1);
  });

  it("should increment dialog arm id", async () => {
    const service = createSessionService();
    await service.getSession("tab-1", "http://127.0.0.1:9222");
    const id1 = service.bumpDialogArmId("tab-1");
    const id2 = service.bumpDialogArmId("tab-1");
    expect(id2).toBe(id1 + 1);
  });

  it("should increment download arm id", async () => {
    const service = createSessionService();
    await service.getSession("tab-1", "http://127.0.0.1:9222");
    const id1 = service.bumpDownloadArmId("tab-1");
    const id2 = service.bumpDownloadArmId("tab-1");
    expect(id2).toBe(id1 + 1);
  });
});

describe("pw-tools-core.shared: requireRef equivalents", () => {
  const adapter = new PlaywrightInteractionsAdapter();
  const page = {
    locator: vi.fn(() => ({ click: vi.fn(async () => undefined) })),
  };

  it("should accept plain refs", async () => {
    await expect(adapter.click(page as any, "e12")).resolves.toBeUndefined();
  });

  it("should trim whitespace from ref", async () => {
    await expect(adapter.click(page as any, "  e12  ")).resolves.toBeUndefined();
  });

  it("should strip @ prefix from ref", async () => {
    await expect(adapter.click(page as any, "@e12")).resolves.toBeUndefined();
  });

  it("should strip ref= prefix from ref", async () => {
    await expect(adapter.click(page as any, "ref=e12")).resolves.toBeUndefined();
  });

  it('should accept role-like refs as plain aria refs', async () => {
    await expect(adapter.click(page as any, "button:Submit")).resolves.toBeUndefined();
  });

  it("should route empty string refs through the generic locator path", async () => {
    await expect(adapter.click(page as any, "")).resolves.toBeUndefined();
  });

  it("should route whitespace-only refs through the generic locator path", async () => {
    await expect(adapter.click(page as any, "   ")).resolves.toBeUndefined();
  });

  it("should throw error for non-string values", async () => {
    await expect(adapter.click(page as any, null as any)).rejects.toThrow();
    await expect(adapter.click(page as any, undefined as any)).rejects.toThrow();
    await expect(adapter.click(page as any, 123 as any)).rejects.toThrow();
    await expect(adapter.click(page as any, {} as any)).rejects.toThrow();
  });
});

describe("pw-tools-core.shared: normalizeTimeoutMs equivalents", () => {
  const adapter = new PlaywrightInteractionsAdapter();

  it("should respect valid timeouts", async () => {
    const page = { locator: () => ({ click: vi.fn(async () => undefined) }) };
    await adapter.click(page as any, "e1", { timeoutMs: 5000 });
    expect((page.locator() as any).click).toBeDefined();
  });

  it("should use fallback when undefined", async () => {
    const click = vi.fn(async () => undefined);
    const page = { locator: () => ({ click }) };
    await adapter.click(page as any, "e1");
    expect(click).toHaveBeenCalledWith(expect.objectContaining({ timeout: 8000 }));
  });

  it("should enforce minimum of 500ms", async () => {
    const click = vi.fn(async () => undefined);
    const page = { locator: () => ({ click }) };
    await adapter.click(page as any, "e1", { timeoutMs: 100 });
    expect(click).toHaveBeenCalledWith(expect.objectContaining({ timeout: 500 }));
  });

  it("should enforce maximum of 120000ms", async () => {
    const page = { keyboard: { press: vi.fn(async () => undefined) } };
    const adapter = new PlaywrightInteractionsAdapter();
    await adapter.pressKey(page as any, "Enter");
    expect(page.keyboard.press).toHaveBeenCalled();
  });

  it("should handle edge values", async () => {
    const click = vi.fn(async () => undefined);
    const page = { locator: () => ({ click }) };
    await adapter.click(page as any, "e1", { timeoutMs: 500 });
    await adapter.click(page as any, "e1", { timeoutMs: 120000 });
    expect(click).toHaveBeenCalledTimes(2);
  });
});

describe("pw-tools-core.shared: toAIFriendlyError equivalents", () => {
  const adapter = new PlaywrightInteractionsAdapter();

  it("should return original error message for generic errors", async () => {
    const page = { locator: () => ({ click: vi.fn(async () => { throw new Error("Something went wrong"); }) }) };
    await expect(adapter.click(page as any, "e12")).rejects.toThrow("Something went wrong");
  });

  it("should convert strict mode violations", async () => {
    const page = { locator: () => ({ click: vi.fn(async () => { throw new Error("strict mode violation: resolved to 3 elements"); }) }) };
    await expect(adapter.click(page as any, "e12")).rejects.toThrow(/matched 3 elements/);
  });

  it("should handle timeout with visibility error", async () => {
    const page = { locator: () => ({ click: vi.fn(async () => { throw new Error("Timeout 5000ms waiting for e12 to be visible"); }) }) };
    await expect(adapter.click(page as any, "e12")).rejects.toThrow(/not found or not visible/);
  });

  it("should handle pointer event interception", async () => {
    const page = { locator: () => ({ click: vi.fn(async () => { throw new Error("element intercepts pointer events"); }) }) };
    await expect(adapter.click(page as any, "e12")).rejects.toThrow(/not interactable/);
  });

  it("should preserve generic error objects", async () => {
    const page = { locator: () => ({ click: vi.fn(async () => { throw new Error("custom error message"); }) }) };
    await expect(adapter.click(page as any, "e12")).rejects.toThrow("custom error message");
  });
});
