/**
 * Tests for system Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import { getSystemStatus, getRateLimit, getPaginationConfig } from './system.js';
import { createMockClient } from '../test-utils/mock-client.js';

function makeErrorClient() {
  return {
    ...createMockClient(),
    GET: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
  } as any;
}

// ─── getSystemStatus ───────────────────────────────────────────────────────────

describe('getSystemStatus', () => {
  it('returns system status on success', async () => {
    const client = createMockClient();
    const result = await getSystemStatus(client);

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe('ok');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getSystemStatus(makeErrorClient());

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getRateLimit ──────────────────────────────────────────────────────────────

describe('getRateLimit', () => {
  it('returns rate limit status on success', async () => {
    const client = createMockClient();
    const result = await getRateLimit(client);

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.maxCalls).toBe(600);
    expect(body.data.currentCalls).toBe(42);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getRateLimit(makeErrorClient());

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getPaginationConfig ───────────────────────────────────────────────────────

describe('getPaginationConfig', () => {
  it('returns pagination configuration on success', async () => {
    const client = createMockClient();
    const result = await getPaginationConfig(client);

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.maxValue).toBe(500);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getPaginationConfig(makeErrorClient());

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
