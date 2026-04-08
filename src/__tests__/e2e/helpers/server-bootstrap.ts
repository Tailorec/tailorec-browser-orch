import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { loadConfig, resolveProfile } from '../../../config/config.js';
import { createContainer } from '../../../container/container.js';
import {
  initializeLogging,
} from '../../../adapters/logging/logger.adapter.js';
import { createBrowserRouteContext, type BrowserServerState } from '../../../api/context/browser.context.js';
import {
  AdvancedActionController,
  BasicController,
  ControlController,
  FormActionController,
  HooksController,
  MediaController,
  SimpleActionController,
  SnapshotController,
  ActionCompatController,
} from '../../../api/controllers/index.js';
import {
  registerActionRoutes,
  registerBasicRoutes,
  registerControlRoutes,
  registerHooksRoutes,
  registerMediaRoutes,
  registerSnapshotRoutes,
} from '../../../api/routes/index.js';
import { installControlLiveWebSocketServer } from '../../../adapters/http/control-live.server.js';

type StartedTestServer = {
  port: number;
  server: Server;
};

let current:
  | {
      started: StartedTestServer;
      state: BrowserServerState;
      stop: () => Promise<void>;
    }
  | null = null;

export async function startBrowserControlServerFromConfig(): Promise<StartedTestServer> {
  if (current) {
    return current.started;
  }

  const config = loadConfig();
  initializeLogging({
    level: config.logging.level,
    format: config.logging.format,
    logToFile: false,
    logFilePath: config.logging.filePath,
    logMaxBytes: config.logging.maxBytes,
    logBackupCount: config.logging.backupCount,
  });

  const container = createContainer(config);
  const {
    expressServer,
    middleware,
    chromeLauncher,
    browserDriver,
    sessionService,
    discoveryService,
    executeActionUseCase,
    takeSnapshotUseCase,
    navigationAdapter,
  } = container;

  const configuredProfiles = new Map();
  for (const name of Object.keys(config.browser.profiles)) {
    const profile = resolveProfile(config.browser, name);
    if (profile) {
      configuredProfiles.set(name, profile);
    }
  }

  let state: BrowserServerState | null = null;
  const browserContext = createBrowserRouteContext({
    getState: () => state,
    isChromeReachable: (cdpUrl, timeoutMs) => chromeLauncher.isReachable(cdpUrl, timeoutMs),
    launchChrome: async (profile) =>
      chromeLauncher.launch({
        cdpPort: profile.browserPort ?? 9222,
        headless: config.browser.headless,
        noSandbox: config.browser.noSandbox,
        viewport: config.browser.viewport,
        userDataDir: path.join(os.tmpdir(), `openclaw-browser-${profile.name}`),
      }),
    stopChrome: async (chrome) => {
      if (!chrome) return;
      const running = chrome.browserPort == null ? undefined : chromeLauncher.getRunning(chrome.browserPort);
      if (running) {
        await chromeLauncher.stop(running);
      }
    },
    listPages: async (cdpUrl) => {
      const browser = await browserDriver.connect(cdpUrl);
      const pages = await browserDriver.listPages(browser);
      return pages.map((entry) => ({
        targetId: entry.targetId,
        url: entry.url ?? '',
        title: entry.title,
      }));
    },
    focusPage: async (cdpUrl, targetId) => {
      const browser = await browserDriver.connect(cdpUrl);
      const page = await browserDriver.getPage(browser, targetId);
      await browserDriver.focusPage(page);
    },
    createPage: async (cdpUrl, url) => {
      const browser = await browserDriver.connect(cdpUrl);
      const page = await browserDriver.createPage(browser, url);
      const pages = await browserDriver.listPages(browser);
      const found = pages.find((entry) => entry.url === page.url()) || pages[pages.length - 1];
      return {
        targetId: found?.targetId || '',
        url: page.url(),
      };
    },
  });

  const simpleController = new SimpleActionController(executeActionUseCase, browserContext);
  const formController = new FormActionController(executeActionUseCase, browserContext);
  const advancedController = new AdvancedActionController(
    executeActionUseCase,
    sessionService,
    discoveryService,
    browserContext,
    config.browser.evaluateEnabled,
  );
  const snapshotController = new SnapshotController(
    takeSnapshotUseCase,
    sessionService,
    discoveryService,
    browserContext,
  );
  const hooksController = new HooksController(sessionService, browserContext);
  const mediaController = new MediaController(sessionService, navigationAdapter, browserContext);
  const compatController = new ActionCompatController(
    simpleController,
    formController,
    advancedController,
    config.browser.evaluateEnabled,
  );
  const controlController = new ControlController();
  const basicController = new BasicController(browserContext);

  const app = expressServer.getApp();
  expressServer.useJsonParser('50mb');

  registerBasicRoutes(app, basicController, middleware);
  registerControlRoutes(app, controlController, middleware);
  registerSnapshotRoutes(app, snapshotController, middleware);
  registerHooksRoutes(app, hooksController, middleware);
  registerMediaRoutes(app, mediaController, middleware);
  registerActionRoutes(app, simpleController, formController, advancedController, compatController, middleware);
  app.use(middleware.error);

  const started = await expressServer.start({ port: config.port, host: config.host });
  state = {
    server: started.server,
    port: started.port,
    configuredProfiles,
    profiles: new Map(),
  };
  installControlLiveWebSocketServer(started.server, browserContext, sessionService);

  current = {
    started,
    state,
    stop: async () => {
      for (const running of state.profiles.values()) {
        if (running.chrome) {
          const active = running.chrome.browserPort == null
            ? undefined
            : chromeLauncher.getRunning(running.chrome.browserPort);
          if (active) {
            await chromeLauncher.stop(active);
          }
          running.chrome = undefined;
        }
      }
      await expressServer.stop();
    },
  };

  return started;
}

export async function stopBrowserControlServer(): Promise<void> {
  if (!current) return;
  const active = current;
  current = null;
  await active.stop();
}
