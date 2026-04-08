import type { AppConfig } from '../config/config.types.js';
import type { Logger } from '../adapters/logging/logger.adapter.js';
import type { IBrowserDriver } from '../core/ports/browser-driver.port.js';
import type { IBrowserRuntime } from '../core/ports/browser-runtime.port.js';
import type { ISessionStore } from '../core/ports/session-store.port.js';
import type { IEventBus } from '../core/ports/event-bus.port.js';
import type { ExpressServerAdapter } from '../adapters/http/express.server.adapter.js';
import type { PlaywrightNavigationAdapter } from '../adapters/playwright/playwright.navigation.adapter.js';
import type { PlaywrightInteractionsAdapter } from '../adapters/playwright/playwright.interactions.adapter.js';
import type { MiddlewareRegistry } from '../api/middlewares/index.js';
import type { SessionService } from '../core/services/session.service.js';
import type { InteractionService } from '../core/services/interaction.service.js';
import type { DiscoveryService } from '../core/services/discovery.service.js';
import type { SnapshotService } from '../core/services/snapshot.service.js';
import type { NavigationService } from '../core/services/navigation.service.js';
import type { ExecuteActionUseCase } from '../core/use-cases/execute-action.use-case.js';
import type { TakeSnapshotUseCase } from '../core/use-cases/take-snapshot.use-case.js';
import type { StartSessionUseCase } from '../core/use-cases/start-session.use-case.js';
import type { GenerateControlTokenUseCase } from '../core/use-cases/generate-control-token.use-case.js';

/**
 * Main container interface holding all dependencies
 */
export interface Container {
  // Configuration
  config: AppConfig;

  // Infrastructure
  logger: Logger;
  expressServer: ExpressServerAdapter;
  middleware: MiddlewareRegistry;
  browserDriver: IBrowserDriver;
  browserRuntime: IBrowserRuntime;
  navigationAdapter: PlaywrightNavigationAdapter;
  interactionsAdapter: PlaywrightInteractionsAdapter;
  sessionStore: ISessionStore;
  eventBus: IEventBus;

  // Core services
  sessionService: SessionService;
  interactionService: InteractionService;
  discoveryService: DiscoveryService;
  snapshotService: SnapshotService;
  navigationService: NavigationService;

  // Use cases
  executeActionUseCase: ExecuteActionUseCase;
  takeSnapshotUseCase: TakeSnapshotUseCase;
  startSessionUseCase: StartSessionUseCase;
  generateControlTokenUseCase: GenerateControlTokenUseCase;
}

/**
 * Type for container keys
 */
export type ContainerKey = keyof Container;
