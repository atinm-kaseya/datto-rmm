/**
 * Tests for investigate-alert composite tool
 */

import { describe, it, expect } from 'vitest';
import { investigateAlert } from './investigate-alert.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('investigate-alert', () => {
  it('should provide comprehensive alert investigation', async () => {
    const client = createMockClient({
      alert: {
        alertUid: 'alert-1',
        priority: 'Critical',
        diagnostics: 'Disk Space: C drive at 95%',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'web-server-01',
          siteUid: 'site-1',
          siteName: 'Acme Corp',
        },
      },
    });

    const result = await investigateAlert(client, { alert_uid: 'alert-1' });

    expect(result.isError).toBeUndefined();
    const text = result.content[0]!.text;
    
    expect(text).toContain('# Alert Investigation:');
    expect(text).toContain('**Alert UID:**');
    expect(text).toContain('## 📱 Device Context');
    expect(text).toContain('## 📊 Impact Assessment');
    expect(text).toContain('## 💡 Resolution Suggestions');
  });

  it('should find similar alerts when requested', async () => {
    const client = createMockClient({
      alert: {
        alertUid: 'alert-1',
        priority: 'Critical',
        diagnostics: 'Disk Space: Low',
        timestamp: new Date().toISOString(),
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'server-01',
          siteUid: 'site-1',
          siteName: 'Site A',
        },
      },
      alerts: {
        pageDetails: { count: 5, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'alert-1',
            priority: 'Critical',
            diagnostics: 'Disk Space: Low',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'device-1', deviceName: 'server-01', siteUid: 'site-1', siteName: 'Site A' },
          },
          {
            alertUid: 'alert-2',
            priority: 'Critical',
            diagnostics: 'Disk Space: Critical',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'device-2', deviceName: 'server-02', siteUid: 'site-1', siteName: 'Site A' },
          },
          {
            alertUid: 'alert-3',
            priority: 'High',
            diagnostics: 'Disk Space: Warning',
            timestamp: new Date().toISOString(),
            alertSourceInfo: { deviceUid: 'device-3', deviceName: 'server-03', siteUid: 'site-2', siteName: 'Site B' },
          },
        ],
      },
    });

    const result = await investigateAlert(client, { 
      alert_uid: 'alert-1',
      include_similar: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## 🔍 Similar Alerts');
    expect(text).toContain('server-02');
    expect(text).toContain('Pattern detected');
  });

  it('should assess impact correctly', async () => {
    const client = createMockClient({
      alert: {
        alertUid: 'alert-1',
        priority: 'Critical',
        diagnostics: 'Test alert',
        timestamp: new Date().toISOString(),
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'test-device',
          siteUid: 'site-1',
          siteName: 'Test Site',
        },
      },
    });

    const result = await investigateAlert(client, { alert_uid: 'alert-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 📊 Impact Assessment');
    expect(text).toContain('**Severity:** Critical');
  });

  it('should provide resolution suggestions', async () => {
    const client = createMockClient({
      alert: {
        alertUid: 'alert-1',
        priority: 'Critical',
        diagnostics: 'Service Down: SQL Server',
        timestamp: new Date().toISOString(),
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'db-server',
          siteUid: 'site-1',
          siteName: 'Test Site',
        },
      },
    });

    const result = await investigateAlert(client, { alert_uid: 'alert-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 💡 Resolution Suggestions');
    expect(text).toContain('service');
  });

  it('should handle alert not found', async () => {
    const client = createMockClient();
    // Override GET to return error for specific alert
    const originalGET = client.GET;
    (client as any).GET = async (path: string, ...args: any[]) => {
      if (path === '/v2/alert/{alertUid}') {
        return { data: null, error: { code: 404, message: 'Not found' }, response: new Response() };
      }
      return originalGET(path as any, ...args);
    };

    const result = await investigateAlert(client, { alert_uid: 'nonexistent' });
    
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Alert not found');
  });

  it('should work without similar alerts option', async () => {
    const mockClient = createMockClient({
      alert: {
        alertUid: 'alert-1',
        priority: 'High',
        diagnostics: 'Test alert',
        timestamp: new Date().toISOString(),
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'test',
          siteUid: 'site-1',
          siteName: 'Test',
        },
      },
    });

    const result = await investigateAlert(mockClient, {
      alert_uid: 'alert-1',
      include_similar: false,
    });

    const text = result.content[0]!.text;
    expect(text).not.toContain('## 🔍 Similar Alerts');
  });
});
