/**
 * Tests for rmm_bulk_update_site_devices composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { bulkUpdateSiteDevices } from './bulk-update-site-devices.js';

describe('rmm_bulk_update_site_devices', () => {
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

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.dryRun).toBe(true);
    expect(body.data.site).toBeDefined();
    expect(body.data.updates).toBeDefined();
    expect(body.data.updates.description).toBe('Production Web Server');
    expect(body.data.updates.warranty).toBe('2025-12-31');
    expect(body.data.targetDevices).toBeInstanceOf(Array);
    expect(body.data.targetDevices[0].hostname).toBe('web-server-01');
  });

  it('should handle multiple devices', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['web-server-01', 'db-server-01'],
      updates: { description: 'Production Server' },
      dry_run: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.dryRun).toBe(true);
    expect(body.data.targetDevices).toHaveLength(2);

    const hostnames = body.data.targetDevices.map((d: any) => d.hostname);
    expect(hostnames).toContain('web-server-01');
    expect(hostnames).toContain('db-server-01');
  });

  it('should handle "all" devices selection', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: 'all',
      updates: { description: 'Managed' },
      dry_run: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.targetDevices).toBeInstanceOf(Array);
    expect(body.data.targetDevices.length).toBeGreaterThan(0);
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

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.updates.udf).toBeDefined();
    expect(body.data.updates.udf.patchGroup).toBe('Weekend');
    expect(body.data.updates.udf.location).toBe('Data Center A');
  });

  it('should enforce 50-device limit', async () => {
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
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('validation_error');
    expect(body.detail).toContain('Too many devices');
    expect(body.detail).toContain('50');
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
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('nonexistent-device');
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
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Site not found');
  });

  it('should apply updates in live mode', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      updates: { description: 'Updated' },
      dry_run: false,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.dryRun).toBe(false);
    expect(body.data.results).toBeInstanceOf(Array);
    expect(body.data.results[0].success).toBe(true);
    expect(body.data.results[0].hostname).toBe('web-server-01');
  });

  it('should default to dry-run true for safety', async () => {
    const client = createMockClient();

    const result = await bulkUpdateSiteDevices(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      updates: { description: 'Test' },
      // dry_run not specified - should default to true
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.dryRun).toBe(true);
  });
});
