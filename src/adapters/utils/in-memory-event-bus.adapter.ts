import type { IEventBus, IDomainEvent, EventHandler } from '../../core/ports/event-bus.port.js';

/**
 * In-Memory Event Bus Adapter
 * 
 * Simple implementation of IEventBus port that stays in-memory.
 */
export class InMemoryEventBusAdapter implements IEventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();

  publish<T extends IDomainEvent>(event: T): void {
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Event handler failed for ${event.type}:`, error);
        }
      });
    }
  }

  subscribe<T extends IDomainEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe<T extends IDomainEvent>(eventType: string, handler: EventHandler<T>): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  clear(eventType: string): void {
    this.handlers.delete(eventType);
  }

  clearAll(): void {
    this.handlers.clear();
  }
}
