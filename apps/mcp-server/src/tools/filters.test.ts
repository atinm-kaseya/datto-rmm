/**
 * Tests for filters Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import { listDefaultFilters, listCustomFilters } from './filters.js';
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

// ─── listDefaultFilters ────────────────────────────────────────────────────────

describe('listDefaultFilters', () => {
  it('returns default filters array with count', async () => {
    const client = createMockClient();
    const result = await listDefaultFilters(client, {});

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(2);
    expect(body.data[0].name).toBe('All Devices');
  });

  it('passes pagination args', async () => {
    const client = createMockClient();
    const result = await listDefaultFilters(client, { page: 1, max: 100 });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await listDefaultFilters(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listCustomFilters ─────────────────────────────────────────────────────────

describe('listCustomFilters', () => {
  it('returns custom filters array with count', async () => {
    const client = createMockClient();
    const result = await listCustomFilters(client, {});

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(1);
    expect(body.data[0].name).toBe('Production Servers');
  });

  it('handles empty custom filters', async () => {
    const client = createMockClient({
      customFilters: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        filters: [],
      },
    });
    const result = await listCustomFilters(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('returns error envelope on API failure', async () => {
    const result = await listCustomFilters(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
