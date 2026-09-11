/**
 * Tests for rmm_get_site_health composite tool
 */

import { describe, it, expect } from 'vitest';
import { getSiteHealth } from './get-site-health.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('rmm_get_site_health', () => {
  it('should return comprehensive site health', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, { site: 'Acme Corp' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);

    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.site).toBeDefined();
    expect(body.data.site.name).toBe('Acme Corp');
    expect(body.data.alerts).toBeDefined();
    expect(body.data.recommendations).toBeInstanceOf(Array);
  });

  it('should resolve site by UID directly', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, { site: 'site-1' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.site.name).toBe('Acme Corp');
  });

  it('should show device breakdown', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 6, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          { uid: 'd1', hostname: 'server-01', online: true, deviceType: { type: 'Server' } },
          { uid: 'd2', hostname: 'server-02', online: true, deviceType: { type: 'Server' } },
          { uid: 'd3', hostname: 'server-03', online: false, deviceType: { type: 'Server' } },
          { uid: 'd4', hostname: 'ws-01', online: true, deviceType: { type: 'Workstation' } },
          { uid: 'd5', hostname: 'ws-02', online: true, deviceType: { type: 'Workstation' } },
          { uid: 'd6', hostname: 'laptop-01', online: false, deviceType: { type: 'Laptop' } },
        ],
      },
    });

    const result = await getSiteHealth(client, { site: 'site-1' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.site.totalDevices).toBe(6);
    expect(body.data.site.onlineDevices).toBe(4);
    expect(body.data.site.offlineDevices).toBe(2);
  });

  it('should include full device list when requested', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, {
      site: 'site-1',
      include_device_details: true,
    });

    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.deviceDetails).toBeInstanceOf(Array);
    expect(body.data.deviceDetails.length).toBeGreaterThan(0);
    const hostnames = body.data.deviceDetails.map((d: any) => d.hostname);
    expect(hostnames).toContain('web-server-01');
  });

  it('should show top devices with most alerts', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 5, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          { alertUid: 'a1', priority: 'Critical', alertSourceInfo: { deviceUid: 'device-1' } },
          { alertUid: 'a2', priority: 'Critical', alertSourceInfo: { deviceUid: 'device-1' } },
          { alertUid: 'a3', priority: 'Critical', alertSourceInfo: { deviceUid: 'device-1' } },
          { alertUid: 'a4', priority: 'High', alertSourceInfo: { deviceUid: 'device-2' } },
          { alertUid: 'a5', priority: 'High', alertSourceInfo: { deviceUid: 'device-2' } },
        ],
      },
    });

    const result = await getSiteHealth(client, { site: 'site-1' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.topProblematicDevices).toBeInstanceOf(Array);
    expect(body.data.topProblematicDevices.length).toBeGreaterThan(0);

    const topDevice = body.data.topProblematicDevices[0];
    expect(topDevice.alertCount).toBe(3);
    expect(topDevice.uid).toBe('device-1');
  });

  it('should show no alerts when site is healthy', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [],
      },
    });

    const result = await getSiteHealth(client, { site: 'site-1' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.alerts.total).toBe(0);
    expect(body.data.topProblematicDevices).toHaveLength(0);
  });

  it('should return error for non-existent site', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [],
      },
    });

    const result = await getSiteHealth(client, { site: 'NonExistent' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Site not found');
  });

  it('should provide actionable recommendations', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, { site: 'site-1' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.recommendations).toBeInstanceOf(Array);
    // Should suggest checking offline devices or investigating top device
    const recText = body.data.recommendations.join(' ');
    expect(recText).toMatch(/rmm_list_site_devices|rmm_get_device_health/);
  });
});
