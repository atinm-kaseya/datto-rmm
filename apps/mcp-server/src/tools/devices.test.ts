/**
 * Tests for devices Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import {
  getDevice,
  getDeviceById,
  getDeviceByMac,
  listDeviceOpenAlerts,
  listDeviceResolvedAlerts,
  moveDevice,
  createQuickJob,
  setDeviceWarranty,
} from './devices.js';
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
    PUT: async () => ({
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

// ─── getDevice ─────────────────────────────────────────────────────────────────

describe('getDevice', () => {
  it('returns device data on success', async () => {
    const client = createMockClient();
    const result = await getDevice(client, { deviceUid: 'device-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.uid).toBe('device-1');
    expect(body.data.hostname).toBe('web-server-01');
  });

  it('populates _enhanced with device uid→hostname and site uid→name', async () => {
    const client = createMockClient();
    const result = await getDevice(client, { deviceUid: 'device-1' });
    const body = JSON.parse(result.content[0]!.text);
    // default mock device: uid='device-1', hostname='web-server-01', siteUid='site-1', siteName='Acme Corp'
    expect(body._enhanced.devices?.['device-1']).toBe('web-server-01');
    expect(body._enhanced.sites?.['site-1']).toBe('Acme Corp');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getDevice(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getDeviceById ─────────────────────────────────────────────────────────────

describe('getDeviceById', () => {
  it('returns device data for numeric ID', async () => {
    const client = createMockClient();
    const result = await getDeviceById(client, { deviceId: 12345 });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.hostname).toBe('web-server-01');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getDeviceById(makeErrorClient(), { deviceId: 12345 });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getDeviceByMac ────────────────────────────────────────────────────────────

describe('getDeviceByMac', () => {
  it('returns array of matching devices', async () => {
    const client = createMockClient();
    const result = await getDeviceByMac(client, { macAddress: 'AA:BB:CC:DD:EE:FF' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(1);
    expect(body.data[0].hostname).toBe('web-server-01');
  });

  it('returns empty array for unknown MAC', async () => {
    const client = createMockClient({ devicesByMac: [] });
    const result = await getDeviceByMac(client, { macAddress: '00:00:00:00:00:00' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getDeviceByMac(makeErrorClient(), { macAddress: 'AA:BB:CC:DD:EE:FF' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listDeviceOpenAlerts ──────────────────────────────────────────────────────

describe('listDeviceOpenAlerts', () => {
  it('returns open alerts for a device', async () => {
    const client = createMockClient();
    const result = await listDeviceOpenAlerts(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0].priority).toBe('Critical');
  });

  it('returns error envelope on API failure', async () => {
    const result = await listDeviceOpenAlerts(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listDeviceResolvedAlerts ──────────────────────────────────────────────────

describe('listDeviceResolvedAlerts', () => {
  it('returns resolved alerts for a device', async () => {
    const client = createMockClient();
    const result = await listDeviceResolvedAlerts(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].alertUid).toBe('dev-resolved-1');
  });

  it('returns error envelope on API failure', async () => {
    const result = await listDeviceResolvedAlerts(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── moveDevice ────────────────────────────────────────────────────────────────

describe('moveDevice', () => {
  it('returns success on device move', async () => {
    const client = createMockClient();
    const result = await moveDevice(client, { deviceUid: 'device-1', siteUid: 'site-2' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await moveDevice(makeErrorClient(), { deviceUid: 'device-1', siteUid: 'site-2' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── createQuickJob ────────────────────────────────────────────────────────────

describe('createQuickJob', () => {
  it('returns quick job result on success', async () => {
    const client = createMockClient();
    const result = await createQuickJob(client, {
      deviceUid: 'device-1',
      jobName: 'Run Cleanup',
      componentUid: 'comp-1',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.job).toBeDefined();
    expect(body.data.job.jobUid).toBe('quick-job-1');
  });

  it('passes optional variables', async () => {
    const client = createMockClient();
    const result = await createQuickJob(client, {
      deviceUid: 'device-1',
      jobName: 'Run Cleanup',
      componentUid: 'comp-1',
      variables: [{ name: 'threshold', value: '90' }],
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await createQuickJob(makeErrorClient(), {
      deviceUid: 'device-1',
      jobName: 'Run Cleanup',
      componentUid: 'comp-1',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── setDeviceWarranty ─────────────────────────────────────────────────────────

describe('setDeviceWarranty', () => {
  it('returns success when warranty date is set', async () => {
    const client = createMockClient();
    const result = await setDeviceWarranty(client, {
      deviceUid: 'device-1',
      warrantyDate: '2026-12-31',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns success when warranty date is cleared (undefined)', async () => {
    const client = createMockClient();
    const result = await setDeviceWarranty(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await setDeviceWarranty(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
