import type { Container } from './container.types.js';
import type { AppConfig } from '../config/config.types.js';
import { createSubsystemLogger } from '../adapters/logging/pino-logger.adapter.js';
import { PlaywrightBrowserDriverAdapter } from '../adapters/playwright/playwright.browser-driver.adapter.js';
import { InMemorySessionStoreAdapter } from '../adapters/utils/in-memory-session-store.adapter.js';
import { InMemoryEventBusAdapter } from '../adapters/utils/in-memory-event-bus.adapter.js';

/**
 * Create dependency injection container
 */
export function createContainer(config: AppConfig): Container {
  // Infrastructure & Adapters
  const logger = createSubsystemLogger('app');
  const browserDriver = new PlaywrightBrowserDriverAdapter();
  const sessionStore = new InMemorySessionStoreAdapter();
  const eventBus = new InMemoryEventBusAdapter();

  const container: Container = {
    // Configuration
    config,

    // Infrastructure
    logger,
    browserDriver,
    sessionStore,
    eventBus,
  };

  logger.info('container created', {
    browser_enabled: config.browser.enabled,
    headless: config.browser.headless,
  });

  return container;
}
