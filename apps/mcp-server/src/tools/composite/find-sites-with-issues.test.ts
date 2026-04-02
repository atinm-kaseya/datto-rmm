/**
 * Tests for find-sites-with-issues composite tool
 */

import { describe, it, expect } from 'vitest';
import { findSitesWithIssues } from './find-sites-with-issues.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('find-sites-with-issues', () => {
  it('should find and rank sites by combined score', async () => {
    const client = createMockClient();
    const result = await findSitesWithIssues(client, {});

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    
    expect(text).toContain('# Sites With Issues');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('🔴');
    expect(text).toContain('critical alert');
  });

  it('should filter by min_offline_devices', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 2, prevPageUrl: null, nextPageUrl: null },
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
        pageDetails: { count: 0, prevPageUrl: null, nextPageUrl: null },
        alerts: [],
      },
    });

    const result = await findSitesWithIssues(client, { min_offline_devices: 5 });
    const text = result.content[0].text;
    
    expect(text).toContain('Many Offline');
    expect(text).not.toContain('One Offline');
  });

  it('should include recommended next steps', async () => {
    const client = createMockClient();
    const result = await findSitesWithIssues(client, {});
    const text = result.content[0].text;
    
    expect(text).toContain('## 💡 Recommended Next Steps');
    expect(text).toContain('get-site-health');
  });
});
