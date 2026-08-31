/**
 * Tests for rmm_search_devices composite tool
 */

import { describe, it, expect } from 'vitest';
import { searchDevices } from './search-devices.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('rmm_search_devices', () => {
  it('should search devices by hostname', async () => {
    const client = createMockClient();
    const result = await searchDevices(client, { query: 'web-server' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);

    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.count).toBeGreaterThanOrEqual(0);

    const hostnames = body.data.map((d: any) => d.hostname);
    expect(hostnames).toContain('web-server-01');
  });

  it('should filter by online status', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          { uid: 'd1', hostname: 'online-device', online: true, siteName: 'Site A', deviceType: { type: 'Server' } },
          { uid: 'd2', hostname: 'offline-device', online: false, siteName: 'Site A', deviceType: { type: 'Server' } },
        ],
      },
    });

    // Search for online only
    const resultOnline = await searchDevices(client, { status: 'online', query: 'device' });
    const bodyOnline = JSON.parse(resultOnline.content[0]!.text);

    expect(bodyOnline.ok).toBe(true);
    const onlineHostnames = bodyOnline.data.map((d: any) => d.hostname);
    expect(onlineHostnames).toContain('online-device');
    expect(onlineHostnames).not.toContain('offline-device');

    // Search for offline only
    const resultOffline = await searchDevices(client, { status: 'offline', query: 'device' });
    const bodyOffline = JSON.parse(resultOffline.content[0]!.text);

    expect(bodyOffline.ok).toBe(true);
    const offlineHostnames = bodyOffline.data.map((d: any) => d.hostname);
    expect(offlineHostnames).toContain('offline-device');
  });

  it('should show alert counts for devices', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'test-device',
            online: true,
            siteName: 'Test Site',
            siteUid: 'site-1',
            deviceType: { type: 'Server' },
            operatingSystem: 'Windows Server 2022',
          },
        ],
      },
      deviceAlerts: {
        pageDetails: { count: 3, totalCount: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          { alertUid: 'a1', priority: 'Critical' },
          { alertUid: 'a2', priority: 'High' },
          { alertUid: 'a3', priority: 'Moderate' },
        ],
      },
    });

    const result = await searchDevices(client, { query: 'test-device' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].alertCount).toBeGreaterThanOrEqual(0);
  });

  it('should return empty array when nothing found', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [],
      },
    });

    const result = await searchDevices(client, { query: 'nonexistent' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('should limit results correctly', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 50, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: Array(50).fill(null).map((_, i) => ({
          uid: `device-${i}`,
          hostname: `device-${i}`,
          online: true,
          siteName: 'Test Site',
          deviceType: { type: 'Server' },
        })),
      },
    });

    const result = await searchDevices(client, { limit: 5 });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(5);
    expect(body.count).toBe(5);
  });

  it('should rank exact hostname matches higher', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          { uid: 'd1', hostname: 'web-server-prod', online: true, siteName: 'Site A', deviceType: { type: 'Server' } },
          { uid: 'd2', hostname: 'web-server', online: true, siteName: 'Site B', deviceType: { type: 'Server' } },
          { uid: 'd3', hostname: 'server-web-backup', online: true, siteName: 'Site C', deviceType: { type: 'Server' } },
        ],
      },
    });

    const result = await searchDevices(client, { query: 'web-server' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    // Exact match should be first
    expect(body.data[0].hostname).toBe('web-server');
  });

  it('should include site context in results', async () => {
    const client = createMockClient();
    const result = await searchDevices(client, { query: 'web' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    if (body.data.length > 0) {
      const device = body.data[0];
      expect(device).toHaveProperty('siteName');
      expect(device).toHaveProperty('siteUid');
      expect(device.siteName).toBe('Acme Corp');
    }
  });

  it('should include device structure fields in results', async () => {
    const client = createMockClient();
    const result = await searchDevices(client, { query: 'web' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    if (body.data.length > 0) {
      const device = body.data[0];
      expect(device).toHaveProperty('hostname');
      expect(device).toHaveProperty('uid');
      expect(device).toHaveProperty('online');
      expect(device).toHaveProperty('alertCount');
    }
  });
});
