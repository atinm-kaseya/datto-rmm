/**
 * Tests for get-site-alerts composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { getSiteAlerts } from './get-site-alerts.js';

describe('get-site-alerts', () => {
  it('should provide comprehensive site alert overview', async () => {
    const client = createMockClient();
    const result = await getSiteAlerts(client, { site: 'Acme Corp' });

    const text = result.content[0]!.text;
    expect(text).toContain('# Site Alerts: Acme Corp');
    expect(text).toContain('**Total:**');
    expect(text).toContain('**Severity:**');
    expect(text).toContain('## 💡 Recommended Actions');
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

    const text = result.content[0]!.text;
    expect(text).toContain('## Grouped by Alert Type');
    expect(text).toContain('Disk Space');
    expect(text).toContain('Service Down');
    expect(text).toContain('Affected devices:');
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

    const text = result.content[0]!.text;
    expect(text).toContain('## Grouped by Device');
    expect(text).toContain('server-01 (2 alerts)');
    expect(text).toContain('server-02 (1 alert');
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

    const textCritical = resultCritical.content[0]!.text;
    expect(textCritical).toContain('Critical issue');
    expect(textCritical).not.toContain('High priority issue');
  });

  it('should handle no alerts', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [],
      },
    });

    const result = await getSiteAlerts(client, { site: 'Acme Corp' });

    const text = result.content[0]!.text;
    expect(text).toContain('✅ **No open alerts**');
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
    expect(result.content[0]!.text).toContain('Site not found');
  });

  it('should provide actionable recommendations', async () => {
    const client = createMockClient();

    const result = await getSiteAlerts(client, { site: 'Acme Corp' });

    const text = result.content[0]!.text;
    expect(text).toContain('## 💡 Recommended Actions');
  });
});
