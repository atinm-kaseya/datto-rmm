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
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.scope).toBe('account');
    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.critical).toBe('number');
    expect(typeof body.data.warning).toBe('number');
    expect(body.data.groups).toBeInstanceOf(Array);
    expect(body.count).toBeGreaterThanOrEqual(0);
  });

  it('should filter to specific site', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, { site: 'Acme Corp' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.scope).toBe('site-1');
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
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.groups).toBeInstanceOf(Array);

    const diskGroup = body.data.groups.find((g: any) => g.key === 'Disk Space');
    expect(diskGroup).toBeDefined();
    expect(diskGroup.count).toBe(2);
  });

  it('should group alerts by device', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, { group_by: 'device' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.groups).toBeInstanceOf(Array);
    // Groups should be keyed by device name
    if (body.data.groups.length > 0) {
      expect(body.data.groups[0]).toHaveProperty('key');
      expect(body.data.groups[0]).toHaveProperty('count');
    }
  });

  it('should group alerts by site', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, { group_by: 'site' });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.groups).toBeInstanceOf(Array);
    if (body.data.groups.length > 0) {
      expect(body.data.groups[0]).toHaveProperty('key');
    }
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
    const bodyCritical = JSON.parse(resultCritical.content[0]!.text);

    expect(bodyCritical.ok).toBe(true);
    expect(bodyCritical.data.total).toBe(1);
    expect(bodyCritical.data.critical).toBe(1);
    expect(bodyCritical.count).toBe(1);
  });

  it('should include time range in response', async () => {
    const client = createMockClient({
      alerts: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'a1',
            priority: 'Critical',
            diagnostics: 'Recent alert',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            alertSourceInfo: { deviceUid: 'd1', siteUid: 's1' },
          },
          {
            alertUid: 'a2',
            priority: 'High',
            diagnostics: 'Day old alert',
            timestamp: new Date(Date.now() - 18000000).toISOString(),
            alertSourceInfo: { deviceUid: 'd2', siteUid: 's1' },
          },
          {
            alertUid: 'a3',
            priority: 'Moderate',
            diagnostics: 'Stale alert',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            alertSourceInfo: { deviceUid: 'd3', siteUid: 's1' },
          },
        ],
      },
    });

    const result = await getAlertSummary(client, { time_range: 'today' });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.timeRange).toBe('today');
    expect(body.data.total).toBeGreaterThan(0);
  });

  it('should handle empty alerts', async () => {
    const client = createMockClient({
      alerts: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [],
      },
    });

    const result = await getAlertSummary(client, {});
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(0);
    expect(body.data.groups).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('should return count field matching total', async () => {
    const client = createMockClient();
    const result = await getAlertSummary(client, {});

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(body.data.total);
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
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Site not found');
  });
});
