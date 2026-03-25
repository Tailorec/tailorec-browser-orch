import type { Container } from './container.types.js';
import type { AppConfig } from '../config/config.types.js';
import { createSubsystemLogger } from '../adapters/logging/logger.adapter.js';
import { ExpressServerAdapter } from '../adapters/http/express.server.adapter.js';
import { createMiddlewareRegistry } from '../api/middlewares/index.js';
import { ChromeLauncherAdapter } from '../adapters/chrome/chrome-launcher.adapter.js';
import { PlaywrightBrowserDriverAdapter } from '../adapters/playwright/playwright.browser-driver.adapter.js';
import { PlaywrightNavigationAdapter } from '../adapters/playwright/playwright.navigation.adapter.js';
import { PlaywrightInteractionsAdapter } from '../adapters/playwright/playwright.interactions.adapter.js';
import { InMemorySessionStoreAdapter } from '../adapters/utils/in-memory-session-store.adapter.js';
import { InMemoryEventBusAdapter } from '../adapters/utils/in-memory-event-bus.adapter.js';
import { SessionService } from '../core/services/session.service.js';
import { InteractionService } from '../core/services/interaction.service.js';
import { DiscoveryService } from '../core/services/discovery.service.js';
import { SnapshotService } from '../core/services/snapshot.service.js';
import { NavigationService } from '../core/services/navigation.service.js';
import { ExecuteActionUseCase } from '../core/use-cases/execute-action.use-case.js';
import { TakeSnapshotUseCase } from '../core/use-cases/take-snapshot.use-case.js';
import { StartSessionUseCase } from '../core/use-cases/start-session.use-case.js';
import { DefaultGenerateControlTokenUseCase } from '../core/use-cases/generate-control-token.use-case.js';

/**
 * Create dependency injection container
 */
export function createContainer(config: AppConfig): Container {
  const logger = createSubsystemLogger('app');
  const expressServer = new ExpressServerAdapter();
  const middleware = createMiddlewareRegistry();
  const chromeLauncher = new ChromeLauncherAdapter();
  const browserDriver = new PlaywrightBrowserDriverAdapter();
  const navigationAdapter = new PlaywrightNavigationAdapter();
  const interactionsAdapter = new PlaywrightInteractionsAdapter();
  const sessionStore = new InMemorySessionStoreAdapter();
  const eventBus = new InMemoryEventBusAdapter();
  const sessionService = new SessionService(browserDriver, sessionStore);
  const interactionService = new InteractionService();
  const discoveryService = new DiscoveryService();
  const snapshotService = new SnapshotService();
  const navigationService = new NavigationService();
  const executeActionUseCase = new ExecuteActionUseCase(
    sessionService,
    interactionService,
    discoveryService,
    eventBus,
  );
  const takeSnapshotUseCase = new TakeSnapshotUseCase(sessionService, snapshotService, eventBus);
  const startSessionUseCase = new StartSessionUseCase(sessionService, navigationService, eventBus);
  const generateControlTokenUseCase = new DefaultGenerateControlTokenUseCase();

  const container: Container = {
    config,
    logger,
    expressServer,
    middleware,
    chromeLauncher,
    browserDriver,
    navigationAdapter,
    interactionsAdapter,
    sessionStore,
    eventBus,
    sessionService,
    interactionService,
    discoveryService,
    snapshotService,
    navigationService,
    executeActionUseCase,
    takeSnapshotUseCase,
    startSessionUseCase,
    generateControlTokenUseCase,
  };

  logger.info('container created', {
    browser_enabled: config.browser.enabled,
    headless: config.browser.headless,
  });

  return container;
}
