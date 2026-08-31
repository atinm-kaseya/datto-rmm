/**
 * Tests for account Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import {
  getAccount,
  listSites,
  listDevices,
  listUsers,
  listAccountVariables,
  listComponents,
  listAlerts,
  getMeteringSummary,
} from './account.js';
import { createMockClient } from '../test-utils/mock-client.js';

// Helper to make an error client that returns a non-ok 500 response for GET.
function makeErrorClient(status = 500, statusText = 'Internal Server Error') {
  return {
    ...createMockClient(),
    GET: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status,
        statusText,
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
  } as any;
}

// ─── getAccount ────────────────────────────────────────────────────────────────

describe('getAccount', () => {
  it('returns account data on success', async () => {
    const client = createMockClient();
    const result = await getAccount(client);

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('Test Account');
    expect(body.data.uid).toBe('account-123');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getAccount(makeErrorClient());

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });
});

// ─── listSites ─────────────────────────────────────────────────────────────────

describe('listSites', () => {
  it('returns sites array with count', async () => {
    const client = createMockClient();
    const result = await listSites(client, {});

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(3);
    expect(body.count).toBe(3);
  });

  it('passes siteName filter arg', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [{ uid: 'site-1', name: 'Acme Corp', id: 101 }],
      },
    });
    const result = await listSites(client, { siteName: 'Acme Corp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data[0].name).toBe('Acme Corp');
  });

  it('returns error envelope on API failure', async () => {
    const result = await listSites(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listDevices ───────────────────────────────────────────────────────────────

describe('listDevices', () => {
  it('returns devices array with count', async () => {
    const client = createMockClient();
    const result = await listDevices(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(10);
  });

  it('accepts filter args (hostname, deviceType, filterId)', async () => {
    const client = createMockClient();
    const result = await listDevices(client, {
      hostname: 'web-server-01',
      deviceType: 'Server',
      filterId: 5,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('populates _enhanced with site and device maps', async () => {
    const client = createMockClient();
    const result = await listDevices(client, {});
    const body = JSON.parse(result.content[0]!.text);
    expect(body._enhanced.devices).toBeDefined();
    expect(body._enhanced.sites).toBeDefined();
    // default mock devices have uid='device-1' hostname='web-server-01' siteUid='site-1' siteName='Acme Corp'
    expect(body._enhanced.devices['device-1']).toBe('web-server-01');
    expect(body._enhanced.sites['site-1']).toBe('Acme Corp');
  });

  it('routes to site endpoint when siteUid is provided', async () => {
    const client = createMockClient();
    const result = await listDevices(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // siteDevices mock has 3 items (count=5 from pageDetails)
    expect(body.count).toBe(5);
    expect(body.data.length).toBe(3);
  });

  it('returns error envelope on API failure', async () => {
    const result = await listDevices(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listUsers ─────────────────────────────────────────────────────────────────

describe('listUsers', () => {
  it('returns users array with count', async () => {
    const client = createMockClient();
    const result = await listUsers(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(2);
  });

  it('returns error envelope on API failure', async () => {
    const result = await listUsers(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listAccountVariables ──────────────────────────────────────────────────────

describe('listAccountVariables', () => {
  it('returns variables array with count', async () => {
    const client = createMockClient();
    const result = await listAccountVariables(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(1);
    expect(body.data[0].name).toBe('globalServer');
  });

  it('returns error envelope on API failure', async () => {
    const result = await listAccountVariables(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listComponents ────────────────────────────────────────────────────────────

describe('listComponents', () => {
  it('returns components array with count', async () => {
    const client = createMockClient();
    const result = await listComponents(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(2);
  });

  it('returns error envelope on API failure', async () => {
    const result = await listComponents(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listAlerts ────────────────────────────────────────────────────────────────

describe('listAlerts', () => {
  it('returns open alerts account-wide by default', async () => {
    const client = createMockClient();
    const result = await listAlerts(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(15);
    expect(body.data[0].priority).toBe('Critical');
  });

  it('returns resolved alerts account-wide when status=resolved', async () => {
    const client = createMockClient();
    const result = await listAlerts(client, { status: 'resolved' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(5);
    expect(body.data[0].alertUid).toBe('resolved-1');
  });

  it('routes to site open alerts when siteUid provided', async () => {
    const client = createMockClient();
    const result = await listAlerts(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(3);
    expect(body.data[0].alertUid).toBe('alert-1');
  });

  it('routes to site resolved alerts when siteUid and status=resolved', async () => {
    const client = createMockClient();
    const result = await listAlerts(client, { siteUid: 'site-1', status: 'resolved' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(2);
    expect(body.data[0].alertUid).toBe('site-resolved-1');
  });

  it('routes to device open alerts when deviceUid provided', async () => {
    const client = createMockClient();
    const result = await listAlerts(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0].priority).toBe('Critical');
  });

  it('routes to device resolved alerts when deviceUid and status=resolved', async () => {
    const client = createMockClient();
    const result = await listAlerts(client, { deviceUid: 'device-1', status: 'resolved' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data[0].alertUid).toBe('dev-resolved-1');
  });

  it('deviceUid takes precedence over siteUid', async () => {
    const client = createMockClient();
    // Both provided — should use device endpoint
    const result = await listAlerts(client, { deviceUid: 'device-1', siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    // device mock returns 2 alerts
    expect(body.data.length).toBe(2);
  });

  it('passes muted filter', async () => {
    const client = createMockClient();
    const result = await listAlerts(client, { muted: true });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await listAlerts(makeErrorClient(), {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getMeteringSummary ────────────────────────────────────────────────────────

describe('getMeteringSummary', () => {
  it('returns metering data on success', async () => {
    const client = createMockClient();
    const result = await getMeteringSummary(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.totalCalls).toBe(1234);
  });

  it('accepts origin filter', async () => {
    const client = createMockClient();
    const result = await getMeteringSummary(client, { origin: 'mcp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const errorClient = {
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

    const result = await getMeteringSummary(errorClient, {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
