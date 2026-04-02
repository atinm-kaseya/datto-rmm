/**
 * Tests for get-site-health composite tool
 */

import { describe, it, expect } from 'vitest';
import { getSiteHealth } from './get-site-health.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('get-site-health', () => {
  it('should return comprehensive site health', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, { site: 'Acme Corp' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);

    const text = result.content[0]!.text;
    
    // Check header
    expect(text).toContain('# Site Health: Acme Corp');
    expect(text).toContain('**Site UID:**');
    
    // Check device stats
    expect(text).toContain('## 📊 Devices');
    expect(text).toContain('**Total:**');
    expect(text).toContain('online');
    expect(text).toContain('offline');
    
    // Check alerts section
    expect(text).toContain('## ⚠️  Open Alerts');
    
    // Check recommendations
    expect(text).toContain('## 💡 Recommended Actions');
  });

  it('should resolve site by UID directly', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, { site: 'site-1' });

    expect(result.isError).toBeUndefined();
    const text = result.content[0]!.text;
    expect(text).toContain('# Site Health: Acme Corp');
  });

  it('should show device breakdown by type', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 6, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          { uid: 'd1', hostname: 'server-01', online: true, deviceType: { type: 'Server' } },
          { uid: 'd2', hostname: 'server-02', online: true, deviceType: { type: 'Server' } },
          { uid: 'd3', hostname: 'server-03', online: false, deviceType: { type: 'Server' } },
          { uid: 'd4', hostname: 'ws-01', online: true, deviceType: { type: 'Workstation' } },
          { uid: 'd5', hostname: 'ws-02', online: true, deviceType: { type: 'Workstation' } },
          { uid: 'd6', hostname: 'laptop-01', online: false, deviceType: { type: 'Laptop' } },
        ],
      },
    });

    const result = await getSiteHealth(client, { site: 'site-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('**Device Breakdown:**');
    expect(text).toContain('Server: 3');
    expect(text).toContain('Workstation: 2');
    expect(text).toContain('Laptop: 1');
    expect(text).toContain('1 offline');
  });

  it('should include full device list when requested', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, { 
      site: 'site-1',
      include_device_details: true,
    });

    const text = result.content[0]!.text;
    
    expect(text).toContain('## 📋 All Devices');
    expect(text).toContain('web-server-01');
    expect(text).toContain('🟢'); // Online indicator
  });

  it('should show top devices with most alerts', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 5, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          { alertUid: 'a1', priority: 'Critical', alertSourceInfo: { deviceUid: 'device-1' } },
          { alertUid: 'a2', priority: 'Critical', alertSourceInfo: { deviceUid: 'device-1' } },
          { alertUid: 'a3', priority: 'Critical', alertSourceInfo: { deviceUid: 'device-1' } },
          { alertUid: 'a4', priority: 'High', alertSourceInfo: { deviceUid: 'device-2' } },
          { alertUid: 'a5', priority: 'High', alertSourceInfo: { deviceUid: 'device-2' } },
        ],
      },
    });

    const result = await getSiteHealth(client, { site: 'site-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 🔴 Top Devices With Alerts');
    expect(text).toContain('**web-server-01** - 3 alerts');
  });

  it('should show network configuration if proxy exists', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, { site: 'site-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 🌐 Network Configuration');
    expect(text).toContain('**Proxy:**');
    expect(text).toContain('10.0.1.1:8080');
  });

  it('should show no alerts message when site is healthy', async () => {
    const client = createMockClient({
      siteAlerts: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [],
      },
    });

    const result = await getSiteHealth(client, { site: 'site-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## ✅ No Open Alerts');
  });

  it('should return error for non-existent site', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [],
      },
    });

    const result = await getSiteHealth(client, { site: 'NonExistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Site not found');
  });

  it('should provide actionable recommendations', async () => {
    const client = createMockClient();
    const result = await getSiteHealth(client, { site: 'site-1' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('💡 Recommended Actions');
    // Should suggest checking offline devices or investigating top device
    expect(text).toMatch(/list-site-devices|get-device-health/);
  });
});
