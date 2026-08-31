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

    const text = result.content[0]!.text;
    expect(text).toContain('# Devices: Acme Corp');
    expect(text).toContain('web-server-01');
    expect(text).toContain('db-server-01');
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

    const textOnline = resultOnline.content[0]!.text;
    expect(textOnline).toContain('online-server');
    expect(textOnline).not.toContain('offline-server');

    const resultOffline = await listSiteDevices(client, {
      site: 'Acme Corp',
      status: 'offline',
    });

    const textOffline = resultOffline.content[0]!.text;
    expect(textOffline).toContain('offline-server');
    expect(textOffline).not.toContain('online-server');
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

    const text = result.content[0]!.text;
    expect(text).toContain('server-01');
    expect(text).not.toContain('workstation-01');
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

    const text = result.content[0]!.text;
    expect(text).toContain('problem-server');
    expect(text).not.toContain('healthy-server');
    expect(text).toContain('1 open alert');
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

    const text = result.content[0]!.text;
    const alphaIndex = text.indexOf('alpha-server');
    const betaIndex = text.indexOf('beta-server');
    const zebraIndex = text.indexOf('zebra-server');

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

    const text = result.content[0]!.text;
    const manyIndex = text.indexOf('server-with-many-alerts');
    const fewIndex = text.indexOf('server-with-few-alerts');

    expect(manyIndex).toBeLessThan(fewIndex);
    expect(text).toContain('3 open alerts');
    expect(text).toContain('1 open alert');
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
    expect(result.content[0]!.text).toContain('Site not found');
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

    const text = result.content[0]!.text;
    expect(text).toContain('No devices found matching');
  });

  it('should provide recommendations', async () => {
    const client = createMockClient();

    const result = await listSiteDevices(client, { site: 'Acme Corp' });

    const text = result.content[0]!.text;
    expect(text).toContain('## 💡 Next Steps');
  });
});
