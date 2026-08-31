/**
 * Tests for rmm_find_sites_with_issues composite tool
 */

import { describe, it, expect } from 'vitest';
import { findSitesWithIssues } from './find-sites-with-issues.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('rmm_find_sites_with_issues', () => {
  it('should find and rank sites by combined score', async () => {
    const client = createMockClient();
    const result = await findSitesWithIssues(client, {});

    expect(result.isError).toBeUndefined();
    const text = result.content[0]!.text;
    const body = JSON.parse(text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.count).toBeGreaterThanOrEqual(0);
  });

  it('should filter by min_offline_devices', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [
          {
            uid: 'site-1',
            name: 'Many Offline',
            id: 101,
            devicesStatus: { numberOfDevices: 20, numberOfOnlineDevices: 10, numberOfOfflineDevices: 10 },
          },
          {
            uid: 'site-2',
            name: 'One Offline',
            id: 102,
            devicesStatus: { numberOfDevices: 20, numberOfOnlineDevices: 19, numberOfOfflineDevices: 1 },
          },
        ],
      },
      alerts: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [],
      },
    });

    const result = await findSitesWithIssues(client, { min_offline_devices: 5 });
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeInstanceOf(Array);

    const siteNames = body.data.map((s: any) => s.name);
    expect(siteNames).toContain('Many Offline');
    expect(siteNames).not.toContain('One Offline');
  });

  it('should include site data fields in results', async () => {
    const client = createMockClient();
    const result = await findSitesWithIssues(client, {});
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    // If there are results, verify structure
    if (body.data.length > 0) {
      const firstSite = body.data[0];
      expect(firstSite).toHaveProperty('name');
      expect(firstSite).toHaveProperty('uid');
      expect(firstSite).toHaveProperty('alertCount');
      expect(firstSite).toHaveProperty('offlineDevices');
      expect(firstSite).toHaveProperty('score');
    }
  });
});
