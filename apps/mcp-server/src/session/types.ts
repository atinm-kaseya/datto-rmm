export interface SessionState {
  loadedGroups: string[];
  platform: string;
}

export interface CachedToken {
  accessToken: string;
  expiresAt: number; // unix ms
}

export interface ISessionStore {
  getSession(sessionId: string): Promise<SessionState | null>;
  saveSession(sessionId: string, state: SessionState): Promise<void>;
  getToken(credHash: string): Promise<CachedToken | null>;
  saveToken(credHash: string, token: CachedToken): Promise<void>;
}
