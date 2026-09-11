import type { SessionState, CachedToken, ISessionStore } from './types.js';

export class LocalSessionStore implements ISessionStore {
  private readonly sessions = new Map<string, SessionState>();
  private readonly tokens = new Map<string, CachedToken>();

  async getSession(sessionId: string): Promise<SessionState | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async saveSession(sessionId: string, state: SessionState): Promise<void> {
    this.sessions.set(sessionId, state);
  }

  async getToken(credHash: string): Promise<CachedToken | null> {
    const token = this.tokens.get(credHash);
    if (!token) return null;
    if (Date.now() >= token.expiresAt - 5 * 60 * 1000) {
      this.tokens.delete(credHash);
      return null;
    }
    return token;
  }

  async saveToken(credHash: string, token: CachedToken): Promise<void> {
    this.tokens.set(credHash, token);
  }
}
