import type { BrowserSession } from '../../core/entities/browser-session.entity.js';
import type { ISessionStore, RoleRefMap } from '../../core/ports/session-store.port.js';

/**
 * In-Memory Session Store Adapter
 * 
 * Implementation of ISessionStore port that stores sessions in memory.
 */
export class InMemorySessionStoreAdapter implements ISessionStore {
  private sessions = new Map<string, BrowserSession>();
  private roleRefs = new Map<string, { refs: RoleRefMap; mode: 'role' | 'aria' }>();

  async getSession(targetId?: string): Promise<BrowserSession | null> {
    if (!targetId) return null;
    return this.sessions.get(targetId) || null;
  }

  async storeSession(session: BrowserSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async removeSession(targetId: string): Promise<void> {
    this.sessions.delete(targetId);
    this.roleRefs.delete(targetId);
  }

  async storeRoleRefs(
    session: BrowserSession,
    refs: RoleRefMap,
    mode: 'role' | 'aria',
  ): Promise<void> {
    this.roleRefs.set(session.id, { refs, mode });
  }

  async restoreRoleRefs(session: BrowserSession): Promise<RoleRefMap | null> {
    const entry = this.roleRefs.get(session.id);
    return entry ? entry.refs : null;
  }
}
