/**
 * Tests for audit Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import {
  getDeviceAudit,
  getDeviceSoftware,
  getDeviceAuditByMac,
  listPatches,
} from './audit.js';
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
  } as any;
}

// ─── getDeviceAudit ────────────────────────────────────────────────────────────

describe('getDeviceAudit', () => {
  it('routes to standard audit endpoint when device class is "device"', async () => {
    const client = createMockClient({
      device: {
        uid: 'device-1',
        hostname: 'web-server-01',
        deviceClass: 'device',
      } as any,
    });
    const result = await getDeviceAudit(client, { deviceUid: 'device-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.cpu).toBeDefined();
    expect(body.data.cpu.name).toBe('Intel Xeon E5-2680 v4');
  });

  it('routes to standard audit endpoint when device class is undefined', async () => {
    const client = createMockClient({
      device: {
        uid: 'device-1',
        hostname: 'web-server-01',
        // no deviceClass
      } as any,
    });
    const result = await getDeviceAudit(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    // Standard audit endpoint returns deviceAudit mock
    expect(body.data.cpu).toBeDefined();
  });

  it('routes to ESXi audit endpoint when device class is "esxihost"', async () => {
    const client = createMockClient({
      device: {
        uid: 'device-1',
        hostname: 'esxi-host-01',
        deviceClass: 'esxihost',
      } as any,
    });
    const result = await getDeviceAudit(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.hostName).toBe('esxi-host-01');
  });

  it('routes to printer audit endpoint when device class is "printer"', async () => {
    const client = createMockClient({
      device: {
        uid: 'device-1',
        hostname: 'printer-01',
        deviceClass: 'printer',
      } as any,
    });
    const result = await getDeviceAudit(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.printerName).toBe('HP LaserJet Pro');
  });

  it('routes to standard audit endpoint for rmmnetworkdevice class', async () => {
    const client = createMockClient({
      device: {
        uid: 'device-1',
        hostname: 'network-device-01',
        deviceClass: 'rmmnetworkdevice',
      } as any,
    });
    const result = await getDeviceAudit(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.cpu).toBeDefined();
  });

  it('returns error envelope on API failure', async () => {
    const result = await getDeviceAudit(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getDeviceSoftware ─────────────────────────────────────────────────────────

describe('getDeviceSoftware', () => {
  it('returns software list with count', async () => {
    const client = createMockClient();
    const result = await getDeviceSoftware(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(3);
    expect(body.data[0].name).toBe('Google Chrome');
  });

  it('passes pagination args', async () => {
    const client = createMockClient();
    const result = await getDeviceSoftware(client, { deviceUid: 'device-1', page: 1, max: 100 });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getDeviceSoftware(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getDeviceAuditByMac ───────────────────────────────────────────────────────

describe('getDeviceAuditByMac', () => {
  it('returns array of audit records', async () => {
    const client = createMockClient();
    const result = await getDeviceAuditByMac(client, { macAddress: 'AA:BB:CC:DD:EE:FF' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(1);
    expect(body.data[0].cpu.name).toBe('Intel Core i7');
  });

  it('handles empty result for unknown MAC', async () => {
    const client = createMockClient({ deviceAuditByMac: [] });
    const result = await getDeviceAuditByMac(client, { macAddress: '00:00:00:00:00:00' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
  });

  it('returns error envelope on API failure', async () => {
    const result = await getDeviceAuditByMac(makeErrorClient(), { macAddress: 'AA:BB:CC:DD:EE:FF' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── listPatches ───────────────────────────────────────────────────────────────

describe('listPatches', () => {
  it('returns patches for a device', async () => {
    const client = createMockClient();
    const result = await listPatches(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(2);
    expect(body.data[0].title).toBe('Security Update KB1234567');
  });

  it('returns patches for a site', async () => {
    const client = createMockClient();
    const result = await listPatches(client, { siteUid: 'site-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(3);
  });

  it('passes installStatus filter', async () => {
    const client = createMockClient();
    const result = await listPatches(client, { deviceUid: 'device-1', installStatus: 'APPROVED_PENDING' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
  });

  it('returns validation error when neither deviceUid nor siteUid is provided', async () => {
    const client = createMockClient();
    const result = await listPatches(client, {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('validation_error');
    expect(body.code).toBe(400);
  });

  it('returns validation error when both deviceUid and siteUid are provided', async () => {
    const client = createMockClient();
    const result = await listPatches(client, { deviceUid: 'device-1', siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('validation_error');
    expect(body.detail).toContain('mutually exclusive');
  });

  it('returns error envelope on API failure for device', async () => {
    const result = await listPatches(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });

  it('returns error envelope on API failure for site', async () => {
    const result = await listPatches(makeErrorClient(), { siteUid: 'site-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
