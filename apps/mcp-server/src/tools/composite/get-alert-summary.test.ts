/**
 * Tests for rmm_get_alert_summary composite tool
 */

import { describe, it, expect } from 'vitest';
import { getAlertSummary } from './get-alert-summary.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('rmm_get_alert_summary', () => {
  it('should return account-wide alert summary', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, {});

    expect(result.isError).toBeUndefined();
    const text = result.content[0]!.text;
    
    expect(text).toContain('# Alert Summary: Account-Wide');
    expect(text).toContain('## 📊 Overview');
    expect(text).toContain('**Total Open Alerts:**');
    expect(text).toContain('## 📋 Grouped by Type');
  });

  it('should filter to specific site', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, { site: 'Acme Corp' });

    const text = result.content[0]!.text;
    expect(text).toContain('# Alert Summary: Acme Corp');
  });

  it('should group alerts by type', async () => {
    const client = createMockClient({
      alerts: {
        pageDetails: { count: 5, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'a1',
            priority: 'Critical',
            diagnostics: 'Disk Space: Low',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'd1', deviceName: 'server-1', siteUid: 's1', siteName: 'Site A' },
          },
          {
            alertUid: 'a2',
            priority: 'Critical',
            diagnostics: 'Disk Space: Critical',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'd2', deviceName: 'server-2', siteUid: 's1', siteName: 'Site A' },
          },
          {
            alertUid: 'a3',
            priority: 'High',
            diagnostics: 'Service Down: IIS',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'd3', deviceName: 'server-3', siteUid: 's1', siteName: 'Site A' },
          },
        ],
      },
    });

    const result = await getAlertSummary(client, { group_by: 'type' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 📋 Grouped by Type');
    expect(text).toContain('Disk Space');
    expect(text).toContain('2 alert(s)');
  });

  it('should group alerts by device', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, { group_by: 'device' });

    const text = result.content[0]!.text;
    expect(text).toContain('## 📋 Grouped by Device');
  });

  it('should group alerts by site', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, { group_by: 'site' });

    const text = result.content[0]!.text;
    expect(text).toContain('## 📋 Grouped by Site');
  });

  it('should filter by severity', async () => {
    const client = createMockClient({
      alerts: {
        pageDetails: { count: 5, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'a1',
            priority: 'Critical',
            diagnostics: 'Critical alert',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'd1', siteUid: 's1' },
          },
          {
            alertUid: 'a2',
            priority: 'High',
            diagnostics: 'High alert',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'd2', siteUid: 's1' },
          },
          {
            alertUid: 'a3',
            priority: 'Low',
            diagnostics: 'Low alert',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'd3', siteUid: 's1' },
          },
        ],
      },
    });

    const resultCritical = await getAlertSummary(client, { severity: 'critical' });
    const textCritical = resultCritical.content[0]!.text;
    
    expect(textCritical).toContain('**Total Open Alerts:** 1');
    expect(textCritical).toContain('🔴 Critical: 1');
  });

  it('should analyze alert age distribution', async () => {
    const now = Date.now();
    const client = createMockClient({
      alerts: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'a1',
            priority: 'Critical',
            diagnostics: 'Recent alert',
            timestamp: new Date(now - 1800000).toISOString(), // 30 min ago
            alertSourceInfo: { deviceUid: 'd1', siteUid: 's1' },
          },
          {
            alertUid: 'a2',
            priority: 'High',
            diagnostics: 'Day old alert',
            timestamp: new Date(now - 18000000).toISOString(), // 5 hours ago
            alertSourceInfo: { deviceUid: 'd2', siteUid: 's1' },
          },
          {
            alertUid: 'a3',
            priority: 'Moderate',
            diagnostics: 'Stale alert',
            timestamp: new Date(now - 172800000).toISOString(), // 2 days ago
            alertSourceInfo: { deviceUid: 'd3', siteUid: 's1' },
          },
        ],
      },
    });

    const result = await getAlertSummary(client, {});
    const text = result.content[0]!.text;
    
    expect(text).toContain('## ⏱️  Alert Age');
    expect(text).toContain('<1 hour:');
    expect(text).toContain('1-24 hours:');
    expect(text).toContain('>24 hours:');
  });

  it('should show no alerts message when empty', async () => {
    const client = createMockClient({
      alerts: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [],
      },
    });

    const result = await getAlertSummary(client, {});
    const text = result.content[0]!.text;
    
    expect(text).toContain('## ✅ No Alerts');
    expect(text).toContain('No alerts match');
  });

  it('should provide recommendations', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, {});

    const text = result.content[0]!.text;
    expect(text).toContain('## 💡 Recommendations');
  });

  it('should handle site not found', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [],
      },
    });

    const result = await getAlertSummary(client, { site: 'NonExistent' });
    
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Site not found');
  });
});
