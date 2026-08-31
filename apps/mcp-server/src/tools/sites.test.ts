/**
 * Tests for sites Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import {
  getSite,
  listSiteDevices,
  listSiteOpenAlerts,
  listSiteResolvedAlerts,
  listSiteVariables,
  getSiteSettings,
  listSiteFilters,
  createSite,
  updateSite,
} from './sites.js';
import { createMockClient } from '../test-utils/mock-client.js';

function makeErrorClient(status = 500) {
  return {
    ...createMockClient(),
    GET: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status,
        statusText: 'Internal Server Error',
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
    POST: async () => ({
      data: undefined,
      error: undefined,
      response: {
        ok: false,
        status,
        statusText: 'Internal Server Error',
        url: 'https://test.url',
        headers: new Headers(),
      } as Response,
    }),
  } as any;
}

// ─── getSite ───────────────────────────────────────────────────────────────────

describe('getSite', () => {
  it('returns site data on success', async () => {
    const client = createMockClient();
    const result = await getSite(client, { siteUid: 'site-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.uid).toBe('site-1');
    expect(body.data.name).toBe('Acme Corp');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getSite(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listSiteDevices ───────────────────────────────────────────────────────────

describe('listSiteDevices', () => {
  it('returns devices with count', async () => {
    const client = createMockClient();
    const result = await listSiteDevices(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(5);
    expect(body.data.length).toBe(3);
  });

  it('passes filterId arg', async () => {
    const client = createMockClient();
    const result = await listSiteDevices(client, { siteUid: 'site-1', filterId: 42 });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await listSiteDevices(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listSiteOpenAlerts ────────────────────────────────────────────────────────

describe('listSiteOpenAlerts', () => {
  it('returns open alerts for a site', async () => {
    const client = createMockClient();
    const result = await listSiteOpenAlerts(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(3);
  });

  it('returns error envelope on API failure', async () => {
    const result = await listSiteOpenAlerts(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listSiteResolvedAlerts ────────────────────────────────────────────────────

describe('listSiteResolvedAlerts', () => {
  it('returns resolved alerts for a site', async () => {
    const client = createMockClient();
    const result = await listSiteResolvedAlerts(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(2);
    expect(body.data[0].alertUid).toBe('site-resolved-1');
  });

  it('returns error envelope on API failure', async () => {
    const result = await listSiteResolvedAlerts(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listSiteVariables ─────────────────────────────────────────────────────────

describe('listSiteVariables', () => {
  it('returns site variables', async () => {
    const client = createMockClient();
    const result = await listSiteVariables(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].name).toBe('backupServer');
  });

  it('returns error envelope on API failure', async () => {
    const result = await listSiteVariables(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getSiteSettings ───────────────────────────────────────────────────────────

describe('getSiteSettings', () => {
  it('returns site settings on success', async () => {
    const client = createMockClient();
    const result = await getSiteSettings(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.proxySettings).toBeDefined();
  });

  it('returns error envelope on API failure', async () => {
    const result = await getSiteSettings(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listSiteFilters ───────────────────────────────────────────────────────────

describe('listSiteFilters', () => {
  it('returns site filters with count', async () => {
    const client = createMockClient();
    const result = await listSiteFilters(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(1);
    expect(body.data[0].name).toBe('Windows Servers');
  });

  it('returns error envelope on API failure', async () => {
    const result = await listSiteFilters(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── createSite ────────────────────────────────────────────────────────────────

describe('createSite', () => {
  it('creates site when no duplicate exists', async () => {
    // Use a sites list that does NOT contain 'New Site'
    const client = createMockClient();
    const result = await createSite(client, { name: 'New Site' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('returns duplicate_detected when site name already exists', async () => {
    // Default mock sites contain 'Acme Corp'
    const client = createMockClient();
    const result = await createSite(client, { name: 'Acme Corp' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('duplicate_detected');
    expect(body.code).toBe(409);
  });

  it('duplicate check is case-insensitive', async () => {
    const client = createMockClient();
    const result = await createSite(client, { name: 'acme corp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('duplicate_detected');
  });
});

// ─── updateSite ────────────────────────────────────────────────────────────────

describe('updateSite', () => {
  it('returns success on update', async () => {
    const client = createMockClient();
    const result = await updateSite(client, { siteUid: 'site-1', name: 'Acme Corp Updated' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await updateSite(makeErrorClient(), { siteUid: 'site-1', name: 'Acme Corp Updated' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
