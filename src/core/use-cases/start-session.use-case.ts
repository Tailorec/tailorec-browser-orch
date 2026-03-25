/**
 * Start Session Use Case
 * 
 * Orchestrates the creation of a new browser session.
 * This is a domain use case that coordinates services to start sessions.
 */

import { SessionService, type CreateSessionResult } from '../services/session.service.js';
import { NavigationService } from '../services/navigation.service.js';
import type { IEventBus } from '../ports/event-bus.port.js';

/**
 * Start session request
 */
export type StartSessionRequest = {
  /**
   * CDP URL for browser connection
   */
  cdpUrl: string;

  /**
   * URL to navigate to (optional, defaults to about:blank)
   */
  url?: string;

  /**
   * Target ID to reuse existing session (optional)
   */
  targetId?: string;

  /**
   * Viewport width (optional)
   */
  width?: number;

  /**
   * Viewport height (optional)
   */
  height?: number;
};

/**
 * Start session response
 */
export type StartSessionResponse = {
  /**
   * Whether session was started successfully
   */
  ok: boolean;

  /**
   * Session target ID
   */
  targetId?: string;

  /**
   * Current URL
   */
  url?: string;

  /**
   * Session info
   */
  session?: {
    id: string;
    cdpUrl: string;
    url: string;
    title?: string;
  };

  /**
   * Error message if session failed
   */
  error?: string;
};

/**
 * Start Session Use Case
 * 
 * Orchestrates the creation of browser sessions by coordinating
 * the session and navigation services.
 */
export class StartSessionUseCase {
  constructor(
    private sessionService: SessionService,
    private navigationService: NavigationService,
    private eventBus?: IEventBus,
  ) {}

  /**
   * Start a new browser session
   * @param request - Session request
   * @returns Session result
   */
  async execute(request: StartSessionRequest): Promise<StartSessionResponse> {
    try {
      // Publish start event
      this.publishEvent('SESSION_STARTED', {
        cdpUrl: request.cdpUrl,
        targetId: request.targetId,
        url: request.url,
      });

      let result: CreateSessionResult;

      // Check if we should reuse existing session
      if (request.targetId) {
        try {
          const existingSession = await this.sessionService.getSession(
            request.targetId,
            request.cdpUrl,
          );

          // Navigate to URL if provided
          if (request.url && request.url !== 'about:blank') {
            await this.navigationService.navigate(
              existingSession.page,
              request.url,
            );
          }

          const title = await existingSession.page.title().catch(() => undefined);

          this.publishEvent('SESSION_REUSED', {
            targetId: request.targetId,
            url: existingSession.page.url(),
          });

          return {
            ok: true,
            targetId: existingSession.id,
            url: existingSession.page.url(),
            session: {
              id: existingSession.id,
              cdpUrl: existingSession.cdpUrl,
              url: existingSession.page.url(),
              title,
            },
          };
        } catch {
          // Target not found, create new session
        }
      }

      // Create new session
      result = await this.sessionService.createSession(
        request.cdpUrl,
        request.url ?? 'about:blank',
      );

      // Get session for additional info
      const session = await this.sessionService.getSession(result.targetId, request.cdpUrl);
      const title = await session.page.title().catch(() => undefined);

      // Resize viewport if dimensions provided
      if (request.width && request.height) {
        await session.page.setViewportSize({
          width: Math.max(1, Math.floor(request.width)),
          height: Math.max(1, Math.floor(request.height)),
        });
      }

      // Publish completion event
      this.publishEvent('SESSION_COMPLETED', {
        targetId: result.targetId,
        url: result.url,
      });

      return {
        ok: true,
        targetId: result.targetId,
        url: result.url,
        session: {
          id: session.id,
          cdpUrl: session.cdpUrl,
          url: result.url,
          title,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Publish error event
      this.publishEvent('SESSION_FAILED', {
        cdpUrl: request.cdpUrl,
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
   * List all active sessions
   * @param cdpUrl - CDP URL
   * @returns List of session info
   */
  async listSessions(cdpUrl: string): Promise<
    Array<{
      targetId: string;
      title: string;
      url: string;
      type: string;
    }>
  > {
    const sessions = await this.sessionService.listSessions(cdpUrl);
    return sessions.map((s) => ({
      targetId: s.targetId,
      title: s.title ?? '',
      url: s.url ?? '',
      type: s.type ?? 'page',
    }));
  }

  /**
   * Close a session
   * @param targetId - Target ID to close
   */
  async closeSession(targetId: string): Promise<void> {
    await this.sessionService.closeSession(targetId);

    this.publishEvent('SESSION_ENDED', {
      targetId,
    });
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    await this.sessionService.clearAll();

    this.publishEvent('SESSIONS_ENDED', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish event to event bus
   */
  private publishEvent(type: string, payload: Record<string, unknown>): void {
    if (!this.eventBus) return;

    this.eventBus.publish({
      type,
      timestamp: new Date().toISOString(),
      aggregateId: (payload.targetId as string) ?? 'unknown',
      ...payload,
    });
  }
}

/**
 * Domain event types for start session
 */
export const StartSessionEvents = {
  STARTED: 'SESSION_STARTED',
  COMPLETED: 'SESSION_COMPLETED',
  REUSED: 'SESSION_REUSED',
  FAILED: 'SESSION_FAILED',
  ENDED: 'SESSION_ENDED',
  SESSIONS_ENDED: 'SESSIONS_ENDED',
} as const;
