/**
 * Tests for alerts Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import { getAlert, resolveAlert } from './alerts.js';
import { createMockClient } from '../test-utils/mock-client.js';

// ─── getAlert ──────────────────────────────────────────────────────────────────

describe('getAlert', () => {
  it('returns alert data on success', async () => {
    const client = createMockClient();
    const result = await getAlert(client, { alertUid: 'alert-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.alertUid).toBe('alert-1');
    expect(body.data.priority).toBe('Critical');
  });

  it('populates _enhanced with device and site from alertSourceInfo', async () => {
    const client = createMockClient();
    const result = await getAlert(client, { alertUid: 'alert-1' });
    const body = JSON.parse(result.content[0]!.text);
    // default mock alert has alertSourceInfo.deviceUid='device-1' deviceName='web-server-01'
    // and siteUid='site-1' siteName='Acme Corp'
    expect(body._enhanced.devices?.['device-1']).toBe('web-server-01');
    expect(body._enhanced.sites?.['site-1']).toBe('Acme Corp');
  });

  it('returns entity_not_found when API returns 404', async () => {
    // Simulate a 404 non-ok response with no error body — handleResponse will
    // throw "HTTP 404" which mapApiError maps to entity_not_found.
    const errorClient = {
      ...createMockClient(),
      GET: async () => ({
        data: undefined,
        error: undefined,
        response: {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          url: 'https://test.url',
          headers: new Headers(),
        } as Response,
      }),
    } as any;

    const result = await getAlert(errorClient, { alertUid: 'nonexistent' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.code).toBe(404);
  });

  it('returns auth_error when API returns 401', async () => {
    const authErrorClient = {
      ...createMockClient(),
      GET: async () => ({
        data: undefined,
        error: undefined,
        response: {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          url: 'https://test.url',
          headers: new Headers(),
        } as Response,
      }),
    } as any;

    const result = await getAlert(authErrorClient, { alertUid: 'alert-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('auth_error');
    expect(body.code).toBe(401);
  });
});

// ─── resolveAlert ──────────────────────────────────────────────────────────────

describe('resolveAlert', () => {
  it('returns success when alert is resolved', async () => {
    const client = createMockClient();
    const result = await resolveAlert(client, { alertUid: 'alert-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const errorClient = {
      ...createMockClient(),
      POST: async () => ({
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

    const result = await resolveAlert(errorClient, { alertUid: 'alert-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
