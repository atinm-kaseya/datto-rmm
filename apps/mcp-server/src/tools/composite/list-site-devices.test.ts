/**
 * Tests for rmm_list_site_devices composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { listSiteDevices } from './list-site-devices.js';

describe('rmm_list_site_devices', () => {
  it('should list all devices in a site', async () => {
    const client = createMockClient();
    const result = await listSiteDevices(client, { site: 'Acme Corp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeInstanceOf(Array);

    const hostnames = body.data.map((d: any) => d.hostname);
    expect(hostnames).toContain('web-server-01');
    expect(hostnames).toContain('db-server-01');
  });

  it('should filter devices by online status', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'online-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'offline-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: false,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const resultOnline = await listSiteDevices(client, {
      site: 'Acme Corp',
      status: 'online',
    });

    const bodyOnline = JSON.parse(resultOnline.content[0]!.text);
    expect(bodyOnline.ok).toBe(true);
    const onlineHostnames = bodyOnline.data.map((d: any) => d.hostname);
    expect(onlineHostnames).toContain('online-server');
    expect(onlineHostnames).not.toContain('offline-server');

    const resultOffline = await listSiteDevices(client, {
      site: 'Acme Corp',
      status: 'offline',
    });

    const bodyOffline = JSON.parse(resultOffline.content[0]!.text);
    expect(bodyOffline.ok).toBe(true);
    const offlineHostnames = bodyOffline.data.map((d: any) => d.hostname);
    expect(offlineHostnames).toContain('offline-server');
    expect(offlineHostnames).not.toContain('online-server');
  });

  it('should filter devices by type', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'server-01',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'workstation-01',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Workstation' },
          },
        ],
      },
    });

    const result = await listSiteDevices(client, {
      site: 'Acme Corp',
      type: 'server',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    const hostnames = body.data.map((d: any) => d.hostname);
    expect(hostnames).toContain('server-01');
    expect(hostnames).not.toContain('workstation-01');
  });

  it('should filter devices with alerts', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'problem-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'healthy-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
      siteAlerts: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'alert-1',
            priority: 'Critical',
            diagnostics: 'Disk Space Low',
            alertSourceInfo: {
              deviceUid: 'device-1',
              deviceName: 'problem-server',
              siteUid: 'site-1',
              siteName: 'Test Site',
            },
          },
        ],
      },
    });

    const result = await listSiteDevices(client, {
      site: 'Acme Corp',
      has_alerts: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    const hostnames = body.data.map((d: any) => d.hostname);
    expect(hostnames).toContain('problem-server');
    expect(hostnames).not.toContain('healthy-server');
    // device-1 has 1 alert
    const problemDevice = body.data.find((d: any) => d.hostname === 'problem-server');
    expect(problemDevice.alertCount).toBe(1);
  });

  it('should sort devices by name', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-3',
            hostname: 'zebra-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-1',
            hostname: 'alpha-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'beta-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await listSiteDevices(client, {
      site: 'Acme Corp',
      sort_by: 'name',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);

    const hostnames = body.data.map((d: any) => d.hostname);
    const alphaIndex = hostnames.indexOf('alpha-server');
    const betaIndex = hostnames.indexOf('beta-server');
    const zebraIndex = hostnames.indexOf('zebra-server');

    expect(alphaIndex).toBeLessThan(betaIndex);
    expect(betaIndex).toBeLessThan(zebraIndex);
  });

  it('should sort devices by alert count', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'server-with-many-alerts',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'server-with-few-alerts',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
      siteAlerts: {
        pageDetails: { count: 4, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'alert-1',
            priority: 'Critical',
            diagnostics: 'Alert 1',
            alertSourceInfo: { deviceUid: 'device-1', siteUid: 'site-1' },
          },
          {
            alertUid: 'alert-2',
            priority: 'Critical',
            diagnostics: 'Alert 2',
            alertSourceInfo: { deviceUid: 'device-1', siteUid: 'site-1' },
          },
          {
            alertUid: 'alert-3',
            priority: 'High',
            diagnostics: 'Alert 3',
            alertSourceInfo: { deviceUid: 'device-1', siteUid: 'site-1' },
          },
          {
            alertUid: 'alert-4',
            priority: 'High',
            diagnostics: 'Alert 4',
            alertSourceInfo: { deviceUid: 'device-2', siteUid: 'site-1' },
          },
        ],
      },
    });

    const result = await listSiteDevices(client, {
      site: 'Acme Corp',
      sort_by: 'alerts',
      has_alerts: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);

    const hostnames = body.data.map((d: any) => d.hostname);
    const manyIndex = hostnames.indexOf('server-with-many-alerts');
    const fewIndex = hostnames.indexOf('server-with-few-alerts');

    expect(manyIndex).toBeLessThan(fewIndex);

    const manyDevice = body.data.find((d: any) => d.hostname === 'server-with-many-alerts');
    const fewDevice = body.data.find((d: any) => d.hostname === 'server-with-few-alerts');
    expect(manyDevice.alertCount).toBe(3);
    expect(fewDevice.alertCount).toBe(1);
  });

  it('should handle site not found', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [],
      },
    });

    const result = await listSiteDevices(client, {
      site: 'nonexistent',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Site not found');
  });

  it('should handle no devices matching filters', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'server-01',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await listSiteDevices(client, {
      site: 'Acme Corp',
      status: 'offline',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('should return device structure fields', async () => {
    const client = createMockClient();

    const result = await listSiteDevices(client, { site: 'Acme Corp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    if (body.data.length > 0) {
      const device = body.data[0];
      expect(device).toHaveProperty('hostname');
      expect(device).toHaveProperty('uid');
      expect(device).toHaveProperty('online');
      expect(device).toHaveProperty('deviceType');
      expect(device).toHaveProperty('alertCount');
    }
  });
});
