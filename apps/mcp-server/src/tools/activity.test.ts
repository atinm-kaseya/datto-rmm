import { describe, it, expect } from 'vitest';
import { listActivityLogs } from './activity.js';
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

describe('listActivityLogs', () => {
  it('returns activity logs array with totalCount as count', async () => {
    const client = createMockClient();
    const result = await listActivityLogs(client, {});

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    // count should come from totalCount (42), not count (2)
    expect(body.count).toBe(42);
  });

  it('returns next_page cursor URL when more results exist', async () => {
    const client = createMockClient();
    const result = await listActivityLogs(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.next_page).toContain('searchAfter=');
  });

  it('passes entity filter as single value', async () => {
    const client = createMockClient();
    const result = await listActivityLogs(client, { entity: 'device' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('passes date range filters', async () => {
    const client = createMockClient();
    const result = await listActivityLogs(client, {
      from: '2026-01-01T00:00:00Z',
      until: '2026-08-31T23:59:59Z',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('parses cursor URL to extract searchAfter and page direction', async () => {
    const client = createMockClient();
    const cursorUrl = 'https://api.example.com/v2/activity-logs?searchAfter=1662554037000%2Cabc123&page=next&size=2';
    const result = await listActivityLogs(client, { cursor: cursorUrl });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns validation_error for malformed cursor URL', async () => {
    const client = createMockClient();
    const result = await listActivityLogs(client, { cursor: 'not-a-valid-url' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('validation_error');
  });

  it('handles empty activity log result', async () => {
    const client = createMockClient({
      activityLogs: {
        pageDetails: { count: 0, totalCount: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        activities: [],
      },
    });
    const result = await listActivityLogs(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
    expect(body.next_page).toBeNull();
  });

  it('returns error envelope on API failure', async () => {
    const result = await listActivityLogs(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
