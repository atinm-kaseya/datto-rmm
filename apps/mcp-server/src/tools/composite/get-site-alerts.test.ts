/**
 * Tests for rmm_get_site_alerts composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { getSiteAlerts } from './get-site-alerts.js';

describe('rmm_get_site_alerts', () => {
  it('should provide comprehensive site alert overview', async () => {
    const client = createMockClient();
    const result = await getSiteAlerts(client, { site: 'Acme Corp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.total).toBeGreaterThanOrEqual(0);
    expect(body.data.critical).toBeGreaterThanOrEqual(0);
    expect(body.data.warning).toBeGreaterThanOrEqual(0);
    expect(body.data.groups).toBeInstanceOf(Array);
  });

  it('should group alerts by type', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'alert-1',
            priority: 'Critical',
            diagnostics: 'Disk Space: C drive at 95%',
            alertSourceInfo: {
              deviceUid: 'device-1',
              deviceName: 'server-01',
              siteUid: 'site-1',
              siteName: 'Test Site',
            },
          },
          {
            alertUid: 'alert-2',
            priority: 'Critical',
            diagnostics: 'Disk Space: D drive at 92%',
            alertSourceInfo: {
              deviceUid: 'device-2',
              deviceName: 'server-02',
              siteUid: 'site-1',
              siteName: 'Test Site',
            },
          },
          {
            alertUid: 'alert-3',
            priority: 'High',
            diagnostics: 'Service Down: IIS',
            alertSourceInfo: {
              deviceUid: 'device-1',
              deviceName: 'server-01',
              siteUid: 'site-1',
              siteName: 'Test Site',
            },
          },
        ],
      },
    });

    const result = await getSiteAlerts(client, {
      site: 'Acme Corp',
      group_by: 'type',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.groups).toBeInstanceOf(Array);
    expect(body.data.groups.length).toBeGreaterThan(0);

    const groupKeys = body.data.groups.map((g: any) => g.key);
    expect(groupKeys).toContain('Disk Space');
    expect(groupKeys).toContain('Service Down');

    const diskGroup = body.data.groups.find((g: any) => g.key === 'Disk Space');
    expect(diskGroup.alerts).toHaveLength(2);
  });

  it('should group alerts by device', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'alert-1',
            priority: 'Critical',
            diagnostics: 'Disk Space Low',
            alertSourceInfo: {
              deviceUid: 'device-1',
              deviceName: 'server-01',
              siteUid: 'site-1',
              siteName: 'Test Site',
            },
          },
          {
            alertUid: 'alert-2',
            priority: 'High',
            diagnostics: 'High CPU',
            alertSourceInfo: {
              deviceUid: 'device-1',
              deviceName: 'server-01',
              siteUid: 'site-1',
              siteName: 'Test Site',
            },
          },
          {
            alertUid: 'alert-3',
            priority: 'Moderate',
            diagnostics: 'Service Warning',
            alertSourceInfo: {
              deviceUid: 'device-2',
              deviceName: 'server-02',
              siteUid: 'site-1',
              siteName: 'Test Site',
            },
          },
        ],
      },
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
            hostname: 'server-02',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await getSiteAlerts(client, {
      site: 'Acme Corp',
      group_by: 'device',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.groups).toBeInstanceOf(Array);

    const server01Group = body.data.groups.find((g: any) => g.key === 'server-01');
    expect(server01Group).toBeDefined();
    expect(server01Group.alerts).toHaveLength(2);

    const server02Group = body.data.groups.find((g: any) => g.key === 'server-02');
    expect(server02Group).toBeDefined();
    expect(server02Group.alerts).toHaveLength(1);
  });

  it('should filter alerts by severity', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'alert-1',
            priority: 'Critical',
            diagnostics: 'Critical issue',
            alertSourceInfo: {
              deviceUid: 'device-1',
              siteUid: 'site-1',
            },
          },
          {
            alertUid: 'alert-2',
            priority: 'High',
            diagnostics: 'High priority issue',
            alertSourceInfo: {
              deviceUid: 'device-2',
              siteUid: 'site-1',
            },
          },
        ],
      },
    });

    const resultCritical = await getSiteAlerts(client, {
      site: 'Acme Corp',
      severity: 'critical',
    });

    const bodyCritical = JSON.parse(resultCritical.content[0]!.text);
    expect(bodyCritical.ok).toBe(true);
    expect(bodyCritical.data.total).toBe(1);
    expect(bodyCritical.data.critical).toBe(1);

    // All alerts in groups should have Critical priority
    const allAlerts = bodyCritical.data.groups.flatMap((g: any) => g.alerts);
    for (const alert of allAlerts) {
      expect(alert.priority).toBe('Critical');
    }
  });

  it('should handle no alerts', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [],
      },
    });

    const result = await getSiteAlerts(client, { site: 'Acme Corp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(0);
    expect(body.data.groups).toHaveLength(0);
  });

  it('should handle site not found', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [],
      },
    });

    const result = await getSiteAlerts(client, { site: 'nonexistent' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Site not found');
  });

  it('should return alert counts', async () => {
    const client = createMockClient();

    const result = await getSiteAlerts(client, { site: 'Acme Corp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(0);
    expect(typeof body.data.critical).toBe('number');
    expect(typeof body.data.warning).toBe('number');
  });
});
