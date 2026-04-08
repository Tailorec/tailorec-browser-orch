import type { Router } from "express";
import { vi } from "vitest";
import { createTestApp, createBrowserContextMock } from "../../../helpers/test-helpers.js";
import { registerActionRoutes } from "../../../../api/routes/action.routes.js";
import { registerSnapshotRoutes } from "../../../../api/routes/snapshot.routes.js";
import { registerHooksRoutes } from "../../../../api/routes/hooks.routes.js";
import { registerMediaRoutes } from "../../../../api/routes/media.routes.js";
import { SimpleActionController } from "../../../../api/controllers/simple-action.controller.js";
import { FormActionController } from "../../../../api/controllers/form-action.controller.js";
import { AdvancedActionController } from "../../../../api/controllers/advanced-action.controller.js";
import { ActionCompatController } from "../../../../api/controllers/action-compat.controller.js";
import { SnapshotController } from "../../../../api/controllers/snapshot.controller.js";
import { HooksController } from "../../../../api/controllers/hooks.controller.js";
import { MediaController } from "../../../../api/controllers/media.controller.js";
import { DiscoveryService } from "../../../../core/services/discovery.service.js";
import { PlaywrightNavigationAdapter } from "../../../../adapters/playwright/playwright.navigation.adapter.js";

type HarnessOptions = {
  evaluateEnabled?: boolean;
  targetId?: string;
  pageUrl?: string;
  cdpUrl?: string;
  profileName?: string;
};

export function createActionRouteHarness(options: HarnessOptions = {}) {
  const executeActionUseCase = {
    execute: vi.fn(async ({ targetId }: { targetId?: string }) => ({
      ok: true,
      targetId: targetId ?? options.targetId ?? "tab-default",
      url: options.pageUrl ?? "https://example.org",
    })),
  } as any;

  const sessionService = {
    getPage: vi.fn(async () => ({ locator: vi.fn(), keyboard: { press: vi.fn() }, mouse: { click: vi.fn() } })),
    restoreRoleRefs: vi.fn(async () => undefined),
    refLocator: vi.fn(() => ({ click: vi.fn(), blur: vi.fn() })),
  } as any;

  const discoveryService = {
    queryElementState: vi.fn(async (_page, ref: string) => ({ ref, exists: true })),
    discoverDropdownOptions: vi.fn(async () => ({
      options: [],
      dropdownOpen: false,
      triggerMethod: "none",
    })),
    closeDropdown: vi.fn(async () => undefined),
    detectBlockingElement: vi.fn(async () => ({ isBlocked: false })),
    dismissBlocker: vi.fn(async () => ({ dismissed: true, strategy: "click_close" })),
  } as unknown as DiscoveryService;

  const { browserContext, profileCtx } = createBrowserContextMock();
  profileCtx.profile.name = options.profileName ?? "default";
  profileCtx.profile.browserEndpoint = options.cdpUrl ?? "http://127.0.0.1:9222";
  profileCtx.ensureTabAvailable = vi.fn(async (targetId?: string) => ({
    targetId: targetId ?? options.targetId ?? "tab-default",
    url: options.pageUrl ?? "https://example.org",
  }));

  const simpleController = new SimpleActionController(executeActionUseCase, browserContext as any);
  const formController = new FormActionController(executeActionUseCase, browserContext as any);
  const advancedController = new AdvancedActionController(
    executeActionUseCase,
    sessionService,
    discoveryService,
    browserContext as any,
    options.evaluateEnabled ?? true,
  );
  const compatController = new ActionCompatController(
    simpleController,
    formController,
    advancedController,
    options.evaluateEnabled ?? true,
  );

  const app = createTestApp((router: Router, middleware) => {
    registerActionRoutes(
      router,
      simpleController,
      formController,
      advancedController,
      compatController,
      middleware,
    );
  });

  return {
    app,
    executeActionUseCase,
    sessionService,
    discoveryService,
    browserContext,
    profileCtx,
  };
}

export function createSnapshotRouteHarness(options: HarnessOptions = {}) {
  const takeSnapshotUseCase = {
    execute: vi.fn(async ({ targetId }: { targetId?: string }) => ({
      ok: true,
      targetId: targetId ?? options.targetId ?? "tab-default",
      url: options.pageUrl ?? "https://example.org",
      snapshot: "# Test",
      refs: {},
    })),
  } as any;

  const sessionService = {
    getPage: vi.fn(async () => ({ locator: vi.fn(), keyboard: { press: vi.fn() }, mouse: { click: vi.fn() } })),
    restoreRoleRefs: vi.fn(async () => undefined),
    refLocator: vi.fn(() => ({ click: vi.fn(), blur: vi.fn() })),
  } as any;

  const discoveryService = {
    startDomObserver: vi.fn(async () => ({ observing: true })),
    stopDomObserver: vi.fn(async () => ({
      addedElements: [],
      removedElements: [],
      modifiedElements: [],
      urlChanged: false,
      previousUrl: options.pageUrl ?? "https://example.org",
      currentUrl: options.pageUrl ?? "https://example.org",
      observationDurationMs: 100,
    })),
  } as any;

  const { browserContext, profileCtx } = createBrowserContextMock();
  profileCtx.profile.name = options.profileName ?? "default";
  profileCtx.profile.browserEndpoint = options.cdpUrl ?? "http://127.0.0.1:9222";
  profileCtx.ensureTabAvailable = vi.fn(async (targetId?: string) => ({
    targetId: targetId ?? options.targetId ?? "tab-default",
    url: options.pageUrl ?? "https://example.org",
  }));

  const controller = new SnapshotController(
    takeSnapshotUseCase,
    sessionService,
    discoveryService,
    browserContext as any,
  );

  const app = createTestApp((router: Router, middleware) => {
    registerSnapshotRoutes(router, controller, middleware);
  });

  return {
    app,
    takeSnapshotUseCase,
    sessionService,
    discoveryService,
    browserContext,
    profileCtx,
  };
}

export function createHooksRouteHarness(options: HarnessOptions = {}) {
  const page = {
    locator: vi.fn(() => ({ setInputFiles: vi.fn() })),
  };

  const sessionService = {
    getPage: vi.fn(async () => page),
    restoreRoleRefs: vi.fn(async () => undefined),
    refLocator: vi.fn(() => ({ click: vi.fn(), setInputFiles: vi.fn() })),
    bumpUploadArmId: vi.fn(() => 1),
    getUploadArmId: vi.fn(() => 1),
    bumpDialogArmId: vi.fn(() => 1),
    getDialogArmId: vi.fn(() => 1),
    bumpDownloadArmId: vi.fn(() => 1),
    getDownloadArmId: vi.fn(() => 1),
  } as any;

  const { browserContext, profileCtx } = createBrowserContextMock();
  profileCtx.profile.name = options.profileName ?? "default";
  profileCtx.profile.browserEndpoint = options.cdpUrl ?? "http://127.0.0.1:9222";
  profileCtx.ensureTabAvailable = vi.fn(async (targetId?: string) => ({
    targetId: targetId ?? options.targetId ?? "tab-default",
    url: options.pageUrl ?? "https://example.org",
  }));

  const controller = new HooksController(sessionService, browserContext as any);

  const app = createTestApp((router: Router, middleware) => {
    registerHooksRoutes(router, controller, middleware);
  });

  return { app, sessionService, browserContext, profileCtx, page };
}

export function createMediaRouteHarness(options: HarnessOptions = {}) {
  const page = {
    locator: vi.fn(() => ({
      first: vi.fn(() => ({
        screenshot: vi.fn(async () => Buffer.from("element-shot")),
      })),
    })),
    evaluate: vi.fn(async () => ({ scrollX: 0, scrollY: 0, width: 1280, height: 720 })),
  };

  const refLocator = {
    screenshot: vi.fn(async () => Buffer.from("ref-shot")),
    highlight: vi.fn(async () => undefined),
    boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 100, height: 40 })),
  };

  const sessionService = {
    getPage: vi.fn(async () => page),
    restoreRoleRefs: vi.fn(async () => undefined),
    refLocator: vi.fn(() => refLocator),
  } as any;

  const navigationAdapter = {
    takeScreenshot: vi.fn(async () => ({ buffer: Buffer.from("page-shot") })),
  } as unknown as PlaywrightNavigationAdapter;

  const { browserContext, profileCtx } = createBrowserContextMock();
  profileCtx.profile.name = options.profileName ?? "default";
  profileCtx.profile.browserEndpoint = options.cdpUrl ?? "http://127.0.0.1:9222";
  profileCtx.ensureTabAvailable = vi.fn(async (targetId?: string) => ({
    targetId: targetId ?? options.targetId ?? "tab-default",
    url: options.pageUrl ?? "https://example.org",
  }));

  const controller = new MediaController(
    sessionService,
    navigationAdapter,
    browserContext as any,
  );

  const app = createTestApp((router: Router, middleware) => {
    registerMediaRoutes(router, controller, middleware);
  });

  return { app, sessionService, navigationAdapter, browserContext, profileCtx, page, refLocator };
}
