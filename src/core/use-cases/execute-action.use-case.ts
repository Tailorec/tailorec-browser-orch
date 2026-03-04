/**
 * Execute Action Use Case
 *
 * Orchestrates the execution of a browser action.
 * This is a domain use case that coordinates services to perform an action.
 */

import type { Page } from 'playwright-core';
import { InteractionService, type BrowserAction, type InteractionResult } from '../services/interaction.service.js';
import { SessionService } from '../services/session.service.js';
import { DiscoveryService } from '../services/discovery.service.js';
import type { IEventBus } from '../ports/event-bus.port.js';

/**
 * Execute action request
 */
export type ExecuteActionRequest = {
  /**
   * CDP URL for browser connection
   */
  cdpUrl: string;

  /**
   * Target ID (optional, uses default if not provided)
   */
  targetId?: string;

  /**
   * Action to execute
   */
  action: BrowserAction;
};

/**
 * Execute action response
 */
export type ExecuteActionResponse = {
  /**
   * Whether action was successful
   */
  ok: boolean;

  /**
   * Target ID after action
   */
  targetId?: string;

  /**
   * URL after action
   */
  url?: string;

  /**
   * Action result (for evaluate actions)
   */
  result?: unknown;

  /**
   * Error message if action failed
   */
  error?: string;
};

/**
 * Execute Action Use Case
 *
 * Orchestrates the execution of a browser action by coordinating
 * the session, interaction, and discovery services.
 */
export class ExecuteActionUseCase {
  constructor(
    private sessionService: SessionService,
    private interactionService: InteractionService,
    private discoveryService: DiscoveryService,
    private eventBus?: IEventBus,
  ) {}

  /**
   * Execute a browser action
   * @param request - Action request
   * @returns Action result
   */
  async execute(request: ExecuteActionRequest): Promise<ExecuteActionResponse> {
    try {
      // Publish start event
      this.publishEvent('INTERACTION_STARTED', {
        actionKind: request.action.kind,
        targetId: request.targetId,
      });

      // Get page from session
      const page = await this.sessionService.getPage(request.targetId, request.cdpUrl);

      // Restore role refs for element lookup
      if (request.targetId) {
        await this.sessionService.restoreRoleRefs(request.targetId);
      }

      // Get refs from session for element lookup
      const session = await this.sessionService.getSession(request.targetId, request.cdpUrl);
      const refs = session.getRoleRefs();

      // Handle special action types that need discovery service
      if (this.requiresDiscovery(request.action)) {
        return await this.executeWithDiscovery(page, request.action, refs);
      }

      // Execute action via interaction service
      const result = await this.interactionService.executeAction(page, request.action, refs);

      // Store updated refs if action modified DOM
      if (request.targetId && refs) {
        await this.sessionService.storeRoleRefs(request.targetId, refs, session.getRoleRefsMode() ?? 'aria');
      }

      // Publish completion event
      this.publishEvent('INTERACTION_COMPLETED', {
        actionKind: request.action.kind,
        targetId: request.targetId,
        url: result.url,
      });

      return {
        ok: result.ok,
        targetId: result.targetId,
        url: result.url,
        result: result.result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Publish error event
      this.publishEvent('INTERACTION_FAILED', {
        actionKind: request.action.kind,
        targetId: request.targetId,
        error: errorMessage,
      });

      return {
        ok: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute action with discovery service coordination
   */
  private async executeWithDiscovery(
    page: Page,
    action: BrowserAction,
    refs?: Record<string, { role: string; name?: string; nth?: number }>,
  ): Promise<ExecuteActionResponse> {
    // Handle dropdown discovery
    if (action.kind === 'click' || action.kind === 'type') {
      // First try to detect if this might be a dropdown
      const blockerInfo = await this.discoveryService.detectBlockingElement(page, action.ref);

      // If blocked, try to dismiss blocker first
      if (blockerInfo?.isBlocked && blockerInfo.dismissStrategy) {
        const dismissResult = await this.discoveryService.dismissBlocker(
          page,
          action.ref,
          blockerInfo.dismissStrategy === 'click_close' ? 'click_close' : undefined,
        );

        if (!dismissResult.dismissed) {
          return {
            ok: false,
            error: `Unable to dismiss blocking element: ${blockerInfo.blockerTagName}`,
          };
        }
      }
    }

    // Execute the action normally
    const result = await this.interactionService.executeAction(page, action, refs);

    return {
      ok: result.ok,
      targetId: result.targetId,
      url: result.url,
      result: result.result,
    };
  }

  /**
   * Check if action requires discovery service coordination
   */
  private requiresDiscovery(action: BrowserAction): boolean {
    return action.kind === 'click' || action.kind === 'type';
  }

  /**
   * Publish event to event bus
   */
  private publishEvent(type: string, payload: { targetId?: string; [key: string]: unknown }): void {
    if (!this.eventBus) return;

    this.eventBus.publish({
      type,
      timestamp: new Date().toISOString(),
      aggregateId: payload.targetId ?? 'unknown',
      ...payload,
    });
  }
}

/**
 * Domain event types for execute action
 */
export const ExecuteActionEvents = {
  STARTED: 'INTERACTION_STARTED',
  COMPLETED: 'INTERACTION_COMPLETED',
  FAILED: 'INTERACTION_FAILED',
} as const;
