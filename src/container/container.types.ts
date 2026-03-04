import type { AppConfig } from '../config/config.types.js';
import type { Logger } from '../adapters/logging/pino-logger.adapter.js';

/**
 * Browser driver interface for controlling browser instances
 */
export interface IBrowserDriver {
  connect: (cdpUrl: string) => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: () => boolean;
}

/**
 * Session store interface for managing browser sessions
 */
export interface ISessionStore {
  get: (sessionId: string) => Promise<any>;
  set: (sessionId: string, data: any) => Promise<void>;
  delete: (sessionId: string) => Promise<void>;
  has: (sessionId: string) => Promise<boolean>;
}

/**
 * Event bus interface for pub/sub messaging
 */
export interface IEventBus {
  publish: (channel: string, event: unknown) => Promise<void>;
  subscribe: (channel: string, handler: (event: unknown) => void) => () => void;
}

/**
 * Snapshot adapter interface
 */
export interface ISnapshotAdapter {
  takeSnapshot: () => Promise<any>;
}

/**
 * Interactions adapter interface
 */
export interface IInteractionsAdapter {
  click: (ref: string) => Promise<void>;
  type: (ref: string, text: string) => Promise<void>;
}

/**
 * Discovery adapter interface
 */
export interface IDiscoveryAdapter {
  findElement: (ref: string) => Promise<any>;
}

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

  // Adapters
  snapshotAdapter: ISnapshotAdapter;
  interactionsAdapter: IInteractionsAdapter;
  discoveryAdapter: IDiscoveryAdapter;
}

/**
 * Type for container keys
 */
export type ContainerKey = keyof Container;
