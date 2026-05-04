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
import { InMemoryBrowserlessAllocatorAdapter } from './adapters/browser/in-memory-browserless-allocator.adapter.js';

const log = createSubsystemLogger('main');

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

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
    environment: config.nodeEnv,
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
  const browserlessAllocator = new InMemoryBrowserlessAllocatorAdapter({
    maxSessionsPerWorker: parsePositiveInt(process.env.BROWSER_BROWSERLESS_SESSIONS_PER_WORKER, 5),
    maxTotalSessions: parsePositiveInt(process.env.BROWSER_BROWSERLESS_MAX_TOTAL_SESSIONS, 20),
  });
  const browserContext = createBrowserRouteContext({
    getState: () => state,
    isBrowserAvailable: (profile, running) => browserRuntime.isAvailable(profile, running),
    ensureBrowser: (profile) => browserRuntime.ensureBrowser(profile),
    releaseBrowser: (profile, running) => browserRuntime.releaseBrowser(profile, running),
    connectBrowserEndpoint: async (browserEndpoint) => {
      await browserDriver.connect(browserEndpoint);
    },
    disconnectBrowserEndpoint: async (browserEndpoint) => {
      const driver = browserDriver as typeof browserDriver & {
        disconnectByCdpUrl?: (cdpUrl: string) => Promise<void>;
      };
      if (driver.disconnectByCdpUrl) {
        await driver.disconnectByCdpUrl(browserEndpoint);
      }
    },
    probeBrowserEndpoint: async (browserEndpoint) => {
      const browser = await browserDriver.connect(browserEndpoint);
      await browserDriver.listPages(browser);
    },
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
      const before = await browserDriver.listPages(browser);
      const beforeIds = new Set(before.map((entry) => entry.targetId));
      await browserDriver.createPage(browser, url ?? 'about:blank');
      const after = await browserDriver.listPages(browser);
      const created = after.find((entry) => !beforeIds.has(entry.targetId));
      if (!created) {
        throw new Error('failed to resolve created tab target id');
      }
      const focusedPage = await browserDriver.getPage(browser, created.targetId, browserEndpoint);
      return {
        targetId: created.targetId,
        url: focusedPage.url(),
      };
    },
    browserlessAllocator,
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

  const orphanReconciliation = await browserlessAllocator.reconcileOrphans();
  log.info('browserless allocator reconciled startup orphans', {
    discovered_workers: orphanReconciliation.discoveredWorkerCount,
    stopped_workers: orphanReconciliation.stoppedWorkerCount,
  });

  installControlLiveWebSocketServer(started.server, browserContext, sessionService);
  log.info('Service ready', { port: started.port, profiles: Array.from(configuredProfiles.keys()) });
}

void main();
