/**
 * Tests for bulk-update-site-devices composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { bulkUpdateSiteDevices } from './bulk-update-site-devices.js';

describe('bulk-update-site-devices', () => {
  it('should create update plan in dry-run mode', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      updates: {
        description: 'Production Web Server',
        warranty: '2025-12-31',
      },
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('# Bulk Update Plan');
    expect(text).toContain('**Site:** Acme Corp');
    expect(text).toContain('## Changes to Apply');
    expect(text).toContain('**Description:** "Production Web Server"');
    expect(text).toContain('**Warranty:** 2025-12-31');
    expect(text).toContain('## 🔍 Dry Run Mode');
    expect(text).toContain('No changes have been applied');
  });

  it('should handle multiple devices', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['web-server-01', 'db-server-01'],
      updates: { description: 'Production Server' },
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('**Devices:** 2 devices');
    expect(text).toContain('web-server-01');
    expect(text).toContain('db-server-01');
  });

  it('should handle "all" devices selection', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: 'all',
      updates: { description: 'Managed' },
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('**Devices:**');
  });

  it('should handle UDF updates', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      updates: {
        udf: {
          patchGroup: 'Weekend',
          location: 'Data Center A',
        },
      },
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('**UDF Fields:**');
    expect(text).toContain('patchGroup: "Weekend"');
    expect(text).toContain('location: "Data Center A"');
  });

  it('should enforce 50-device limit', async () => {
    // Create a large site with many devices at Acme Corp
    const devices = Array.from({ length: 60 }, (_, i) => ({
      uid: `device-${i}`,
      hostname: `server-${i.toString().padStart(2, '0')}`,
      siteName: 'Acme Corp',
      siteUid: 'site-1',
      online: true,
      deviceType: { type: 'Server' },
    }));

    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 60, prevPageUrl: undefined, nextPageUrl: undefined },
        devices,
      },
    });

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: 'all',
      updates: { description: 'Test' },
      dry_run: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Too many devices');
    expect(result.content[0]!.text).toContain('Maximum 50 devices');
  });

  it('should handle device not found', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['nonexistent-device'],
      updates: { description: 'Test' },
      dry_run: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Device "nonexistent-device" not found');
  });

  it('should handle site not found', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [],
      },
    });

    const result = await bulkUpdateSiteDevices(client, {
      site: 'nonexistent',
      devices: ['device-1'],
      updates: { description: 'Test' },
      dry_run: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Site not found');
  });

  it('should simulate updates in live mode', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      updates: { description: 'Updated' },
      dry_run: false,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## ⚙️ Update Results');
    expect(text).toContain('updated successfully');
  });

  it('should default to dry-run true for safety', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      updates: { description: 'Test' },
      // dry_run not specified - should default to true
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## 🔍 Dry Run Mode');
  });
});
