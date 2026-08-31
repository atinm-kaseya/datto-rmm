/**
 * Tests for activity Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import { getActivityLogs } from './activity.js';
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

// ─── getActivityLogs ───────────────────────────────────────────────────────────

describe('getActivityLogs', () => {
  it('returns activity logs array with count', async () => {
    const client = createMockClient();
    const result = await getActivityLogs(client, {});

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.count).toBe(10);
  });

  it('passes size and order args', async () => {
    const client = createMockClient();
    const result = await getActivityLogs(client, { size: 50, order: 'asc' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('passes entity filter (device)', async () => {
    const client = createMockClient();
    const result = await getActivityLogs(client, { entities: ['device'] });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('passes entity filter (user)', async () => {
    const client = createMockClient();
    const result = await getActivityLogs(client, { entities: ['user'] });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('passes date range filters', async () => {
    const client = createMockClient();
    const result = await getActivityLogs(client, {
      from: '2026-01-01T00:00:00Z',
      until: '2026-08-31T23:59:59Z',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('handles empty activity log result', async () => {
    const client = createMockClient({
      activityLogs: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        activities: [],
      },
    });
    const result = await getActivityLogs(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getActivityLogs(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
