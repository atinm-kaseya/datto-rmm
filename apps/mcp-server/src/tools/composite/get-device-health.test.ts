/**
 * Tests for get-device-health composite tool
 */

import { describe, it, expect } from 'vitest';
import { getDeviceHealth } from './get-device-health.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('get-device-health', () => {
  it('should return comprehensive device health report', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'web-server-01' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);

    const text = result.content[0]!.text;
    
    expect(text).toContain('# Device Health:');
    expect(text).toContain('**Device UID:**');
    expect(text).toContain('**Site:**');
    expect(text).toContain('## 🟢 Status:');
    expect(text).toContain('## 💻 System Information');
  });

  it('should resolve device by UID directly', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'device-1' });

    expect(result.isError).toBeUndefined();
    const text = result.content[0]!.text;
    expect(text).toContain('web-server-01');
  });

  it('should filter by site when multiple matches', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'server-01',
            siteName: 'Acme Corp',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'server-01',
            siteName: 'TechStart Inc',
            siteUid: 'site-2',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await getDeviceHealth(client, { 
      device: 'server-01',
      site: 'Acme',
    });

    const text = result.content[0]!.text;
    expect(text).toContain('Acme Corp');
    expect(text).not.toContain('TechStart');
  });

  it('should show hardware information when available', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'device-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 🔧 Hardware');
    expect(text).toContain('**CPU:**');
    expect(text).toContain('**RAM:**');
    expect(text).toContain('**Disks:**');
  });

  it('should highlight critical disk usage', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'device-1' });
    const text = result.content[0]!.text;
    
    // Check for disk usage warnings
    expect(text).toMatch(/\d+\.\d+%/); // Percentage format
  });

  it('should show open alerts with severity', async () => {
    const client = createMockClient({
      deviceAlerts: {
        pageDetails: { count: 3, totalCount: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'a1',
            priority: 'Critical',
            diagnostics: 'Disk Space Critical',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            alertUid: 'a2',
            priority: 'High',
            diagnostics: 'High CPU Usage',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
          },
        ],
      },
    });

    const result = await getDeviceHealth(client, { device: 'device-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## ⚠️  Open Alerts (2)');
    expect(text).toContain('**Critical');
    expect(text).toContain('Disk Space Critical');
  });

  it('should include job history when requested', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { 
      device: 'device-1',
      include_history: true,
    });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 📋 Recent Jobs');
  });

  it('should provide actionable recommendations', async () => {
    const client = createMockClient();
    const result = await getDeviceHealth(client, { device: 'device-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 💡 Recommended Actions');
  });

  it('should handle offline devices', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [{
          uid: 'device-1',
          hostname: 'offline-server',
          siteName: 'Test Site',
          siteUid: 'site-1',
          online: false,
          deviceType: { type: 'Server' },
          lastSeen: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        }],
      },
      device: {
        uid: 'device-1',
        hostname: 'offline-server',
        siteName: 'Test Site',
        siteUid: 'site-1',
        online: false,
        deviceType: { type: 'Server' },
        lastSeen: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
    });

    const result = await getDeviceHealth(client, { device: 'offline-server' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('🔴 Status: Offline');
    expect(text).toContain('🔴 **Device is offline**');
  });

  it('should handle non-existent device', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [],
      },
    });

    const result = await getDeviceHealth(client, { device: 'nonexistent' });
    
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Device not found');
  });
});
