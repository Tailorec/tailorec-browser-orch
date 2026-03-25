/**
 * Event Bus Port
 * 
 * Defines the contract for domain event publishing.
 * Implemented by: InMemoryEventBusAdapter
 */

/**
 * Base interface for all domain events
 */
export interface IDomainEvent {
  /**
   * Event type identifier
   */
  type: string;

  /**
   * Event timestamp in ISO 8601 format
   */
  timestamp: string;

  /**
   * Aggregate ID the event relates to
   */
  aggregateId: string;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends IDomainEvent = IDomainEvent> = (event: T) => void;

/**
 * Port: Event Bus
 * 
 * Defines the contract for domain event publishing.
 * All adapter implementations must conform to this interface.
 */
export interface IEventBus {
  /**
   * Publish event to all subscribers
   * @param event - The event to publish
   */
  publish<T extends IDomainEvent>(event: T): void;

  /**
   * Subscribe to event type
   * @param eventType - The event type to subscribe to
   * @param handler - The event handler function
   */
  subscribe<T extends IDomainEvent>(eventType: string, handler: EventHandler<T>): void;

  /**
   * Unsubscribe from event type
   * @param eventType - The event type to unsubscribe from
   * @param handler - The event handler function to remove
   */
  unsubscribe<T extends IDomainEvent>(eventType: string, handler: EventHandler<T>): void;

  /**
   * Clear all subscriptions for an event type
   * @param eventType - The event type to clear
   */
  clear(eventType: string): void;

  /**
   * Clear all subscriptions
   */
  clearAll(): void;
}

/**
 * Common domain event types
 */
export const DomainEventTypes = {
  // Session events
  SESSION_STARTED: 'session.started',
  SESSION_ENDED: 'session.ended',
  SESSION_ERROR: 'session.error',

  // Navigation events
  NAVIGATION_STARTED: 'navigation.started',
  NAVIGATION_COMPLETED: 'navigation.completed',
  NAVIGATION_FAILED: 'navigation.failed',

  // Interaction events
  INTERACTION_STARTED: 'interaction.started',
  INTERACTION_COMPLETED: 'interaction.completed',
  INTERACTION_FAILED: 'interaction.failed',

  // Snapshot events
  SNAPSHOT_CAPTURE_STARTED: 'snapshot.capture_started',
  SNAPSHOT_CAPTURE_COMPLETED: 'snapshot.capture_completed',
  SNAPSHOT_CAPTURE_FAILED: 'snapshot.capture_failed',

  // Discovery events
  DISCOVERY_STARTED: 'discovery.started',
  DISCOVERY_COMPLETED: 'discovery.completed',
  DISCOVERY_FAILED: 'discovery.failed',
} as const;

/**
 * Type for event type constants
 */
export type DomainEventType = (typeof DomainEventTypes)[keyof typeof DomainEventTypes];
