import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionStore } from './store.js';

function makeRedis(store: Map<string, string> = new Map()) {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
    }),
  } as any;
}

describe('SessionStore', () => {
  let redis: ReturnType<typeof makeRedis>;
  let sessionStore: SessionStore;

  beforeEach(() => {
    redis = makeRedis();
    sessionStore = new SessionStore(redis);
  });

  describe('sessions', () => {
    it('returns null when key missing', async () => {
      expect(await sessionStore.getSession('s1')).toBeNull();
    });

    it('saves session with 24h TTL', async () => {
      const state = { loadedGroups: ['devices'], platform: 'merlot' };
      await sessionStore.saveSession('s1', state);
      expect(redis.setex).toHaveBeenCalledWith('sessions:s1', 86400, JSON.stringify(state));
    });

    it('retrieves saved session', async () => {
      const state = { loadedGroups: ['alerts'], platform: 'concord' };
      await sessionStore.saveSession('s1', state);
      expect(await sessionStore.getSession('s1')).toEqual(state);
    });
  });

  describe('tokens', () => {
    it('returns null when key missing', async () => {
      expect(await sessionStore.getToken('hash1')).toBeNull();
    });

    it('retrieves saved token', async () => {
      const token = { accessToken: 'tok', expiresAt: Date.now() + 3600_000 };
      await sessionStore.saveToken('hash1', token);
      expect(await sessionStore.getToken('hash1')).toEqual(token);
    });

    it('uses key prefix tokens:{hash}', async () => {
      const token = { accessToken: 'tok', expiresAt: Date.now() + 3600_000 };
      await sessionStore.saveToken('myhash', token);
      expect(redis.setex.mock.calls[0][0]).toBe('tokens:myhash');
    });

    it('clamps TTL to minimum 60s for near-expiry tokens', async () => {
      const token = { accessToken: 'tok', expiresAt: Date.now() + 10_000 };
      await sessionStore.saveToken('hash1', token);
      const ttl = redis.setex.mock.calls[0][1] as number;
      expect(ttl).toBe(60);
    });

    it('sets TTL to (expiresAt - now - 5min) for long-lived tokens', async () => {
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1h
      const token = { accessToken: 'tok', expiresAt };
      await sessionStore.saveToken('hash1', token);
      const ttl = redis.setex.mock.calls[0][1] as number;
      expect(ttl).toBeGreaterThan(3000); // ~55min
      expect(ttl).toBeLessThanOrEqual(3300);
    });
  });
});
