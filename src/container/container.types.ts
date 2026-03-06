import type { AppConfig } from '../config/config.types.js';
import type { Logger } from '../adapters/logging/pino-logger.adapter.js';
import type { IBrowserDriver } from '../core/ports/browser-driver.port.js';
import type { ISessionStore } from '../core/ports/session-store.port.js';
import type { IEventBus } from '../core/ports/event-bus.port.js';

/**
 * Main container interface holding all dependencies
 */
export interface Container {
  // Configuration
  config: AppConfig;

  // Infrastructure
  logger: Logger;
  browserDriver: IBrowserDriver;
  sessionStore: ISessionStore;
  eventBus: IEventBus;
}

/**
 * Type for container keys
 */
export type ContainerKey = keyof Container;
