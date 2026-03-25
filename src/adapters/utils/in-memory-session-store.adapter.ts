import type { BrowserSession } from '../../core/entities/browser-session.entity.js';
import type { ISessionStore, RoleRefMap, StoredRoleRefs } from '../../core/ports/session-store.port.js';

/**
 * In-Memory Session Store Adapter
 * 
 * Implementation of ISessionStore port that stores sessions in memory.
 */
export class InMemorySessionStoreAdapter implements ISessionStore {
  private sessions = new Map<string, BrowserSession>();
  private roleRefs = new Map<string, StoredRoleRefs>();

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
    frameSelector?: string,
  ): Promise<void> {
    this.roleRefs.set(session.id, { refs, mode, frameSelector });
  }

  async restoreRoleRefs(session: BrowserSession): Promise<StoredRoleRefs | null> {
    return this.roleRefs.get(session.id) ?? null;
  }
}
