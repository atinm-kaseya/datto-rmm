/**
 * Tests for rmm_investigate_alert composite tool
 */

import { describe, it, expect } from 'vitest';
import { investigateAlert } from './investigate-alert.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('rmm_investigate_alert', () => {
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
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.alert).toBeDefined();
    expect(body.data.alert.uid).toBe('alert-1');
    expect(body.data.alert.priority).toBe('Critical');
    expect(body.data.device).toBeDefined();
    expect(body.data.impact).toBeDefined();
    expect(body.data.resolutionSuggestions).toBeInstanceOf(Array);
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

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.similarAlerts).toBeInstanceOf(Array);
    expect(body.data.similarAlerts.length).toBeGreaterThan(0);

    const deviceNames = body.data.similarAlerts.map((a: any) => a.deviceName);
    expect(deviceNames).toContain('server-02');
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
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.impact).toBeDefined();
    expect(body.data.impact).toContain('Critical');
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
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data.resolutionSuggestions).toBeInstanceOf(Array);
    expect(body.data.resolutionSuggestions.length).toBeGreaterThan(0);

    const suggestionText = body.data.resolutionSuggestions.join(' ').toLowerCase();
    expect(suggestionText).toContain('service');
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
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Alert not found');
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

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.similarAlerts).toHaveLength(0);
  });
});
