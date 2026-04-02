/**
 * Tests for search-devices composite tool
 */

import { describe, it, expect } from 'vitest';
import { searchDevices } from './search-devices.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('search-devices', () => {
  it('should search devices by hostname', async () => {
    const client = createMockClient();
    const result = await searchDevices(client, { query: 'web-server' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);

    const text = result.content[0]!.text;
    
    expect(text).toContain('# Device Search Results');
    expect(text).toContain('web-server-01');
    expect(text).toContain('Query: "web-server"');
  });

  it('should filter by online status', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          { uid: 'd1', hostname: 'online-device', online: true, siteName: 'Site A', deviceType: { type: 'Server' } },
          { uid: 'd2', hostname: 'offline-device', online: false, siteName: 'Site A', deviceType: { type: 'Server' } },
        ],
      },
    });

    // Search for online only
    const resultOnline = await searchDevices(client, { status: 'online', query: 'device' });
    const textOnline = resultOnline.content[0]!.text;
    
    expect(textOnline).toContain('online-device');
    expect(textOnline).toContain('Status: online');
    
    // Search for offline only
    const resultOffline = await searchDevices(client, { status: 'offline', query: 'device' });
    const textOffline = resultOffline.content[0]!.text;
    
    expect(textOffline).toContain('offline-device');
  });

  it('should show alert counts for devices', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          { 
            uid: 'device-1', 
            hostname: 'test-device', 
            online: true, 
            siteName: 'Test Site',
            siteUid: 'site-1',
            deviceType: { type: 'Server' },
            operatingSystem: 'Windows Server 2022',
          },
        ],
      },
      deviceAlerts: {
        pageDetails: { count: 3, totalCount: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          { alertUid: 'a1', priority: 'Critical' },
          { alertUid: 'a2', priority: 'High' },
          { alertUid: 'a3', priority: 'Moderate' },
        ],
      },
    });

    const result = await searchDevices(client, { query: 'test-device' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('⚠️  3 open');
  });

  it('should show no results message when nothing found', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [],
      },
    });

    const result = await searchDevices(client, { query: 'nonexistent' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('No devices found');
    expect(text).toContain('**Suggestions:**');
  });

  it('should limit results correctly', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 50, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: Array(50).fill(null).map((_, i) => ({
          uid: `device-${i}`,
          hostname: `device-${i}`,
          online: true,
          siteName: 'Test Site',
          deviceType: { type: 'Server' },
        })),
      },
    });

    const result = await searchDevices(client, { limit: 5 });
    const text = result.content[0]!.text;
    
    expect(text).toContain('**Found:** 5 device(s)');
    expect(text).toContain('Showing first 5 results');
  });

  it('should rank exact hostname matches higher', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          { uid: 'd1', hostname: 'web-server-prod', online: true, siteName: 'Site A', deviceType: { type: 'Server' } },
          { uid: 'd2', hostname: 'web-server', online: true, siteName: 'Site B', deviceType: { type: 'Server' } },
          { uid: 'd3', hostname: 'server-web-backup', online: true, siteName: 'Site C', deviceType: { type: 'Server' } },
        ],
      },
    });

    const result = await searchDevices(client, { query: 'web-server' });
    const text = result.content[0]!.text;
    
    // Exact match should be first
    const exactIndex = text.indexOf('## 1. web-server');
    expect(exactIndex).toBeGreaterThan(0);
  });

  it('should include site context in results', async () => {
    const client = createMockClient();
    const result = await searchDevices(client, { query: 'web' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('**Site:**');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('**Site UID:**');
  });

  it('should provide next steps guidance', async () => {
    const client = createMockClient();
    const result = await searchDevices(client, { query: 'web' });
    const text = result.content[0]!.text;
    
    expect(text).toContain('## 💡 Next Steps');
    expect(text).toContain('get-device-health');
    expect(text).toContain('get-site-health');
  });
});
