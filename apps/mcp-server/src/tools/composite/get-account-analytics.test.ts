/**
 * Tests for rmm_get_account_analytics composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { getAccountAnalytics } from './get-account-analytics.js';

describe('rmm_get_account_analytics', () => {
  it('should provide comprehensive account analytics', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {
      time_range: 'month',
      metrics: ['devices', 'alerts', 'sites'],
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.timeRange).toBe('month');
    expect(body.data.account).toBeDefined();
    expect(body.data.metrics).toBeDefined();
    expect(body.data.metrics.devices).toBeDefined();
    expect(body.data.metrics.sites).toBeDefined();
    expect(body.data.metrics.alerts).toBeDefined();
  });

  it('should show device metrics', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {
      metrics: ['devices'],
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.metrics.devices).toBeDefined();

    const deviceMetrics = body.data.metrics.devices;
    expect(typeof deviceMetrics.total).toBe('number');
    expect(typeof deviceMetrics.online).toBe('number');
    expect(typeof deviceMetrics.offline).toBe('number');
    expect(deviceMetrics.byType).toBeDefined();
    expect(deviceMetrics.byOs).toBeDefined();
  });

  it('should show site metrics', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {
      metrics: ['sites'],
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.metrics.sites).toBeDefined();

    const siteMetrics = body.data.metrics.sites;
    expect(typeof siteMetrics.total).toBe('number');
    expect(typeof siteMetrics.avgDevicesPerSite).toBe('number');
    expect(siteMetrics.topSites).toBeInstanceOf(Array);
  });

  it('should show alert metrics', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {
      metrics: ['alerts'],
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.metrics.alerts).toBeDefined();

    const alertMetrics = body.data.metrics.alerts;
    expect(typeof alertMetrics.total).toBe('number');
    expect(typeof alertMetrics.critical).toBe('number');
    expect(alertMetrics.ageDistribution).toBeDefined();
    expect(alertMetrics.topTypes).toBeDefined();
  });

  it('should handle different time ranges', async () => {
    const client = createMockClient();

    const resultWeek = await getAccountAnalytics(client, {
      time_range: 'week',
    });

    const bodyWeek = JSON.parse(resultWeek.content[0]!.text);
    expect(bodyWeek.ok).toBe(true);
    expect(bodyWeek.data.timeRange).toBe('week');

    const resultQuarter = await getAccountAnalytics(client, {
      time_range: 'quarter',
    });

    const bodyQuarter = JSON.parse(resultQuarter.content[0]!.text);
    expect(bodyQuarter.ok).toBe(true);
    expect(bodyQuarter.data.timeRange).toBe('quarter');
  });

  it('should return account info', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.account).toBeDefined();
    expect(body.data.account.name).toBeDefined();
    expect(body.data.totalSites).toBeGreaterThanOrEqual(0);
    expect(body.data.totalDevices).toBeGreaterThanOrEqual(0);
  });

  it('should default to all metrics and month timerange', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.timeRange).toBe('month');
    expect(body.data.metrics.devices).toBeDefined();
    expect(body.data.metrics.sites).toBeDefined();
    expect(body.data.metrics.alerts).toBeDefined();
  });

  it('should calculate device type breakdown', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 4, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'server-01',
            siteName: 'Site 1',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'server-02',
            siteName: 'Site 1',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-3',
            hostname: 'workstation-01',
            siteName: 'Site 1',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Workstation' },
          },
          {
            uid: 'device-4',
            hostname: 'laptop-01',
            siteName: 'Site 1',
            siteUid: 'site-1',
            online: false,
            deviceType: { type: 'Laptop' },
          },
        ],
      },
    });

    const result = await getAccountAnalytics(client, {
      metrics: ['devices'],
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);

    const deviceMetrics = body.data.metrics.devices;
    expect(deviceMetrics.total).toBe(4);
    expect(deviceMetrics.online).toBe(3);
    expect(deviceMetrics.offline).toBe(1);
    expect(deviceMetrics.onlinePercent).toBe(75.0);
    expect(deviceMetrics.byType.Server).toBe(2);
    expect(deviceMetrics.byType.Workstation).toBe(1);
    expect(deviceMetrics.byType.Laptop).toBe(1);
  });

  it('should show alert age distribution', async () => {
    const now = Date.now();
    const client = createMockClient({
      alerts: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'alert-1',
            priority: 'Critical',
            diagnostics: 'Recent alert',
            timestamp: new Date(now - 1800000).toISOString(), // 30 min ago
            alertSourceInfo: { deviceUid: 'd1', siteUid: 's1' },
          },
          {
            alertUid: 'alert-2',
            priority: 'High',
            diagnostics: 'Today alert',
            timestamp: new Date(now - 18000000).toISOString(), // 5 hours ago
            alertSourceInfo: { deviceUid: 'd2', siteUid: 's1' },
          },
          {
            alertUid: 'alert-3',
            priority: 'Moderate',
            diagnostics: 'Stale alert',
            timestamp: new Date(now - 172800000).toISOString(), // 2 days ago
            alertSourceInfo: { deviceUid: 'd3', siteUid: 's1' },
          },
        ],
      },
    });

    const result = await getAccountAnalytics(client, {
      metrics: ['alerts'],
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);

    const alertMetrics = body.data.metrics.alerts;
    expect(alertMetrics.ageDistribution).toBeDefined();
    expect(alertMetrics.ageDistribution.recent).toBe(1);  // <1 hour
    expect(alertMetrics.ageDistribution.today).toBe(1);   // 1-24 hours
    expect(alertMetrics.ageDistribution.stale).toBe(1);   // >24 hours
  });

  it('should identify high offline device rates in metrics', async () => {
    const devices = Array.from({ length: 20 }, (_, i) => ({
      uid: `device-${i}`,
      hostname: `device-${i}`,
      siteName: 'Test Site',
      siteUid: 'site-1',
      online: i < 15, // 15 online, 5 offline = 25% offline
      deviceType: { type: 'Server' },
    }));

    const client = createMockClient({
      devices: {
        pageDetails: { count: 20, prevPageUrl: undefined, nextPageUrl: undefined },
        devices,
      },
    });

    const result = await getAccountAnalytics(client, {
      metrics: ['devices'],
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);

    const deviceMetrics = body.data.metrics.devices;
    expect(deviceMetrics.total).toBe(20);
    expect(deviceMetrics.online).toBe(15);
    expect(deviceMetrics.offline).toBe(5);
    expect(deviceMetrics.onlinePercent).toBe(75.0);
  });
});
