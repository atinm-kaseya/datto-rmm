/**
 * Tests for audit Tier-2 tools.
 */

import { describe, it, expect } from 'vitest';
import {
  getDeviceAudit,
  getDeviceSoftware,
  getDeviceAuditByMac,
  getEsxiAudit,
  getPrinterAudit,
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
  it('returns audit data on success', async () => {
    const client = createMockClient();
    const result = await getDeviceAudit(client, { deviceUid: 'device-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.cpu).toBeDefined();
    expect(body.data.cpu.name).toBe('Intel Xeon E5-2680 v4');
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

// ─── getEsxiAudit ──────────────────────────────────────────────────────────────

describe('getEsxiAudit', () => {
  it('returns ESXi host audit data on success', async () => {
    const client = createMockClient();
    const result = await getEsxiAudit(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.hostName).toBe('esxi-host-01');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getEsxiAudit(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});

// ─── getPrinterAudit ───────────────────────────────────────────────────────────

describe('getPrinterAudit', () => {
  it('returns printer audit data on success', async () => {
    const client = createMockClient();
    const result = await getPrinterAudit(client, { deviceUid: 'device-1' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.printerName).toBe('HP LaserJet Pro');
  });

  it('returns error envelope on API failure', async () => {
    const result = await getPrinterAudit(makeErrorClient(), { deviceUid: 'device-1' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
  });
});
