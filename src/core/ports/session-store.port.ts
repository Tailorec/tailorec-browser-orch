/**
 * Session Store Port
 * 
 * Defines the contract for session state persistence.
 * Implemented by: InMemorySessionStoreAdapter
 * 
 * Extracted from: src/browser/pw-session.ts (roleRefsByTarget cache logic)
 */

import type { BrowserSession } from '../entities/browser-session.entity.js';

/**
 * Role reference map for element identification
 */
export type RoleRefMap = Record<string, { role: string; name?: string; nth?: number }>;

/**
 * Port: Session Store
 * 
 * Defines the contract for session state persistence.
 * All adapter implementations must conform to this interface.
 */
export interface ISessionStore {
  /**
   * Get session by target ID
   * @param targetId - The target ID to look up
   * @returns The session or null if not found
   */
  getSession(targetId?: string): Promise<BrowserSession | null>;

  /**
   * Store session
   * @param session - The session to store
   */
  storeSession(session: BrowserSession): Promise<void>;

  /**
   * Remove session
   * @param targetId - The target ID to remove
   */
  removeSession(targetId: string): Promise<void>;

  /**
   * Store role references for session
   * @param session - The session to store refs for
   * @param refs - The role references to store
   * @param mode - The refs mode ('role' or 'aria')
   */
  storeRoleRefs(
    session: BrowserSession,
    refs: RoleRefMap,
    mode: 'role' | 'aria',
  ): Promise<void>;

  /**
   * Restore role references for session
   * @param session - The session to restore refs for
   * @returns The restored role references or null if not found
   */
  restoreRoleRefs(session: BrowserSession): Promise<RoleRefMap | null>;
}

/**
 * Session store options
 */
export type SessionStoreOptions = {
  /**
   * Maximum number of sessions to cache
   */
  maxSessions?: number;

  /**
   * Maximum number of role refs to cache per session
   */
  maxRoleRefsCache?: number;
};
