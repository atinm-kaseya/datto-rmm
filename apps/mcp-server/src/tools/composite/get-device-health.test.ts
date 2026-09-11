/**
 * Tests for rmm_get_device_health composite tool
 */

import { describe, it, expect } from 'vitest';
import { getDeviceHealth } from './get-device-health.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('rmm_get_device_health', () => {
  it('should return comprehensive device health report', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'web-server-01' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);

    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.device).toBeDefined();
    expect(body.data.device.hostname).toBe('web-server-01');
    expect(body.data.alerts).toBeInstanceOf(Array);
    expect(body.data.recommendations).toBeInstanceOf(Array);
  });

  it('should resolve device by UID directly', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'device-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.device.hostname).toBe('web-server-01');
  });

  it('should filter by site when multiple matches', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'server-01',
            siteName: 'Acme Corp',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'server-01',
            siteName: 'TechStart Inc',
            siteUid: 'site-2',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await getDeviceHealth(client, {
      device: 'server-01',
      site: 'Acme',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.device.siteName).toBe('Acme Corp');
  });

  it('should include hardware information when available', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'device-1' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.auditSummary).toBeDefined();
    expect(body.data.auditSummary.cpu).toBeDefined();
    expect(body.data.auditSummary.ram).toBeDefined();
    expect(body.data.auditSummary.disk).toBeInstanceOf(Array);
  });

  it('should report disk usage percentages', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'device-1' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.auditSummary.disk.length).toBeGreaterThan(0);
    const disk = body.data.auditSummary.disk[0];
    expect(disk).toHaveProperty('usedPercent');
    expect(typeof disk.usedPercent).toBe('number');
  });

  it('should show open alerts with severity', async () => {
    const client = createMockClient({
      deviceAlerts: {
        pageDetails: { count: 3, totalCount: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'a1',
            priority: 'Critical',
            diagnostics: 'Disk Space Critical',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            alertUid: 'a2',
            priority: 'High',
            diagnostics: 'High CPU Usage',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
          },
        ],
      },
    });

    const result = await getDeviceHealth(client, { device: 'device-1' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.alerts).toHaveLength(2);

    const criticalAlert = body.data.alerts.find((a: any) => a.priority === 'Critical');
    expect(criticalAlert).toBeDefined();
    expect(criticalAlert.diagnostics).toBe('Disk Space Critical');
  });

  it('should include job history when requested', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, {
      device: 'device-1',
      include_history: true,
    });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.recentJobs).toBeInstanceOf(Array);
    expect(body.data.recentJobs.length).toBeGreaterThan(0);
  });

  it('should provide actionable recommendations', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'device-1' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.recommendations).toBeInstanceOf(Array);
  });

  it('should handle offline devices', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [{
          uid: 'device-1',
          hostname: 'offline-server',
          siteName: 'Test Site',
          siteUid: 'site-1',
          online: false,
          deviceType: { type: 'Server' },
          lastSeen: new Date(Date.now() - 86400000).toISOString(),
        }],
      },
      device: {
        uid: 'device-1',
        hostname: 'offline-server',
        siteName: 'Test Site',
        siteUid: 'site-1',
        online: false,
        deviceType: { type: 'Server' },
        lastSeen: new Date(Date.now() - 86400000).toISOString(),
      },
    });

    const result = await getDeviceHealth(client, { device: 'offline-server' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.device.online).toBe(false);
    expect(body.data.device.hostname).toBe('offline-server');
  });

  it('should handle non-existent device', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [],
      },
    });

    const result = await getDeviceHealth(client, { device: 'nonexistent' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Device not found');
  });
});
