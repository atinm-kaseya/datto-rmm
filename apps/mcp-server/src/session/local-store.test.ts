import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalSessionStore } from './local-store.js';

describe('LocalSessionStore', () => {
  let store: LocalSessionStore;

  beforeEach(() => {
    store = new LocalSessionStore();
  });

  describe('sessions', () => {
    it('returns null for unknown session', async () => {
      expect(await store.getSession('missing')).toBeNull();
    });

    it('saves and retrieves a session', async () => {
      await store.saveSession('s1', { loadedGroups: ['devices'], platform: 'merlot' });
      expect(await store.getSession('s1')).toEqual({ loadedGroups: ['devices'], platform: 'merlot' });
    });

    it('overwrites an existing session', async () => {
      await store.saveSession('s1', { loadedGroups: [], platform: 'merlot' });
      await store.saveSession('s1', { loadedGroups: ['alerts'], platform: 'concord' });
      expect(await store.getSession('s1')).toEqual({ loadedGroups: ['alerts'], platform: 'concord' });
    });
  });

  describe('tokens', () => {
    it('returns null for unknown credential hash', async () => {
      expect(await store.getToken('unknownhash')).toBeNull();
    });

    it('saves and retrieves a valid token', async () => {
      const token = { accessToken: 'tok', expiresAt: Date.now() + 60 * 60 * 1000 };
      await store.saveToken('hash1', token);
      expect(await store.getToken('hash1')).toEqual(token);
    });

    it('returns null and evicts an expired token (within 5 min buffer)', async () => {
      const token = { accessToken: 'tok', expiresAt: Date.now() + 4 * 60 * 1000 };
      await store.saveToken('hash1', token);
      expect(await store.getToken('hash1')).toBeNull();
      // evicted — second read also null
      expect(await store.getToken('hash1')).toBeNull();
    });

    it('isolates tokens by credential hash', async () => {
      await store.saveToken('hash1', { accessToken: 'tok1', expiresAt: Date.now() + 3600_000 });
      await store.saveToken('hash2', { accessToken: 'tok2', expiresAt: Date.now() + 3600_000 });
      expect((await store.getToken('hash1'))?.accessToken).toBe('tok1');
      expect((await store.getToken('hash2'))?.accessToken).toBe('tok2');
    });
  });
});
