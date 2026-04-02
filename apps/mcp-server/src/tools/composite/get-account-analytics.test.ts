/**
 * Tests for get-account-analytics composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { getAccountAnalytics } from './get-account-analytics.js';

describe('get-account-analytics', () => {
  it('should provide comprehensive account analytics', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {
      time_range: 'month',
      metrics: ['devices', 'alerts', 'sites'],
    });

    const text = result.content[0]!.text;
    expect(text).toContain('# Account Analytics');
    expect(text).toContain('**Time Range:** Last 30 days');
    expect(text).toContain('## 📊 Device Metrics');
    expect(text).toContain('## 🏢 Site Metrics');
    expect(text).toContain('## ⚠️  Alert Metrics');
    expect(text).toContain('## 💡 Insights & Recommendations');
  });

  it('should show device metrics', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {
      metrics: ['devices'],
    });

    const text = result.content[0]!.text;
    expect(text).toContain('**Total Devices:**');
    expect(text).toContain('**Online:**');
    expect(text).toContain('**Device Types:**');
    expect(text).toContain('**Operating Systems:**');
  });

  it('should show site metrics', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {
      metrics: ['sites'],
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## 🏢 Site Metrics');
    expect(text).toContain('**Total Sites:**');
    expect(text).toContain('**Top Sites by Device Count:**');
  });

  it('should show alert metrics', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {
      metrics: ['alerts'],
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## ⚠️  Alert Metrics');
    expect(text).toContain('**Total Open Alerts:**');
    expect(text).toContain('**Alert Age Distribution:**');
    expect(text).toContain('**Most Common Alert Types:**');
  });

  it('should handle different time ranges', async () => {
    const client = createMockClient();

    const resultWeek = await getAccountAnalytics(client, {
      time_range: 'week',
    });

    const textWeek = resultWeek.content[0]!.text;
    expect(textWeek).toContain('**Time Range:** Last 7 days');

    const resultQuarter = await getAccountAnalytics(client, {
      time_range: 'quarter',
    });

    const textQuarter = resultQuarter.content[0]!.text;
    expect(textQuarter).toContain('**Time Range:** Last 90 days');
  });

  it('should provide actionable insights', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {});

    const text = result.content[0]!.text;
    expect(text).toContain('## 💡 Insights & Recommendations');
    expect(text).toContain('**Suggested Actions:**');
  });

  it('should default to all metrics and month timerange', async () => {
    const client = createMockClient();

    const result = await getAccountAnalytics(client, {});

    const text = result.content[0]!.text;
    expect(text).toContain('**Time Range:** Last 30 days');
    expect(text).toContain('## 📊 Device Metrics');
    expect(text).toContain('## 🏢 Site Metrics');
    expect(text).toContain('## ⚠️  Alert Metrics');
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

    const text = result.content[0]!.text;
    expect(text).toContain('Server: 2 devices');
    expect(text).toContain('Workstation: 1 device');
    expect(text).toContain('Laptop: 1 device');
    expect(text).toContain('**Online:** 3 (75.0%) | **Offline:** 1');
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

    const text = result.content[0]!.text;
    expect(text).toContain('**Alert Age Distribution:**');
    expect(text).toContain('<1 hour: 1 alert');
    expect(text).toContain('1-24 hours: 1 alert');
    expect(text).toContain('>24 hours: 1 alert');
  });

  it('should identify high offline device rates', async () => {
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

    const text = result.content[0]!.text;
    expect(text).toContain('High offline device rate');
    expect(text).toContain('25.0%');
  });
});
