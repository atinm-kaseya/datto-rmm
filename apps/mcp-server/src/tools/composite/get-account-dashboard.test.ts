/**
 * Tests for rmm_get_account_dashboard composite tool
 */

import { describe, it, expect } from 'vitest';
import { getAccountDashboard } from './get-account-dashboard.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('rmm_get_account_dashboard', () => {
  it('should return account overview', async () => {
    const client = createMockClient();
    const result = await getAccountDashboard(client, {});

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);

    const text = result.content[0]!.text;
    
    // Check main sections exist
    expect(text).toContain('# Account Dashboard');
    expect(text).toContain('## 📊 Account Overview');
    expect(text).toContain('**Devices:**');
    expect(text).toContain('**Sites:**');
  });

  it('should show all clear when no issues', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [
          {
            uid: 'site-1',
            name: 'Healthy Site',
            id: 1,
            devicesStatus: { numberOfDevices: 10, numberOfOnlineDevices: 10, numberOfOfflineDevices: 0 },
          },
        ],
      },
      devices: {
        pageDetails: { count: 10, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: Array(10).fill(null).map((_, i) => ({
          uid: `device-${i}`,
          hostname: `device-${i}`,
          online: true,
          siteName: 'Healthy Site',
          siteUid: 'site-1',
          deviceType: { type: 'Server' },
        })),
      },
      alerts: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [],
      },
    });

    const result = await getAccountDashboard(client, {});
    const text = result.content[0]!.text;
    
    expect(text).toContain('## ✅ All Clear');
    expect(text).toContain('No critical issues detected');
  });

  it('should rank sites by score', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [
          {
            uid: 'site-1',
            name: 'Site with Alerts',
            id: 1,
            devicesStatus: { numberOfDevices: 10, numberOfOnlineDevices: 10, numberOfOfflineDevices: 0 },
          },
          {
            uid: 'site-2',
            name: 'Site with Offline',
            id: 2,
            devicesStatus: { numberOfDevices: 10, numberOfOnlineDevices: 5, numberOfOfflineDevices: 5 },
          },
        ],
      },
    });

    const result = await getAccountDashboard(client, {});
    expect(result.isError).toBeUndefined();
  });
});
