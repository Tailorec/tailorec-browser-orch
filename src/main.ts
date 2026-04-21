import 'dotenv/config';
import process from 'node:process';
import { loadConfig, resolveProfile } from './config/config.js';
import { createContainer } from './container/container.js';
import {
  createSubsystemLogger,
  initializeLogging,
} from './adapters/logging/logger.adapter.js';
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
  RunSessionController,
} from './api/controllers/index.js';
import {
  registerActionRoutes,
  registerBasicRoutes,
  registerControlRoutes,
  registerHooksRoutes,
  registerMediaRoutes,
  registerRunSessionRoutes,
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

  const container = createContainer(config);
  const {
    expressServer,
    middleware,
    browserDriver,
    browserRuntime,
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
    isBrowserAvailable: (profile, running) => browserRuntime.isAvailable(profile, running),
    ensureBrowser: (profile) => browserRuntime.ensureBrowser(profile),
    releaseBrowser: (profile, running) => browserRuntime.releaseBrowser(profile, running),
    listPages: async (browserEndpoint) => {
      const browser = await browserDriver.connect(browserEndpoint);
      const pages = await browserDriver.listPages(browser);
      return pages.map((entry) => ({
        targetId: entry.targetId,
        url: entry.url ?? '',
        title: entry.title,
      }));
    },
    focusPage: async (browserEndpoint, targetId) => {
      const browser = await browserDriver.connect(browserEndpoint);
      const page = await browserDriver.getPage(browser, targetId);
      await browserDriver.focusPage(page);
    },
    createPage: async (browserEndpoint, url) => {
      const browser = await browserDriver.connect(browserEndpoint);
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
    browserContext,
  );
  const compatController = new ActionCompatController(
    simpleController,
    formController,
    advancedController,
    config.browser.evaluateEnabled,
  );
  const controlController = new ControlController();
  const basicController = new BasicController(browserContext);
  const runSessionController = new RunSessionController(browserContext);

  const app = expressServer.getApp();
  expressServer.useJsonParser('50mb');

  registerBasicRoutes(app, basicController, middleware);
  registerControlRoutes(app, controlController, middleware);
  registerSnapshotRoutes(app, snapshotController, middleware);
  registerHooksRoutes(app, hooksController, middleware);
  registerMediaRoutes(app, mediaController, middleware);
  registerRunSessionRoutes(app, runSessionController, middleware);
  registerActionRoutes(app, simpleController, formController, advancedController, compatController, middleware);
  app.use(middleware.error);

  const started = await expressServer.start({ port: config.port, host: config.host });
  state = {
    server: started.server,
    port: started.port,
    configuredProfiles,
    profiles: new Map(),
    runSessions: new Map(),
    targetOwners: new Map(),
  };

  installControlLiveWebSocketServer(started.server, browserContext, sessionService);
  log.info('Service ready', { port: started.port, profiles: Array.from(configuredProfiles.keys()) });
}

void main();
