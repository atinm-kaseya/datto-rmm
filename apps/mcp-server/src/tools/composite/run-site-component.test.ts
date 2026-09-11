/**
 * Tests for rmm_run_site_component composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { runSiteComponent } from './run-site-component.js';

describe('rmm_run_site_component', () => {
  it('should create execution plan in dry-run mode', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      component: 'disk-cleanup',
      dry_run: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.dryRun).toBe(true);
    expect(body.data.site).toBeDefined();
    expect(body.data.component).toBe('disk-cleanup');
    expect(body.data.targetDevices).toBeInstanceOf(Array);
    expect(body.data.targetDevices.length).toBe(1);
    expect(body.data.targetDevices[0].hostname).toBe('web-server-01');
  });

  it('should handle multiple devices', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'server-01',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'server-02',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-3',
            hostname: 'server-03',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['server-01', 'server-02', 'server-03'],
      component: 'windows-updates',
      dry_run: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.dryRun).toBe(true);
    expect(body.data.targetDevices).toHaveLength(3);

    const hostnames = body.data.targetDevices.map((d: any) => d.hostname);
    expect(hostnames).toContain('server-01');
    expect(hostnames).toContain('server-02');
    expect(hostnames).toContain('server-03');
  });

  it('should handle "all" devices selection', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: 'all',
      component: 'component-123',
      dry_run: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.dryRun).toBe(true);
    expect(body.data.targetDevices).toBeInstanceOf(Array);
    expect(body.data.targetDevices.length).toBeGreaterThan(0);
  });

  it('should include component variables', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      component: 'script-runner',
      variables: {
        scriptPath: '/scripts/cleanup.ps1',
        timeout: '300',
      },
      dry_run: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.variables).toBeDefined();
    expect(body.data.variables.scriptPath).toBe('/scripts/cleanup.ps1');
    expect(body.data.variables.timeout).toBe('300');
  });

  it('should handle device not found', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['nonexistent-device'],
      component: 'test',
      dry_run: true,
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('nonexistent-device');
  });

  it('should mark offline devices in target device list', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'online-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'offline-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: false,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: 'all',
      component: 'test-component',
      dry_run: true,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.targetDevices).toHaveLength(2);

    const onlineDevice = body.data.targetDevices.find((d: any) => d.hostname === 'online-server');
    const offlineDevice = body.data.targetDevices.find((d: any) => d.hostname === 'offline-server');

    expect(onlineDevice.online).toBe(true);
    expect(offlineDevice.online).toBe(false);
  });

  it('should handle site not found', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [],
      },
    });

    const result = await runSiteComponent(client, {
      site: 'nonexistent',
      devices: ['device-1'],
      component: 'test',
      dry_run: true,
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Site not found');
  });

  it('should create jobs in live mode', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      component: 'disk-cleanup',
      dry_run: false,
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.dryRun).toBe(false);
    expect(body.data.jobs).toBeInstanceOf(Array);
    expect(body.data.jobs.length).toBe(1);
    expect(body.data.jobs[0]).toHaveProperty('deviceUid');
    expect(body.data.jobs[0]).toHaveProperty('jobUid');
  });
});
