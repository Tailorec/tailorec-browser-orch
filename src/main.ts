import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { loadConfig, resolveProfile } from './config/config.js';
import {
  createSubsystemLogger,
  initializeLogging,
} from './adapters/logging/logger.adapter.js';
import { ExpressServerAdapter } from './adapters/http/express.server.adapter.js';
import { createMiddlewareRegistry } from './api/middlewares/index.js';
import { ChromeLauncherAdapter } from './adapters/chrome/chrome-launcher.adapter.js';
import { PlaywrightBrowserDriverAdapter } from './adapters/playwright/playwright.browser-driver.adapter.js';
import { InMemorySessionStoreAdapter } from './adapters/utils/in-memory-session-store.adapter.js';
import { InMemoryEventBusAdapter } from './adapters/utils/in-memory-event-bus.adapter.js';
import { SessionService } from './core/services/session.service.js';
import { InteractionService } from './core/services/interaction.service.js';
import { DiscoveryService } from './core/services/discovery.service.js';
import { SnapshotService } from './core/services/snapshot.service.js';
import { ExecuteActionUseCase } from './core/use-cases/execute-action.use-case.js';
import { TakeSnapshotUseCase } from './core/use-cases/take-snapshot.use-case.js';
import { createBrowserRouteContext, type BrowserServerState } from './api/context/browser.context.js';
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
} from './api/controllers/index.js';
import { PlaywrightNavigationAdapter } from './adapters/playwright/playwright.navigation.adapter.js';
import { PlaywrightInteractionsAdapter } from './adapters/playwright/playwright.interactions.adapter.js';
import {
  registerActionRoutes,
  registerBasicRoutes,
  registerControlRoutes,
  registerHooksRoutes,
  registerMediaRoutes,
  registerSnapshotRoutes,
} from './api/routes/index.js';
import { installControlLiveWebSocketServer } from './adapters/http/control-live.server.js';

const log = createSubsystemLogger('main');

process.on('uncaughtException', (err) => {
  log.exception('Uncaught exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.exception('Unhandled promise rejection', reason);
  process.exit(1);
});

async function main() {
  const config = loadConfig();
  initializeLogging({
    level: config.logging.level,
    format: config.logging.format,
    logToFile: config.logging.toFile,
    logFilePath: config.logging.filePath,
    logMaxBytes: config.logging.maxBytes,
    logBackupCount: config.logging.backupCount,
  });

  if (!config.browser.enabled) {
    log.error('Browser service disabled by configuration');
    process.exit(1);
  }

  const expressServer = new ExpressServerAdapter();
  const middleware = createMiddlewareRegistry();
  const chromeLauncher = new ChromeLauncherAdapter();
  const browserDriver = new PlaywrightBrowserDriverAdapter();
  const sessionStore = new InMemorySessionStoreAdapter();
  const eventBus = new InMemoryEventBusAdapter();
  const sessionService = new SessionService(browserDriver, sessionStore);
  const interactionService = new InteractionService();
  const discoveryService = new DiscoveryService();
  const snapshotService = new SnapshotService();
  const executeActionUseCase = new ExecuteActionUseCase(
    sessionService,
    interactionService,
    discoveryService,
    eventBus,
  );
  const takeSnapshotUseCase = new TakeSnapshotUseCase(sessionService, snapshotService, eventBus);
  const navigationAdapter = new PlaywrightNavigationAdapter();
  const interactionsAdapter = new PlaywrightInteractionsAdapter();

  const resolvedProfiles = new Map();
  for (const name of Object.keys(config.browser.profiles)) {
    const profile = resolveProfile(config.browser, name);
    if (profile) {
      resolvedProfiles.set(name, { name, config: profile });
    }
  }

  let state: BrowserServerState | null = null;
  const browserContext = createBrowserRouteContext({
    getState: () => state,
    isChromeReachable: (cdpUrl, timeoutMs) => chromeLauncher.isReachable(cdpUrl, timeoutMs),
    launchChrome: async (profile) =>
      chromeLauncher.launch({
        cdpPort: profile.cdpPort,
        headless: config.browser.headless,
        noSandbox: config.browser.noSandbox,
        viewport: config.browser.viewport,
        userDataDir: path.join(os.tmpdir(), `openclaw-browser-${profile.name}`),
      }),
    stopChrome: async (chrome) => {
      if (!chrome) {
        return;
      }
      const running = chromeLauncher.getRunning(chrome.cdpPort);
      if (running) {
        await chromeLauncher.stop(running);
      }
    },
    listPages: async (cdpUrl) => {
      const browser = await browserDriver.connect(cdpUrl);
      return browserDriver.listPages(browser);
    },
    focusPage: async (cdpUrl, targetId) => {
      const browser = await browserDriver.connect(cdpUrl);
      const page = await browserDriver.getPage(browser, targetId, cdpUrl);
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
  const mediaController = new MediaController(
    sessionService,
    navigationAdapter,
    interactionsAdapter,
    browserContext,
  );
  const compatController = new ActionCompatController(
    simpleController,
    formController,
    advancedController,
    hooksController,
    mediaController,
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
    profiles: resolvedProfiles,
  };

  installControlLiveWebSocketServer(started.server, browserContext, browserDriver);
  log.info('Service ready', { port: started.port, profiles: Array.from(resolvedProfiles.keys()) });
}

void main();
