import type { Redis } from 'ioredis';
import type { SessionState, CachedToken } from './types.js';

const SESSION_TTL = 24 * 60 * 60; // 24h in seconds
const MIN_TOKEN_TTL = 60; // seconds
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

export class SessionStore {
  constructor(private readonly redis: Redis) {}

  async getSession(sessionId: string): Promise<SessionState | null> {
    const raw = await this.redis.get(`sessions:${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  }

  async saveSession(sessionId: string, state: SessionState): Promise<void> {
    await this.redis.setex(`sessions:${sessionId}`, SESSION_TTL, JSON.stringify(state));
  }

  async getToken(credHash: string): Promise<CachedToken | null> {
    const raw = await this.redis.get(`tokens:${credHash}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedToken;
  }

  async saveToken(credHash: string, token: CachedToken): Promise<void> {
    const ttlSeconds = Math.max(
      MIN_TOKEN_TTL,
      Math.floor((token.expiresAt - Date.now() - TOKEN_BUFFER_MS) / 1000),
    );
    await this.redis.setex(`tokens:${credHash}`, ttlSeconds, JSON.stringify(token));
  }
}
