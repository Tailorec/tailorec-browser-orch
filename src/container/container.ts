import type { Container } from './container.types.js';
import type { AppConfig } from '../config/config.types.js';
import { createSubsystemLogger } from '../adapters/logging/pino-logger.adapter.js';

/**
 * Create in-memory session store
 */
function createInMemorySessionStore(): Container['sessionStore'] {
  const store = new Map<string, any>();

  return {
    async get(sessionId: string) {
      return store.get(sessionId);
    },
    async set(sessionId: string, data: any) {
      store.set(sessionId, data);
    },
    async delete(sessionId: string) {
      store.delete(sessionId);
    },
    async has(sessionId: string) {
      return store.has(sessionId);
    },
  };
}

/**
 * Create in-memory event bus
 */
function createInMemoryEventBus(): Container['eventBus'] {
  const subscribers = new Map<string, Set<(event: unknown) => void>>();

  return {
    async publish(channel: string, event: unknown) {
      const handlers = subscribers.get(channel);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            // Log error but don't fail publish
            console.error(`Event bus error handling event on channel ${channel}:`, error);
          }
        });
      }
    },
    subscribe(channel: string, handler: (event: unknown) => void) {
      if (!subscribers.has(channel)) {
        subscribers.set(channel, new Set());
      }
      subscribers.get(channel)!.add(handler);

      // Return unsubscribe function
      return () => {
        subscribers.get(channel)?.delete(handler);
      };
    },
  };
}

/**
 * Create stub browser driver
 */
function createBrowserDriver(): Container['browserDriver'] {
  let connected = false;
  let currentCdpUrl: string | null = null;

  return {
    async connect(cdpUrl: string) {
      currentCdpUrl = cdpUrl;
      connected = true;
    },
    async disconnect() {
      currentCdpUrl = null;
      connected = false;
    },
    isConnected() {
      return connected;
    },
  };
}

/**
 * Create stub snapshot adapter
 */
function createSnapshotAdapter(): Container['snapshotAdapter'] {
  return {
    async takeSnapshot() {
      // Stub implementation
      return { html: '', screenshot: null };
    },
  };
}

/**
 * Create stub interactions adapter
 */
function createInteractionsAdapter(): Container['interactionsAdapter'] {
  return {
    async click(ref: string) {
      // Stub implementation
    },
    async type(ref: string, text: string) {
      // Stub implementation
    },
  };
}

/**
 * Create stub discovery adapter
 */
function createDiscoveryAdapter(): Container['discoveryAdapter'] {
  return {
    async findElement(ref: string) {
      // Stub implementation
      return null;
    },
  };
}

/**
 * Create dependency injection container
 */
export function createContainer(config: AppConfig): Container {
  // Infrastructure
  const logger = createSubsystemLogger('app');
  const browserDriver = createBrowserDriver();
  const sessionStore = createInMemorySessionStore();
  const eventBus = createInMemoryEventBus();

  // Adapters
  const snapshotAdapter = createSnapshotAdapter();
  const interactionsAdapter = createInteractionsAdapter();
  const discoveryAdapter = createDiscoveryAdapter();

  const container: Container = {
    // Configuration
    config,

    // Infrastructure
    logger,
    browserDriver,
    sessionStore,
    eventBus,

    // Adapters
    snapshotAdapter,
    interactionsAdapter,
    discoveryAdapter,
  };

  logger.info('container created', {
    browser_enabled: config.browser.enabled,
    headless: config.browser.headless,
  });

  return container;
}
